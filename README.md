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
