import bcrypt from "bcryptjs";
import { pool } from "./pool";

type SeedDevice = { name: string; location: string };

const DEVICES: SeedDevice[] = [
  { name: "Greenhouse A - Bay 1", location: "Greenhouse A" },
  { name: "Greenhouse A - Bay 2", location: "Greenhouse A" },
  { name: "Rooftop Hydroponics", location: "Rooftop" },
  { name: "Indoor Vertical Farm", location: "Indoor Lab" },
];

function gauss(mean: number, sigma: number) {
  // Box-Muller
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + sigma * z;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

async function seedUsers() {
  const adminPw = await bcrypt.hash("admin123", 10);
  const opPw = await bcrypt.hash("operator123", 10);
  const viewerPw = await bcrypt.hash("viewer123", 10);

  await pool.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES
       ($1,$2,'Admin User','admin'),
       ($3,$4,'Operator User','operator'),
       ($5,$6,'Viewer User','viewer')
     ON CONFLICT (email) DO NOTHING`,
    [
      "admin@aquagrow.local", adminPw,
      "operator@aquagrow.local", opPw,
      "viewer@aquagrow.local", viewerPw,
    ]
  );
}

async function seedDevices(): Promise<{ id: string; name: string }[]> {
  const rows: { id: string; name: string }[] = [];
  for (const d of DEVICES) {
    const r = await pool.query(
      `INSERT INTO devices (name, location, type, status)
       VALUES ($1,$2,'aquaponics','online')
       ON CONFLICT DO NOTHING
       RETURNING id, name`,
      [d.name, d.location]
    );
    if (r.rowCount && r.rows[0]) {
      rows.push(r.rows[0]);
    } else {
      const ex = await pool.query(`SELECT id, name FROM devices WHERE name=$1`, [d.name]);
      if (ex.rows[0]) rows.push(ex.rows[0]);
    }
  }
  return rows;
}

async function seedLedConfigs(devices: { id: string }[]) {
  const modes = ["seedling", "vegetative", "flowering", "fruiting"];
  for (let i = 0; i < devices.length; i++) {
    const d = devices[i];
    const mode = modes[i % modes.length];
    const [r, g, b] =
      mode === "seedling" ? [120, 220, 200]
      : mode === "vegetative" ? [80, 255, 120]
      : mode === "flowering" ? [255, 80, 180]
      : [255, 160, 60];
    await pool.query(
      `INSERT INTO led_configs (device_id, mode, color_r, color_g, color_b, brightness, auto_adjust)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)
       ON CONFLICT (device_id) DO NOTHING`,
      [d.id, mode, r, g, b, 70 + i * 5]
    );
  }
}

async function seedSensorHistory(devices: { id: string; name: string }[]) {
  const now = new Date();
  const days = 14;
  const intervalMin = 15;
  for (const d of devices) {
    const values: string[] = [];
    const params: (string | number)[] = [];
    let p = 1;
    for (let day = days - 1; day >= 0; day--) {
      for (let m = 0; m < 24 * 60; m += intervalMin) {
        const t = new Date(now);
        t.setDate(now.getDate() - day);
        t.setHours(0, m, 0, 0);
        const hour = t.getHours() + t.getMinutes() / 60;
        const tempBase = 22 + 6 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
        const temperature = clamp(gauss(tempBase, 0.6), 12, 38);
        const humidity = clamp(gauss(70 - (temperature - 22) * 1.5, 3), 30, 95);
        const waterLevel = clamp(gauss(72 - day * 0.4, 1.5), 30, 100);
        const ph = clamp(gauss(6.6, 0.15), 5.5, 7.8);
        const lightBase = hour > 6 && hour < 20 ? 700 + 250 * Math.sin(((hour - 6) / 14) * Math.PI) : 50;
        const lightIntensity = clamp(gauss(lightBase, 30), 0, 1200);
        values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
        params.push(
          d.id,
          temperature.toFixed(2),
          humidity.toFixed(2),
          waterLevel.toFixed(2),
          ph.toFixed(2),
          lightIntensity.toFixed(2),
          t.toISOString()
        );
        // flush every 500 rows to keep statement size reasonable
        if (values.length >= 500) {
          await pool.query(
            `INSERT INTO sensor_readings
              (device_id, temperature, humidity, water_level, ph, light_intensity, recorded_at)
             VALUES ${values.join(",")}`,
            params
          );
          values.length = 0;
          params.length = 0;
          p = 1;
        }
      }
    }
    if (values.length) {
      await pool.query(
        `INSERT INTO sensor_readings
          (device_id, temperature, humidity, water_level, ph, light_intensity, recorded_at)
         VALUES ${values.join(",")}`,
        params
      );
    }
  }
}

async function seedGrowthIndex(devices: { id: string }[]) {
  const today = new Date();
  for (const d of devices) {
    for (let day = 13; day >= 0; day--) {
      const date = new Date(today);
      date.setDate(today.getDate() - day);
      const gi = clamp(0.35 + (13 - day) * 0.045 + gauss(0, 0.02), 0, 1);
      await pool.query(
        `INSERT INTO growth_index (device_id, recorded_on, gi_value, notes)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (device_id, recorded_on) DO UPDATE SET gi_value = EXCLUDED.gi_value`,
        [d.id, date.toISOString().slice(0, 10), gi.toFixed(3), null]
      );
    }
  }
}

async function seedAlerts(devices: { id: string }[]) {
  const samples = [
    { sev: "warning", msg: "pH drifted above optimal range" },
    { sev: "info", msg: "LED schedule auto-adjusted for cloudy day" },
    { sev: "critical", msg: "Water level dropped below 30% — refill required" },
    { sev: "warning", msg: "Humidity spike detected" },
  ];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const d = devices[i % devices.length];
    await pool.query(
      `INSERT INTO alerts (device_id, severity, message, acknowledged, created_at)
       VALUES ($1,$2,$3,$4, NOW() - ($5 || ' hours')::interval)`,
      [d.id, s.sev, s.msg, i === 1, i * 6]
    );
  }
}

async function seedEnergy(devices: { id: string }[]) {
  for (const d of devices) {
    for (let day = 13; day >= 0; day--) {
      const energy = clamp(gauss(2.4 - day * 0.02, 0.25), 0.5, 4.0);
      await pool.query(
        `INSERT INTO led_energy_log (device_id, energy_kwh, duration_min, recorded_at)
         VALUES ($1,$2,$3, NOW() - ($4 || ' days')::interval)`,
        [d.id, energy.toFixed(4), 16 * 60, day]
      );
    }
  }
}

async function main() {
  console.log("Seeding users ...");
  await seedUsers();
  console.log("Seeding devices ...");
  const devices = await seedDevices();
  console.log(`Seeded ${devices.length} devices.`);
  console.log("Seeding LED configs ...");
  await seedLedConfigs(devices);
  console.log("Seeding sensor history (14 days) ...");
  await seedSensorHistory(devices);
  console.log("Seeding growth index ...");
  await seedGrowthIndex(devices);
  console.log("Seeding alerts ...");
  await seedAlerts(devices);
  console.log("Seeding energy log ...");
  await seedEnergy(devices);
  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
