# AquaGrow Architecture

```
┌────────────────┐    HTTPS/JSON   ┌──────────────────┐    SQL    ┌─────────────┐
│  Next.js 14    │ ◀────────────▶ │  Express API     │ ◀────────▶│  Postgres   │
│  (frontend)    │                │  (Node + TS)     │           │  16         │
└──────┬─────────┘                └─────────┬────────┘           └─────────────┘
       │                                    │
       │                                    │ background tick
       │                                    ▼
       │                          ┌──────────────────┐
       │                          │ Mock sensor svc  │
       │                          └──────────────────┘
       ▼
  Recharts visualizations, html2canvas/jsPDF exports
```

## Major modules

### Frontend (`/frontend`)
- **App Router** under `src/app/`. Each top-level route is one of: `login`, `register`, `dashboard`, `led`, `analytics`, `research`, `admin`.
- **Auth** is managed in `src/lib/auth.tsx` via React context; JWT stored in `localStorage`.
- **API client** (`src/lib/api.ts`) automatically injects Authorization headers and parses JSON errors. `fetchAndDownload` issues an authenticated GET and triggers a Blob download (used for CSV/PDF exports).
- **Theme** uses `next-themes` with a CSS-variable design system in `globals.css`. Dark/light is toggleable from the top bar.
- **Charts** are Recharts wrappers (`SensorLineChart`, `SensorAreaChart`) that consume wide-format rows.
- The **research module** also uses `html2canvas` + `jspdf` to render the entire IEEE-style article into a multi-page PDF on the client; individual charts can be exported as PNG for slide decks.

### Backend (`/backend`)
- Express + TypeScript, JWT via `jsonwebtoken`, password hashing via `bcryptjs`, input validation via `zod`.
- `src/db/pool.ts` exposes a shared `pg` Pool and a `withTransaction` helper.
- `src/db/schema.sql` is the source of truth for the schema and is applied by `npm run migrate`.
- `src/services/mockSensors.ts` runs as a background interval inside the API process and produces realistic sensor noise. Disable via `MOCK_SENSORS=false`.
- Each route module owns its surface (auth, devices, sensors, led, analytics, alerts, logs, users, research) and audit-logs mutations through `src/services/audit.ts`.
- `pdfkit` powers the server-side PDF analytics export; the frontend research page does its own client-side PDF render for the publication preview.

### Database
- `users`, `devices`, `sensor_readings`, `led_configs`, `led_energy_log`, `alerts`, `system_logs`, `growth_index`.
- Time-series indices on `sensor_readings (device_id, recorded_at DESC)` and `led_energy_log` for fast windowed queries.
- Roles are constrained by check constraint on `users.role`.

## Auth flow
1. User submits credentials → `/api/auth/login` → server compares bcrypt hash → issues JWT with `{ sub, email, role }`.
2. Frontend stores token in `localStorage` under `aquagrow_token`.
3. Subsequent requests send `Authorization: Bearer …`.
4. `requireAuth` middleware verifies the token; `requireRole` gates admin/operator-only routes.

## Adaptive LED algorithm
- Each growth mode (`seedling`, `vegetative`, `flowering`, `fruiting`) has an RGB + brightness preset tuned for that growth stage.
- `auto_adjust=true` is the contract surface for an external controller to override brightness/spectrum based on ambient light; the dashboard reports the resulting energy in `led_energy_log` (kWh / duration).
- The LED energy summary (`/api/led/energy/summary`) aggregates per-device totals and daily kWh for the analytics charts.

## Mock data
- `npm run seed` writes 14 days of 15-minute-bucketed sensor history for 4 demo devices, daily GI values, sample alerts, and energy logs.
- `MOCK_SENSORS=true` keeps the system "live" by inserting a fresh reading every `MOCK_INTERVAL_MS` (default 5000 ms).
