import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db/pool";
import { signToken } from "../utils/jwt";
import { requireAuth } from "../middleware/auth";
import { audit } from "../services/audit";

const router = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["admin", "operator", "viewer"]).optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req, res, next) => {
  try {
    const body = RegisterBody.parse(req.body);
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [body.email]);
    if (exists.rowCount) return res.status(409).json({ error: "Email already in use" });
    const hash = await bcrypt.hash(body.password, 10);
    const r = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1,$2,$3, COALESCE($4,'operator'))
       RETURNING id, email, name, role, created_at`,
      [body.email, hash, body.name, body.role ?? null]
    );
    const user = r.rows[0];
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    await audit(user.id, "user.register", { email: user.email });
    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = LoginBody.parse(req.body);
    const r = await pool.query(
      `SELECT id, email, name, role, password_hash FROM users WHERE email=$1`,
      [body.email]
    );
    if (!r.rowCount) return res.status(401).json({ error: "Invalid credentials" });
    const u = r.rows[0];
    const ok = await bcrypt.compare(body.password, u.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = signToken({ sub: u.id, email: u.email, role: u.role });
    await audit(u.id, "user.login", { email: u.email });
    res.json({
      token,
      user: { id: u.id, email: u.email, name: u.name, role: u.role },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id, email, name, role, created_at FROM users WHERE id=$1`,
      [req.user!.sub]
    );
    if (!r.rowCount) return res.status(404).json({ error: "User not found" });
    res.json({ user: r.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
