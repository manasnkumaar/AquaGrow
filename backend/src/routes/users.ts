import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { audit } from "../services/audit";

const router = Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", async (_req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC`
    );
    res.json({ users: r.rows });
  } catch (e) { next(e); }
});

const PatchBody = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["admin", "operator", "viewer"]).optional(),
  password: z.string().min(8).optional(),
});

router.patch("/:id", async (req, res, next) => {
  try {
    const b = PatchBody.parse(req.body);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let p = 1;
    if (b.name) { sets.push(`name=$${p++}`); vals.push(b.name); }
    if (b.role) { sets.push(`role=$${p++}`); vals.push(b.role); }
    if (b.password) {
      const hash = await bcrypt.hash(b.password, 10);
      sets.push(`password_hash=$${p++}`); vals.push(hash);
    }
    if (!sets.length) return res.status(400).json({ error: "No fields" });
    vals.push(req.params.id);
    const r = await pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id=$${p}
       RETURNING id, email, name, role, created_at`,
      vals
    );
    if (!r.rowCount) return res.status(404).json({ error: "User not found" });
    await audit(req.user!.sub, "user.update", { id: req.params.id, fields: Object.keys(b) });
    res.json({ user: r.rows[0] });
  } catch (e) { next(e); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.params.id === req.user!.sub) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }
    const r = await pool.query(`DELETE FROM users WHERE id=$1`, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: "User not found" });
    await audit(req.user!.sub, "user.delete", { id: req.params.id });
    res.status(204).send();
  } catch (e) { next(e); }
});

export default router;
