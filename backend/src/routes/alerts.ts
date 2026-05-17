import { Router } from "express";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { audit } from "../services/audit";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const ack = req.query.ack;
    const where = ack === "true" ? "WHERE acknowledged = TRUE"
                : ack === "false" ? "WHERE acknowledged = FALSE"
                : "";
    const r = await pool.query(`
      SELECT a.*, d.name AS device_name
      FROM alerts a LEFT JOIN devices d ON d.id = a.device_id
      ${where}
      ORDER BY a.created_at DESC LIMIT 200
    `);
    res.json({ alerts: r.rows });
  } catch (e) { next(e); }
});

router.patch("/:id/ack", requireRole("admin", "operator"), async (req, res, next) => {
  try {
    const r = await pool.query(
      `UPDATE alerts SET acknowledged=TRUE, acknowledged_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Alert not found" });
    await audit(req.user!.sub, "alert.ack", { id: req.params.id });
    res.json({ alert: r.rows[0] });
  } catch (e) { next(e); }
});

export default router;
