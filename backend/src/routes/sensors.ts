import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/latest", async (req, res, next) => {
  try {
    const deviceId = (req.query.deviceId as string | undefined) ?? null;
    const sql = deviceId
      ? `SELECT DISTINCT ON (device_id) sr.*, d.name AS device_name
           FROM sensor_readings sr JOIN devices d ON d.id = sr.device_id
           WHERE sr.device_id = $1
           ORDER BY sr.device_id, sr.recorded_at DESC`
      : `SELECT DISTINCT ON (device_id) sr.*, d.name AS device_name
           FROM sensor_readings sr JOIN devices d ON d.id = sr.device_id
           ORDER BY sr.device_id, sr.recorded_at DESC`;
    const r = deviceId ? await pool.query(sql, [deviceId]) : await pool.query(sql);
    res.json({ readings: r.rows });
  } catch (e) { next(e); }
});

const HistoryQuery = z.object({
  deviceId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
  bucket: z.enum(["raw", "minute", "hour", "day"]).optional(),
});

router.get("/history", async (req, res, next) => {
  try {
    const q = HistoryQuery.parse(req.query);
    const params: unknown[] = [];
    let p = 1;
    const conds: string[] = [];
    if (q.deviceId) { conds.push(`device_id=$${p++}`); params.push(q.deviceId); }
    if (q.from)     { conds.push(`recorded_at >= $${p++}`); params.push(q.from); }
    if (q.to)       { conds.push(`recorded_at <= $${p++}`); params.push(q.to); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const bucket = q.bucket ?? "raw";

    let sql: string;
    if (bucket === "raw") {
      sql = `SELECT id, device_id, temperature, humidity, water_level, ph, light_intensity, recorded_at
             FROM sensor_readings ${where}
             ORDER BY recorded_at ASC
             LIMIT ${q.limit ?? 2000}`;
    } else {
      const trunc = bucket === "minute" ? "minute" : bucket === "hour" ? "hour" : "day";
      sql = `SELECT
               date_trunc('${trunc}', recorded_at) AS recorded_at,
               device_id,
               AVG(temperature)::numeric(6,2) AS temperature,
               AVG(humidity)::numeric(6,2) AS humidity,
               AVG(water_level)::numeric(6,2) AS water_level,
               AVG(ph)::numeric(5,2) AS ph,
               AVG(light_intensity)::numeric(8,2) AS light_intensity
             FROM sensor_readings ${where}
             GROUP BY 1,2
             ORDER BY 1 ASC
             LIMIT ${q.limit ?? 2000}`;
    }
    const r = await pool.query(sql, params);
    res.json({ readings: r.rows });
  } catch (e) { next(e); }
});

const IngestBody = z.object({
  deviceId: z.string().uuid(),
  temperature: z.number(),
  humidity: z.number(),
  waterLevel: z.number(),
  ph: z.number(),
  lightIntensity: z.number(),
  recordedAt: z.string().datetime().optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const b = IngestBody.parse(req.body);
    const r = await pool.query(
      `INSERT INTO sensor_readings
         (device_id, temperature, humidity, water_level, ph, light_intensity, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, NOW()))
       RETURNING *`,
      [b.deviceId, b.temperature, b.humidity, b.waterLevel, b.ph, b.lightIntensity, b.recordedAt ?? null]
    );
    res.status(201).json({ reading: r.rows[0] });
  } catch (e) { next(e); }
});

export default router;
