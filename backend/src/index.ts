import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { notFound, errorHandler } from "./middleware/error";
import { startMockSensors } from "./services/mockSensors";

import authRoutes from "./routes/auth";
import deviceRoutes from "./routes/devices";
import sensorRoutes from "./routes/sensors";
import ledRoutes from "./routes/led";
import analyticsRoutes from "./routes/analytics";
import alertRoutes from "./routes/alerts";
import logRoutes from "./routes/logs";
import userRoutes from "./routes/users";
import researchRoutes from "./routes/research";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/sensors", sensorRoutes);
app.use("/api/led", ledRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/users", userRoutes);
app.use("/api/research", researchRoutes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  logger.info(`AquaGrow backend listening on :${env.port}`, { env: env.nodeEnv });
  startMockSensors();
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));

export default app;
