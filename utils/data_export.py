"""utils/data_export.py — CSV export for simulation results."""

import csv, os
from datetime import datetime
from models import (
    SystemState, growth_index, fish_growth_index, projected_yield,
    projected_fish_gain, harvest_days, simulate_nitrogen_cycle,
    simulate_plant_growth, monte_carlo_yield, CROP_BASE_YIELD,
)


def export_state_csv(state: SystemState, out_dir="data") -> str:
    os.makedirs(out_dir, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = os.path.join(out_dir, f"aquagrow_state_{ts}.csv")
    gi   = growth_index(state)
    fgi  = fish_growth_index(state)
    rows = [
        ["=== AquaGrow System Export ===", f"Exported: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"],
        [],
        ["SENSOR READINGS", "Value", "Unit"],
        ["Temperature",     state.temp_C,         "°C"],
        ["pH",              state.pH,              ""],
        ["EC",              state.ec_mS,           "mS/cm"],
        ["Dissolved O2",    state.do_mg,           "mg/L"],
        ["Turbidity",       state.turbidity,       "NTU"],
        ["Light",           state.light_klux,      "klux"],
        ["CO2",             state.co2_ppm,         "ppm"],
        ["Humidity",        state.humidity,        "%RH"],
        ["Ammonia NH4",     state.ammonia_ppm,     "ppm"],
        ["Fish Biomass",    state.fish_biomass_kg, "kg"],
        [],
        ["DERIVED METRICS", "Value", "Unit"],
        ["Plant Growth Index",  gi,                          "0-1"],
        ["Fish Growth Index",   fgi,                         "0-1"],
        ["Harvest Estimate",    harvest_days(state),         "days"],
        ["Fish Monthly Gain",   projected_fish_gain(state),  "kg"],
        [],
        ["CROP YIELDS (projected)", "kg/m²/month"],
    ]
    for crop in CROP_BASE_YIELD:
        rows.append([crop, round(projected_yield(state, crop), 3)])
    with open(path, "w", newline="") as f:
        csv.writer(f).writerows(rows)
    return path


def export_nitrogen_csv(fish_kg=5.0, gi=0.85, hours=72, out_dir="data") -> str:
    os.makedirs(out_dir, exist_ok=True)
    t, sol = simulate_nitrogen_cycle(hours, fish_kg, gi)
    path   = os.path.join(out_dir, f"nitrogen_cycle_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time_h", "NH4_ppm", "NO2_ppm", "NO3_ppm"])
        for i in range(len(t)):
            w.writerow([round(t[i],3), round(sol[i,0],4), round(sol[i,1],4), round(sol[i,2],4)])
    return path


def export_growth_csv(days=35, gi=0.85, out_dir="data") -> str:
    os.makedirs(out_dir, exist_ok=True)
    t, mass = simulate_plant_growth(days, 10.0, gi)
    path    = os.path.join(out_dir, f"plant_growth_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["day", "plant_mass_g"])
        for i in range(0, len(t), 24):
            w.writerow([round(t[i],2), round(mass[i],2)])
    return path
