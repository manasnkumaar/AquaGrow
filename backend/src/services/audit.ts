import { pool } from "../db/pool";

export async function audit(userId: string | null, action: string, details?: Record<string, unknown>) {
  await pool.query(
    `INSERT INTO system_logs (user_id, action, details) VALUES ($1,$2,$3)`,
    [userId, action, details ? JSON.stringify(details) : null]
  );
}
