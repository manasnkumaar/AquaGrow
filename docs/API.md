# AquaGrow API Reference

Base URL: `http://localhost:4000` (default)

All endpoints (except `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/health`) require a Bearer token:
```
Authorization: Bearer <jwt>
```

JSON request/response throughout. Errors:
```json
{ "error": "Human-readable message", "details": { /* zod issues, optional */ } }
```

## Conventions
- IDs are UUIDs unless stated.
- Timestamps are ISO-8601 (UTC).
- Roles: `admin`, `operator`, `viewer`.

## Health
```
GET /api/health  →  { "status": "ok", "time": "..." }
```

## Auth

### Register
```
POST /api/auth/register
Body: { "email": "...", "password": "min8chars", "name": "...", "role"?: "admin|operator|viewer" }
→ 201 { "token": "...", "user": {...} }
```

### Login
```
POST /api/auth/login
Body: { "email": "...", "password": "..." }
→ 200 { "token": "...", "user": {...} }
```

### Current user
```
GET /api/auth/me
→ 200 { "user": {...} }
```

## Devices

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET    | `/api/devices` | any | List devices with `last_seen` |
| POST   | `/api/devices` | admin, operator | Create a device |
| PATCH  | `/api/devices/:id` | admin, operator | Update device fields |
| DELETE | `/api/devices/:id` | admin | Remove a device |

Body fields: `name`, `location`, `type?`, `status?` (`online|offline|maintenance`), `firmware?`.

## Sensors

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET    | `/api/sensors/latest?deviceId=` | any | Latest reading per device |
| GET    | `/api/sensors/history?deviceId=&from=&to=&limit=&bucket=raw\|minute\|hour\|day` | any | Historical/bucketed readings |
| POST   | `/api/sensors` | any | Ingest a reading (for device firmware integrations) |

Reading shape:
```json
{
  "device_id": "uuid",
  "temperature": 23.5,
  "humidity": 68.4,
  "water_level": 71.0,
  "ph": 6.7,
  "light_intensity": 720.0,
  "recorded_at": "2026-05-17T12:00:00Z"
}
```

## LED control

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET    | `/api/led` | any | List all LED configs |
| GET    | `/api/led/:deviceId` | any | Read LED config for device |
| PUT    | `/api/led/:deviceId` | admin, operator | Update mode/color/brightness/schedule/auto |
| GET    | `/api/led/energy/summary` | any | Per-device totals + daily kWh |

Available `mode`: `seedling`, `vegetative`, `flowering`, `fruiting`, `custom`, `off`.
Setting `mode` (non-custom) applies preset RGB+brightness unless explicit values are provided.

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/growth-index` | Daily GI per device |
| GET | `/api/analytics/trends?days=N` | Daily means per device for last N days |
| GET | `/api/analytics/export.csv?days=N` | CSV download |
| GET | `/api/analytics/export.pdf?days=N` | PDF download (publication summary) |

## Alerts

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET    | `/api/alerts?ack=true\|false` | any | Recent alerts |
| PATCH  | `/api/alerts/:id/ack` | admin, operator | Acknowledge |

## Logs (admin)

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/logs?limit=N` | System audit log |

## Users (admin)

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/users` | List users |
| PATCH  | `/api/users/:id` | Update `name`, `role`, or `password` |
| DELETE | `/api/users/:id` | Remove a user (cannot self-delete) |

## Research

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/research/report` | IEEE-style structured report payload (title, abstract, sections, tables) |
