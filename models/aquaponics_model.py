"""
models/aquaponics_model.py
Core mathematical models for AquaGrow IoT Simulation Dashboard.
Based on: Touliatos et al. 2016, Love et al. 2015, Rakocy et al. 2006.
"""

import numpy as np
from scipy.integrate import odeint
from dataclasses import dataclass, field
from typing import Tuple

# ── Optimal ranges ────────────────────────────────────────────────────────────
OPTIMAL = {
    "temp_C":      (22.0, 30.0),
    "pH":          (6.5,  7.5),
    "ec_mS":       (0.5,  2.0),
    "do_mg":       (5.5,  8.5),
    "turbidity":   (0.0,  25.0),
    "light_klux":  (20.0, 45.0),
    "co2_ppm":     (600.0,1300.0),
    "humidity":    (50.0, 80.0),
    "ammonia_ppm": (0.0,  0.75),
    "nitrate_ppm": (5.0,  150.0),
}

CROP_BASE_YIELD = {
    "Lettuce": 4.3,
    "Spinach": 3.8,
    "Basil":   4.1,
    "Kale":    3.5,
    "Tomato":  3.2,
}

FISH_METRICS = {
    "Tilapia": {
        "optimal_temp_C":         (26.0, 30.0),
        "biomass_gain_pct_month": 10.0,
        "feed_conversion_ratio":  1.4,
        "min_viable_do_mg":       4.0,
        "max_safe_ammonia_ppm":   1.5,
        "max_safe_temp_C":        35.0,
        "stocking_density_kg_m3": 22.0,
    }
}

SENSOR_CONFIG = {
    "pH":        {"val": 7.0,   "noise": 0.04,  "drift": 0.002, "spike": 0.02, "unit": "pH",    "min": 5.5, "max": 9.0},
    "temp_C":    {"val": 27.0,  "noise": 0.30,  "drift": 0.010, "spike": 0.01, "unit": "°C",    "min": 15,  "max": 40},
    "ec_mS":     {"val": 1.2,   "noise": 0.04,  "drift": 0.003, "spike": 0.02, "unit": "mS/cm", "min": 0.1, "max": 4.0},
    "do_mg":     {"val": 7.0,   "noise": 0.15,  "drift": 0.005, "spike": 0.03, "unit": "mg/L",  "min": 0,   "max": 15},
    "turbidity": {"val": 8.0,   "noise": 0.80,  "drift": 0.015, "spike": 0.04, "unit": "NTU",   "min": 0,   "max": 200},
    "co2_ppm":   {"val": 920.0, "noise": 20.0,  "drift": 0.500, "spike": 0.02, "unit": "ppm",   "min": 300, "max": 2000},
}


@dataclass
class SystemState:
    time_h:          float = 0.0
    temp_C:          float = 27.0
    pH:              float = 7.0
    ec_mS:           float = 1.2
    do_mg:           float = 7.0
    turbidity:       float = 8.0
    light_klux:      float = 30.0
    co2_ppm:         float = 920.0
    humidity:        float = 65.0
    ammonia_ppm:     float = 0.22
    nitrate_ppm:     float = 45.0
    nitrite_ppm:     float = 0.04
    water_level_cm:  float = 80.0
    fish_biomass_kg: float = 5.0
    plant_mass_g:    float = 200.0
    pump_on:         bool  = True
    nutrient_dose_mL:float = 0.0


def _bell(val, lo, hi, sig=0.45):
    mid   = (lo + hi) / 2.0
    sigma = (hi - lo) * sig
    return float(np.exp(-0.5 * ((val - mid) / sigma) ** 2))


def stress_factor(state: SystemState) -> dict:
    opt = OPTIMAL
    return {
        "Temp":      _bell(state.temp_C,    *opt["temp_C"],     0.45),
        "pH":        _bell(state.pH,         *opt["pH"],         0.40),
        "EC":        _bell(state.ec_mS,      *opt["ec_mS"],      0.45),
        "DO":        _bell(state.do_mg,      *opt["do_mg"],      0.45),
        "Light":     _bell(state.light_klux, *opt["light_klux"], 0.45),
        "CO2":       _bell(state.co2_ppm,    *opt["co2_ppm"],    0.45),
        "Ammonia":   max(0.0, 1.0 - state.ammonia_ppm / 2.0),
        "Turbidity": max(0.0, 1.0 - state.turbidity / 200.0),
    }


def fish_stress_factor(state: SystemState) -> dict:
    fm = FISH_METRICS["Tilapia"]
    return {
        "Temp":    _bell(state.temp_C, *fm["optimal_temp_C"], 0.40),
        "DO":      max(0.0, (state.do_mg - fm["min_viable_do_mg"]) / 4.5),
        "Ammonia": max(0.0, 1.0 - state.ammonia_ppm / fm["max_safe_ammonia_ppm"]),
        "pH":      _bell(state.pH, 6.5, 8.5, 0.40),
    }


def growth_index(state: SystemState) -> float:
    sf = list(stress_factor(state).values())
    return round(float(np.prod(sf) ** (1.0 / len(sf))), 4)


def fish_growth_index(state: SystemState) -> float:
    sf = list(fish_stress_factor(state).values())
    return round(float(np.prod(sf) ** (1.0 / len(sf))), 4)


def projected_yield(state: SystemState, crop="Lettuce") -> float:
    if crop not in CROP_BASE_YIELD:
        return 0.0
    return round(CROP_BASE_YIELD[crop] * growth_index(state), 3)


def projected_fish_gain(state: SystemState) -> float:
    fgi = fish_growth_index(state)
    pct = FISH_METRICS["Tilapia"]["biomass_gain_pct_month"] / 100.0
    return round(state.fish_biomass_kg * pct * fgi, 3)


def harvest_days(state: SystemState) -> int:
    return int(round(28.0 / max(0.05, growth_index(state))))


# ── Nitrogen cycle ODE ────────────────────────────────────────────────────────
def _nitrogen_odes(y, t, fish_kg, gi):
    nh4 = max(0, y[0]); no2 = max(0, y[1]); no3 = max(0, y[2])
    exc = fish_kg * 0.015
    return [exc - 0.08*nh4, 0.08*nh4 - 0.12*no2, 0.12*no2 - 0.04*no3*gi]


def simulate_nitrogen_cycle(hours=72, fish_kg=5.0, gi=0.85):
    t   = np.linspace(0, hours, hours * 4)
    sol = odeint(_nitrogen_odes, [0.3, 0.05, 40.0], t, args=(fish_kg, gi))
    return t, sol


# ── Plant growth (Verhulst logistic) ─────────────────────────────────────────
def _plant_ode(y, t, gi, K=800.0):
    P = max(0, y[0])
    return [0.04 * gi * P * (1.0 - P / K)]


def simulate_plant_growth(days=35, initial_g=10.0, gi=0.85):
    t   = np.linspace(0, days, days * 24)
    sol = odeint(_plant_ode, [initial_g], t, args=(gi,))
    return t, sol[:, 0]


# ── Sensor noise + Kalman ─────────────────────────────────────────────────────
def _kalman(z, q, r):
    n = len(z); x = np.zeros(n); P = 1.0; x[0] = z[0]
    for k in range(1, n):
        Pp = P + q; K = Pp / (Pp + r)
        x[k] = x[k-1] + K * (z[k] - x[k-1]); P = (1-K)*Pp
    return x


def simulate_sensor_readings(sensor="pH", hours=48, dt_min=5.0):
    cfg = SENSOR_CONFIG[sensor]
    n   = int(hours * 60 / dt_min)
    t   = np.arange(n) * dt_min
    true_s = cfg["val"] + np.cumsum(np.random.randn(n) * cfg["drift"] * dt_min / 60.0)
    noise  = np.random.randn(n) * cfg["noise"]
    spikes = (np.random.rand(n) < cfg["spike"]) * np.random.randn(n) * cfg["noise"] * 5
    raw    = np.clip(true_s + noise + spikes, cfg["min"], cfg["max"])
    filt   = _kalman(raw, cfg["noise"] * 0.01, cfg["noise"])
    return t, raw, filt


# ── Monte Carlo ───────────────────────────────────────────────────────────────
def monte_carlo_yield(n=500, crop="Lettuce", noise=0.10):
    rng = np.random.default_rng(42)
    base = SystemState()
    yields = []
    for _ in range(n):
        s = SystemState(
            temp_C      = max(15, base.temp_C     * (1 + rng.normal(0, noise))),
            pH          = max(5.5, min(9, base.pH * (1 + rng.normal(0, 0.04)))),
            ec_mS       = max(0.2, base.ec_mS     * (1 + rng.normal(0, noise))),
            do_mg       = max(1.0, base.do_mg     * (1 + rng.normal(0, noise))),
            light_klux  = max(5,   base.light_klux* (1 + rng.normal(0, noise))),
            co2_ppm     = max(300, base.co2_ppm   * (1 + rng.normal(0, noise))),
            ammonia_ppm = max(0,   base.ammonia_ppm + rng.normal(0, 0.06)),
            turbidity   = max(0,   base.turbidity  + rng.normal(0, 2.5)),
        )
        yields.append(projected_yield(s, crop))
    return np.array(sorted(yields))


# ── Sensitivity tornado ───────────────────────────────────────────────────────
def sensitivity_tornado(state: SystemState, delta=0.15):
    params = {
        "pH":           "pH",
        "Temp (°C)":    "temp_C",
        "EC (mS/cm)":   "ec_mS",
        "Light (klux)": "light_klux",
        "CO2 (ppm)":    "co2_ppm",
        "DO (mg/L)":    "do_mg",
        "Ammonia":      "ammonia_ppm",
    }
    base_y = projected_yield(state)
    results = {}
    for label, attr in params.items():
        val = getattr(state, attr)
        lo_s = SystemState(**state.__dict__)
        hi_s = SystemState(**state.__dict__)
        setattr(lo_s, attr, val * (1 - delta))
        setattr(hi_s, attr, val * (1 + delta))
        lo_pct = (projected_yield(lo_s) - base_y) / (base_y + 1e-9) * 100
        hi_pct = (projected_yield(hi_s) - base_y) / (base_y + 1e-9) * 100
        results[label] = (round(lo_pct, 2), round(hi_pct, 2))
    return dict(sorted(results.items(), key=lambda x: abs(x[1][1]-x[1][0]), reverse=True))
