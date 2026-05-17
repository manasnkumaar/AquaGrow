import { Router } from "express";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
    const r = await pool.query(`
      SELECT l.id, l.action, l.details, l.created_at,
             u.email AS user_email, u.name AS user_name
      FROM system_logs l LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC LIMIT $1
    `, [limit]);
    res.json({ logs: r.rows });
  } catch (e) { next(e); }
});

export default router;
