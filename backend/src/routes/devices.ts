import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { audit } from "../services/audit";

const router = Router();
router.use(requireAuth);

const DeviceBody = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  type: z.string().optional(),
  status: z.enum(["online", "offline", "maintenance"]).optional(),
  firmware: z.string().optional(),
});

router.get("/", async (_req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT d.*,
        (SELECT recorded_at FROM sensor_readings s WHERE s.device_id = d.id ORDER BY recorded_at DESC LIMIT 1) AS last_seen
       FROM devices d ORDER BY d.created_at ASC`
    );
    res.json({ devices: r.rows });
  } catch (e) { next(e); }
});

router.post("/", requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const b = DeviceBody.parse(req.body);
    const r = await pool.query(
      `INSERT INTO devices (name, location, type, status, firmware)
       VALUES ($1,$2,COALESCE($3,'aquaponics'),COALESCE($4,'online'),COALESCE($5,'v1.0.0'))
       RETURNING *`,
      [b.name, b.location, b.type ?? null, b.status ?? null, b.firmware ?? null]
    );
    // default LED config
    await pool.query(
      `INSERT INTO led_configs (device_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [r.rows[0].id]
    );
    await audit(req.user!.sub, "device.create", { id: r.rows[0].id, name: r.rows[0].name });
    res.status(201).json({ device: r.rows[0] });
  } catch (e) { next(e); }
});

router.patch("/:id", requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const id = req.params.id;
    const b = DeviceBody.partial().parse(req.body);
    const fields: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    for (const [k, v] of Object.entries(b)) {
      if (v !== undefined) {
        fields.push(`${k} = $${p++}`);
        vals.push(v);
      }
    }
    if (!fields.length) return res.status(400).json({ error: "No fields to update" });
    vals.push(id);
    const r = await pool.query(
      `UPDATE devices SET ${fields.join(", ")} WHERE id=$${p} RETURNING *`,
      vals
    );
    if (!r.rowCount) return res.status(404).json({ error: "Device not found" });
    await audit(req.user!.sub, "device.update", { id, fields: Object.keys(b) });
    res.json({ device: r.rows[0] });
  } catch (e) { next(e); }
});

router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const r = await pool.query(`DELETE FROM devices WHERE id=$1`, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: "Device not found" });
    await audit(req.user!.sub, "device.delete", { id: req.params.id });
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
