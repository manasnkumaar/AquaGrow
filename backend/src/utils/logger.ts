/* Tiny structured logger to avoid a dependency. */
type Level = "info" | "warn" | "error" | "debug";

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry = { level, msg, time: new Date().toISOString(), ...meta };
  // eslint-disable-next-line no-console
  console[level === "debug" ? "log" : level](JSON.stringify(entry));
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
};
