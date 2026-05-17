import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { audit } from "../services/audit";

const router = Router();
router.use(requireAuth);

const MODE_PRESETS: Record<string, { r: number; g: number; b: number; brightness: number }> = {
  seedling:   { r: 120, g: 220, b: 200, brightness: 60 },
  vegetative: { r: 80,  g: 255, b: 120, brightness: 75 },
  flowering:  { r: 255, g: 80,  b: 180, brightness: 80 },
  fruiting:   { r: 255, g: 160, b: 60,  brightness: 85 },
  off:        { r: 0,   g: 0,   b: 0,   brightness: 0  },
};

router.get("/", async (_req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT lc.*, d.name AS device_name FROM led_configs lc
       JOIN devices d ON d.id = lc.device_id
       ORDER BY d.created_at ASC`
    );
    res.json({ configs: r.rows });
  } catch (e) { next(e); }
});

router.get("/:deviceId", async (req, res, next) => {
  try {
    const r = await pool.query(`SELECT * FROM led_configs WHERE device_id=$1`, [req.params.deviceId]);
    if (!r.rowCount) return res.status(404).json({ error: "LED config not found" });
    res.json({ config: r.rows[0] });
  } catch (e) { next(e); }
});

const PutBody = z.object({
  mode: z.enum(["seedling","vegetative","flowering","fruiting","custom","off"]).optional(),
  color_r: z.number().int().min(0).max(255).optional(),
  color_g: z.number().int().min(0).max(255).optional(),
  color_b: z.number().int().min(0).max(255).optional(),
  brightness: z.number().int().min(0).max(100).optional(),
  schedule_on: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  schedule_off: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  auto_adjust: z.boolean().optional(),
});

router.put("/:deviceId", requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const id = req.params.deviceId;
    const b = PutBody.parse(req.body);
    const merged: Record<string, unknown> = { ...b };
    if (b.mode && b.mode !== "custom" && MODE_PRESETS[b.mode]) {
      const preset = MODE_PRESETS[b.mode];
      merged.color_r = b.color_r ?? preset.r;
      merged.color_g = b.color_g ?? preset.g;
      merged.color_b = b.color_b ?? preset.b;
      merged.brightness = b.brightness ?? preset.brightness;
    }
    const fields = Object.keys(merged);
    if (!fields.length) return res.status(400).json({ error: "No fields to update" });
    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    for (const f of fields) {
      sets.push(`${f} = $${p++}`);
      vals.push((merged as Record<string, unknown>)[f]);
    }
    sets.push(`updated_at = NOW()`);
    vals.push(id);
    const r = await pool.query(
      `UPDATE led_configs SET ${sets.join(", ")} WHERE device_id=$${p} RETURNING *`,
      vals
    );
    if (!r.rowCount) return res.status(404).json({ error: "LED config not found" });

    // log energy estimate: brightness * duration assumption (rough)
    const duration_min = 16 * 60;
    const energy_kwh = ((merged.brightness as number | undefined) ?? r.rows[0].brightness) * 0.0005 * (duration_min / 60);
    await pool.query(
      `INSERT INTO led_energy_log (device_id, energy_kwh, duration_min) VALUES ($1,$2,$3)`,
      [id, energy_kwh.toFixed(4), duration_min]
    );

    await audit(req.user!.sub, "led.update", { device_id: id, fields });
    res.json({ config: r.rows[0] });
  } catch (e) { next(e); }
});

router.get("/energy/summary", async (_req, res, next) => {
  try {
    const r = await pool.query(`
      SELECT d.id AS device_id, d.name AS device_name,
             SUM(e.energy_kwh)::numeric(10,3) AS total_kwh,
             AVG(e.energy_kwh)::numeric(10,3) AS avg_kwh,
             COUNT(*) AS samples
      FROM devices d
      LEFT JOIN led_energy_log e ON e.device_id = d.id
      GROUP BY d.id, d.name
      ORDER BY d.name ASC
    `);
    const daily = await pool.query(`
      SELECT date_trunc('day', recorded_at)::date AS day,
             SUM(energy_kwh)::numeric(10,3) AS total_kwh
      FROM led_energy_log
      GROUP BY 1 ORDER BY 1 ASC
    `);
    res.json({ summary: r.rows, daily: daily.rows });
  } catch (e) { next(e); }
});

export default router;
