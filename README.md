# AquaGrow Smart Farming Dashboard

A full-stack, production-ready monitoring platform for aquaponic / hydroponic deployments.
Real-time multi-sensor dashboards, adaptive LED control, growth-index analytics with CSV/PDF export,
an IEEE-style research module with publication-quality exports, and an admin panel for devices /
alerts / logs / users.

> The web platform lives in [`backend/`](backend/) (Node + Express) and [`frontend/`](frontend/)
> (Next.js). The companion CustomTkinter desktop simulator (`main.py`, `models/`, `ui/`, …) used
> for offline experimentation remains at the repo root. See the original
> [AquaGrow IoT Simulation Dashboard](#aquagrow-iot-simulation-dashboard) notes at the bottom of
> this document for that workflow.

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

---

# AquaGrow IoT Simulation Dashboard
### NITC MED — B.Tech Project 2026
**Dr. Ratna Kumar K  ·  Manas N  ·  Deepak Sabariraj S  ·  Nisantthan S T  ·  Athul Rag R  ·  Tejavath Varma**

---

## What This Is

A fully interactive desktop dashboard for the AquaGrow aquaponics simulation. Built with Python, CustomTkinter (modern UI), and Matplotlib (charts). All mathematical models run locally — no internet required after setup.

---

## Quick Start

### Windows
1. Install **Python 3.9+** from https://python.org  
   ✅ Check **"Add Python to PATH"** during installation
2. Double-click **`setup.bat`** — installs all dependencies
3. Double-click **`run.bat`** — launches the dashboard

### Mac / Linux
```bash
chmod +x setup.sh run.sh
./setup.sh     # install dependencies
./run.sh       # launch dashboard
```

### Manual (any OS)
```bash
pip install customtkinter matplotlib numpy scipy Pillow
python main.py
```

---

## System Requirements

| Item | Minimum |
|------|---------|
| Python | 3.9 or newer |
| RAM | 512 MB free |
| Display | 1280 × 720 |
| OS | Windows 10/11, macOS 11+, Ubuntu 20.04+ |

---

## Dashboard Tabs

| Tab | What It Shows |
|-----|---------------|
| **Nitrogen Cycle** | 72-hour ODE simulation (NH4→NO2→NO3) with equilibrium readout |
| **Plant Growth** | 35-day Verhulst logistic curves for all 5 crops |
| **Sensitivity** | Tornado chart — ±15% parameter sensitivity sweep |
| **Monte Carlo** | 500-sample yield distribution histogram (P10/P90) |
| **Kalman Filter** | Raw vs filtered sensor noise simulation (select sensor) |
| **Yields** | Per-crop projected yield bars + Tilapia fish metrics |
| **AI Engine** | Real-time rule-based recommendations (updates with sliders) |
| **Data Log** | Export CSV files + timestamped activity log |

---

## Left Panel — Sensor Sliders

Drag any slider to change a sensor reading. **All charts and GI values update instantly.**

| Slider | Range | Unit |
|--------|-------|------|
| Water Temp | 15–40 | °C |
| pH | 5.5–9.0 | pH |
| EC / Nutrients | 0.1–3.0 | mS/cm |
| Dissolved O2 | 0–12 | mg/L |
| Ammonia NH4 | 0–3.0 | ppm |
| Turbidity | 0–200 | NTU |
| Light | 0–70 | klux |
| CO2 | 300–2000 | ppm |
| Humidity | 20–100 | %RH |
| Fish Biomass | 1–30 | kg |

---

## Scenario Buttons (Top Bar)

| Button | Scenario |
|--------|----------|
| Optimal | Fully climate-controlled indoor, 27°C, optimal conditions |
| Monsoon | Kerala monsoon — high humidity, turbidity, low light |
| Summer | Peak summer heat — fish heat stress, DO crash risk |
| Power | Power outage — pump offline, DO dropping, UPS engaged |

Click any scenario to load all sensor values + AI action list instantly.

---

## Exported CSV Files

All exports go to the `data/` folder inside this directory.

- `aquagrow_state_YYYYMMDD_HHMMSS.csv` — current sensor + derived metrics
- `nitrogen_cycle_YYYYMMDD_HHMMSS.csv` — 72h NH4/NO2/NO3 time series
- `plant_growth_YYYYMMDD_HHMMSS.csv` — 35-day plant mass data

---

## Mathematical Models

| Model | Method | Source |
|-------|--------|--------|
| Plant Growth Index | Geometric mean of 8 bell-curve stress factors | Love et al. 2015 |
| Fish Growth Index | Geometric mean of 4 tilapia stress factors | FISH_METRICS data |
| Nitrogen Cycle | ODE system, 4th-order Runge-Kutta | Rakocy et al. 2006 |
| Plant Growth | Verhulst logistic dP/dt = r·P·(1-P/K) | Touliatos et al. 2016 |
| Sensor Noise | Gaussian + drift + spike model | Sensor datasheets |
| Kalman Filter | 1D predict-update cycle | Standard Kalman 1960 |
| Monte Carlo | 500 samples with ±10% parameter noise | Statistics |
| Sensitivity | ±15% tornado sweep on each parameter | Sensitivity analysis |

---

## File Structure

```
AquaGrow_Dashboard/
├── main.py               ← Entry point
├── requirements.txt      ← Python packages needed
├── setup.bat             ← Windows setup
├── run.bat               ← Windows launch
├── setup.sh              ← Mac/Linux setup
├── run.sh                ← Mac/Linux launch
├── models/
│   ├── aquaponics_model.py   ← All math models
│   └── scenario_engine.py    ← Scenarios + AI rules
├── ui/
│   └── app.py            ← Full dashboard GUI
├── utils/
│   └── data_export.py    ← CSV export functions
└── data/                 ← Exported CSV files go here
```

---

*AquaGrow © 2026  |  NITC MED  |  Department of Mechanical Engineering  |  NIT Calicut*
