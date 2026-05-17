import { pool } from "../db/pool";
import { logger } from "../utils/logger";
import { env } from "../config/env";

function gauss(mean: number, sigma: number) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + sigma * z;
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

let timer: NodeJS.Timeout | null = null;

async function tick() {
  try {
    const devices = await pool.query<{ id: string }>(`SELECT id FROM devices WHERE status='online'`);
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    for (const d of devices.rows) {
      const tempBase = 22 + 6 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
      const temperature = clamp(gauss(tempBase, 0.4), 12, 38);
      const humidity = clamp(gauss(70 - (temperature - 22) * 1.5, 2), 30, 95);
      const waterLevel = clamp(gauss(72, 1.0), 30, 100);
      const ph = clamp(gauss(6.6, 0.1), 5.5, 7.8);
      const lightBase = hour > 6 && hour < 20 ? 700 + 250 * Math.sin(((hour - 6) / 14) * Math.PI) : 50;
      const lightIntensity = clamp(gauss(lightBase, 20), 0, 1200);
      await pool.query(
        `INSERT INTO sensor_readings
           (device_id, temperature, humidity, water_level, ph, light_intensity)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          d.id,
          temperature.toFixed(2),
          humidity.toFixed(2),
          waterLevel.toFixed(2),
          ph.toFixed(2),
          lightIntensity.toFixed(2),
        ]
      );

      // emit a critical alert occasionally when water level low
      if (waterLevel < 35 && Math.random() < 0.1) {
        await pool.query(
          `INSERT INTO alerts (device_id, severity, message) VALUES ($1,'critical',$2)`,
          [d.id, `Water level critically low (${waterLevel.toFixed(1)}%)`]
        );
      }
    }
  } catch (err) {
    logger.error("mockSensors tick failed", { err: err instanceof Error ? err.message : String(err) });
  }
}

export function startMockSensors() {
  if (!env.mockSensors) {
    logger.info("Mock sensors disabled");
    return;
  }
  if (timer) return;
  logger.info("Starting mock sensor generator", { intervalMs: env.mockIntervalMs });
  timer = setInterval(tick, env.mockIntervalMs);
  // run one tick immediately
  void tick();
}

export function stopMockSensors() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
