import dotenv from "dotenv";
import path from "path";

// Load .env from backend root (one above src)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me-please-32chars"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
  mockSensors: (process.env.MOCK_SENSORS ?? "true") === "true",
  mockIntervalMs: Number(process.env.MOCK_INTERVAL_MS ?? 5000),
  pg: {
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? "aquagrow",
    password: process.env.POSTGRES_PASSWORD ?? "aquagrow",
    database: process.env.POSTGRES_DB ?? "aquagrow",
  },
};
