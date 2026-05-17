# AquaGrow Smart Farming Dashboard

A full-stack, production-ready monitoring platform for aquaponic / hydroponic deployments.
Real-time multi-sensor dashboards, adaptive LED control, growth-index analytics with CSV/PDF export,
an IEEE-style research module with publication-quality exports, and an admin panel for devices /
alerts / logs / users.

| Layer    | Tech |
|----------|------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS + Recharts + next-themes |
| Backend  | Node.js + Express + TypeScript + `pg` + `jsonwebtoken` + `bcryptjs` + `pdfkit` + `zod` |
| Database | PostgreSQL 16 |
| Deploy   | Docker + docker-compose |

## Features

- 📊 **Real-time monitoring dashboard** — Temperature, humidity, water level, pH, light intensity. Live tiles + interactive multi-series Recharts trend chart (5 s auto-refresh).
- 💡 **Adaptive LED control** — Pre-tuned growth modes (seedling / vegetative / flowering / fruiting), custom color & brightness, schedule, auto-adjust toggle, and an energy-usage barchart per device.
- 📈 **Data analytics** — Daily Growth Index comparison, multi-metric historical trends per device, **CSV** and **PDF** export.
- 🧪 **Research module** — IEEE-style report layout (abstract, sections, tables), client-side **PDF report** export, individual **PPT-ready PNG** chart exports.
- 🛠️ **Admin panel** — Manage devices, acknowledge alerts, browse the audit log, manage users (role + delete).
- 🔐 **JWT auth** — bcrypt password hashing, role-based access (`admin` / `operator` / `viewer`).
- 🌗 **Dark / light mode** with `next-themes`.
- 🧪 **Mock sensor stream** — Background generator emits realistic readings every 5 s while running.
- 📦 **Docker Compose** spins up Postgres + backend + frontend with a single command.

## Project layout

```
aquagrow/
├── backend/              Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── config/        env loader
│   │   ├── db/            pool, migrations, schema.sql, seed
│   │   ├── middleware/    auth + error handlers
│   │   ├── routes/        auth, devices, sensors, led, analytics, alerts, logs, users, research
│   │   ├── services/      mock sensors, audit
│   │   └── utils/         jwt, logger
│   └── Dockerfile
├── frontend/             Next.js 14 + Tailwind + Recharts
│   ├── src/
│   │   ├── app/           login, register, dashboard, led, analytics, research, admin
│   │   ├── components/    AppShell, Sidebar, Topbar, StatCard, ThemeToggle, charts/*
│   │   └── lib/           api client, auth context, theme, format helpers
│   └── Dockerfile
├── docker-compose.yml
├── docs/
│   ├── API.md
│   └── ARCHITECTURE.md
└── README.md
```

## Quickstart

### Option A — Docker Compose (recommended)

```bash
cp .env.example .env
docker compose up --build
# Wait for "AquaGrow backend listening on :4000"
# Then in another shell, seed the demo data:
docker compose exec backend node -e "require('child_process').execSync('node -r ts-node/register src/db/seed.ts', {stdio:'inherit'})" 2>/dev/null \
  || docker compose exec backend npx tsx /app/dist/db/seed.js  # auto-fallback
```

> Note: the container automatically applies `schema.sql` on first start. To seed demo data
> (4 devices + 14 days of history + sample alerts), run `npm run seed` against the running DB
> (see below) or use the dev workflow.

Open <http://localhost:3000>. Demo credentials:

| Role     | Email                       | Password      |
|----------|-----------------------------|---------------|
| admin    | `admin@aquagrow.local`      | `admin123`    |
| operator | `operator@aquagrow.local`   | `operator123` |
| viewer   | `viewer@aquagrow.local`     | `viewer123`   |

### Option B — Local dev (without Docker)

You'll need Node.js 20+, npm, and a running Postgres 16.

```bash
# 1) start Postgres (any way you like)
docker run -d --name aquagrow-pg -e POSTGRES_USER=aquagrow -e POSTGRES_PASSWORD=aquagrow \
  -e POSTGRES_DB=aquagrow -p 5432:5432 postgres:16-alpine

# 2) backend
cd backend
cp ../.env.example .env
sed -i 's/POSTGRES_HOST=postgres/POSTGRES_HOST=localhost/' .env
npm install
npm run migrate   # apply schema.sql
npm run seed      # seed demo data
npm run dev       # API on :4000

# 3) frontend (in a second terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev       # UI on :3000
```

## Environment variables

See [`.env.example`](.env.example). Key vars:

| Var | Purpose |
|-----|---------|
| `POSTGRES_HOST/PORT/USER/PASSWORD/DB` | Postgres connection. Inside Docker the host is `postgres`. |
| `PORT` | Backend listen port (default 4000). |
| `JWT_SECRET` | **Change in production**. Used to sign auth tokens. |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`). |
| `CORS_ORIGIN` | Comma-separated allowed origins. |
| `MOCK_SENSORS` | `true` enables the in-process sensor generator. |
| `MOCK_INTERVAL_MS` | Mock sample interval (default 5000). |
| `NEXT_PUBLIC_API_URL` | Frontend → backend base URL. |

## Scripts

```bash
# backend
npm run dev        # tsx watch
npm run build      # tsc → dist/
npm run start      # node dist/index.js
npm run migrate    # apply schema.sql
npm run seed       # 14 days of mock history
npm run lint       # tsc --noEmit

# frontend
npm run dev        # Next.js dev (port 3000)
npm run build      # next build (standalone)
npm run start      # next start
npm run typecheck
npm run lint       # next lint
```

## API

See [`docs/API.md`](docs/API.md) for the full reference. A few useful curls:

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@aquagrow.local","password":"admin123"}' | jq -r .token)

curl -s -H "Authorization: Bearer $TOKEN" localhost:4000/api/sensors/latest | jq
curl -s -H "Authorization: Bearer $TOKEN" "localhost:4000/api/analytics/export.csv?days=7" > sensors.csv
curl -s -H "Authorization: Bearer $TOKEN" "localhost:4000/api/analytics/export.pdf?days=7" > report.pdf
```

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the component diagram, module
responsibilities, the auth flow, and how the adaptive LED + mock sensor systems work.

## Database schema

See [`backend/src/db/schema.sql`](backend/src/db/schema.sql) for the source of truth:

- `users` (with roles), `devices`, `sensor_readings` (time-series indexed),
- `led_configs`, `led_energy_log`,
- `alerts` (severity + acknowledge), `system_logs` (audit),
- `growth_index` (daily GI per device).

## License

MIT.
