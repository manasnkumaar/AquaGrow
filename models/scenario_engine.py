"""models/scenario_engine.py — Real-world scenarios and AI engine."""

from dataclasses import dataclass
from typing import List
from models.aquaponics_model import (
    SystemState, growth_index, fish_growth_index,
    projected_yield, projected_fish_gain, stress_factor,
)


@dataclass
class Scenario:
    name:        str
    description: str
    state:       SystemState
    actions:     List[str]
    color:       str = "#3B8BD4"


SCENARIOS = {
    "Optimal Indoor": Scenario(
        name="Optimal Indoor",
        description="Fully climate-controlled indoor setup. AC at 27°C — aquaponics compromise between fish (26-30°C) and plant (20-24°C) optima. LED at 30 klux, automated dosing. System efficiency >92%.",
        state=SystemState(temp_C=27, pH=7.0, ec_mS=1.2, do_mg=7.2, light_klux=30, co2_ppm=950, humidity=65, ammonia_ppm=0.20, turbidity=8, fish_biomass_kg=5),
        actions=["All systems nominal — no interventions required", "Nutrient dosing on schedule (next dose in 4h)", "AI harvest prediction: Lettuce ready in 28 days", "Fish health: excellent (temp 27°C, DO 7.2 mg/L)", "Water change: 10% weekly scheduled (Sunday 08:00)", "System efficiency: 92% — above commercial benchmark"],
        color="#3B8BD4",
    ),
    "Monsoon (Kerala)": Scenario(
        name="Monsoon (Kerala)",
        description="Heavy rainfall, humidity 85-95% RH, temp 28-32°C, overcast skies reduce light to ~15 klux. Risks: algae bloom, pH drop from rainwater dilution, waterlogging of substrate.",
        state=SystemState(temp_C=30, pH=6.6, ec_mS=1.0, do_mg=7.2, light_klux=15, co2_ppm=850, humidity=90, ammonia_ppm=0.35, turbidity=40, fish_biomass_kg=5),
        actions=["Supplemental LED grow lights activated (auto)", "Water inlet valve closed — flood risk detected", "pH dosing pump scheduled: +0.4 pH correction", "Aeration pump duty increased to 85%", "ALERT: Turbidity HIGH — inspect biofilter", "ALERT: Algae risk HIGH — reduce photoperiod by 1h"],
        color="#1D9E75",
    ),
    "Summer Heat": Scenario(
        name="Summer Heat",
        description="Peak summer Kerala: 35-40°C ambient, low humidity 40% RH, intense sunlight 50 klux. Risks: tilapia heat stress above 32°C, rapid evaporation (-2L/h), DO crash as O₂ solubility drops.",
        state=SystemState(temp_C=36, pH=7.1, ec_mS=1.4, do_mg=5.8, light_klux=50, co2_ppm=720, humidity=40, ammonia_ppm=0.45, turbidity=10, fish_biomass_kg=5),
        actions=["Cooling fan + evaporative cooler activated (auto)", "50% shade cloth deployed over grow beds", "Aeration pump at 100% duty cycle — DO critical", "Water top-up valve opened (evaporation loss 2L/h)", "CRITICAL: Fish temp 36°C — mortality risk above 35°C", "Reduce feeding by 40% to lower ammonia load"],
        color="#D85A30",
    ),
    "Power Outage": Scenario(
        name="Power Outage",
        description="Mains power lost. UPS battery active (4-6h capacity). Grow lights offline. Main pump offline — passive flow only. CRITICAL: fish need aeration within 30 min of pump failure.",
        state=SystemState(temp_C=27, pH=7.0, ec_mS=1.2, do_mg=6.2, light_klux=2, co2_ppm=600, humidity=68, ammonia_ppm=0.22, turbidity=10, pump_on=False, fish_biomass_kg=5),
        actions=["ALERT: Mains power offline — UPS engaged", "PRIORITY: Battery aeration pump running (fish safety)", "Grow lights offline — no photosynthesis", "Dashboard in offline mode (local SD logging active)", "CRITICAL: Restore power within 4h for fish survival", "DO trending down: 6.2 mg/L — check every 30 min"],
        color="#BA7517",
    ),
}


def ai_recommendations(state: SystemState) -> List[str]:
    recs = []
    gi  = growth_index(state)
    fgi = fish_growth_index(state)

    if state.pH < 6.5:
        recs.append(f"⚠ pH LOW ({state.pH:.2f}) — Dose KOH: ~{abs(7.0-state.pH)*10*2:.0f} mL")
    elif state.pH > 7.5:
        recs.append(f"⚠ pH HIGH ({state.pH:.2f}) — Add phosphoric acid: ~{(state.pH-7.0)*8:.0f} mL")
    else:
        recs.append(f"✓ pH nominal ({state.pH:.2f}) — no action needed")

    if state.temp_C > 35:
        recs.append(f"🚨 TEMP CRITICAL ({state.temp_C:.1f}°C) — FISH MORTALITY RISK. Activate chiller NOW.")
    elif state.temp_C > 32:
        recs.append(f"⚠ Temp HIGH ({state.temp_C:.1f}°C) — Activate cooling fan, reduce light by 1h")
    elif state.temp_C < 22:
        recs.append(f"⚠ Temp LOW ({state.temp_C:.1f}°C) — Increase heater setpoint to 26°C")
    else:
        recs.append(f"✓ Temperature acceptable ({state.temp_C:.1f}°C) — plants near-optimal")

    if state.do_mg < 4.0:
        recs.append(f"🚨 DO CRITICAL ({state.do_mg:.1f} mg/L) — FISH MORTALITY RISK. Emergency aeration!")
    elif state.do_mg < 6.0:
        recs.append(f"⚠ DO LOW ({state.do_mg:.1f} mg/L) — Increase aeration pump to 100%")
    else:
        recs.append(f"✓ Dissolved oxygen good ({state.do_mg:.1f} mg/L)")

    if state.ec_mS < 0.5:
        recs.append(f"⚠ EC LOW ({state.ec_mS:.2f}) — Add 30 mL nutrient concentrate A+B")
    elif state.ec_mS > 2.0:
        recs.append(f"⚠ EC HIGH ({state.ec_mS:.2f}) — Dilute: add 10% RO water")
    else:
        recs.append(f"✓ EC nominal ({state.ec_mS:.2f} mS/cm) — aquaponics range")

    if state.light_klux < 15:
        recs.append("⚠ Light LOW — Activate full-spectrum LED grow lights")
    elif state.light_klux > 50:
        recs.append("⚠ Light HIGH — Deploy 40% shade cloth (heat stress risk)")
    else:
        recs.append(f"✓ Light nominal ({state.light_klux:.0f} klux)")

    if state.ammonia_ppm > 1.0:
        recs.append(f"🚨 Ammonia HIGH ({state.ammonia_ppm:.2f} ppm) — Stop feeding, check biofilter immediately")
    elif state.ammonia_ppm > 0.5:
        recs.append(f"⚠ Ammonia elevated ({state.ammonia_ppm:.2f} ppm) — Reduce feeding by 30%")
    else:
        recs.append(f"✓ Ammonia acceptable ({state.ammonia_ppm:.2f} ppm)")

    days = int(round(28.0 / max(gi, 0.05)))
    recs.append(f"🌿 Plant harvest: ~{days} days  (Plant GI = {gi:.3f})")
    recs.append(f"🐟 Fish health: {fgi:.3f}  |  Monthly gain: +{projected_fish_gain(state):.2f} kg")

    return recs
