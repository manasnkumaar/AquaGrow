-- AquaGrow Smart Farming Dashboard - PostgreSQL Schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')) DEFAULT 'operator',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  location    TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'aquaponics',
  status      TEXT NOT NULL CHECK (status IN ('online', 'offline', 'maintenance')) DEFAULT 'online',
  firmware    TEXT DEFAULT 'v1.0.0',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id              BIGSERIAL PRIMARY KEY,
  device_id       UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  temperature     NUMERIC(5,2) NOT NULL,
  humidity        NUMERIC(5,2) NOT NULL,
  water_level     NUMERIC(5,2) NOT NULL,
  ph              NUMERIC(4,2) NOT NULL,
  light_intensity NUMERIC(7,2) NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_time
  ON sensor_readings (device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS led_configs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    UUID NOT NULL UNIQUE REFERENCES devices(id) ON DELETE CASCADE,
  mode         TEXT NOT NULL CHECK (mode IN ('seedling','vegetative','flowering','fruiting','custom','off')) DEFAULT 'vegetative',
  color_r      INTEGER NOT NULL DEFAULT 255,
  color_g      INTEGER NOT NULL DEFAULT 255,
  color_b      INTEGER NOT NULL DEFAULT 255,
  brightness   INTEGER NOT NULL DEFAULT 80 CHECK (brightness BETWEEN 0 AND 100),
  schedule_on  TIME NOT NULL DEFAULT '06:00',
  schedule_off TIME NOT NULL DEFAULT '22:00',
  auto_adjust  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS led_energy_log (
  id          BIGSERIAL PRIMARY KEY,
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  energy_kwh  NUMERIC(8,4) NOT NULL,
  duration_min INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_led_energy_device_time
  ON led_energy_log (device_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id     UUID REFERENCES devices(id) ON DELETE SET NULL,
  severity      TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  message       TEXT NOT NULL,
  acknowledged  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts (created_at DESC);

CREATE TABLE IF NOT EXISTS system_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON system_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS growth_index (
  id         BIGSERIAL PRIMARY KEY,
  device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  recorded_on DATE NOT NULL,
  gi_value   NUMERIC(6,3) NOT NULL,
  notes      TEXT,
  UNIQUE (device_id, recorded_on)
);
