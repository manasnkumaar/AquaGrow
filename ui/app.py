"""
AquaGrow — Redesigned Dashboard  v3.0
Clean, spacious layout · large fonts · radar chart · reference-matched design
Autonomous IoT Digital Twin
"""
import customtkinter as ctk
import matplotlib
matplotlib.use("TkAgg")
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import threading, time, os, csv, math
from datetime import datetime
from tkinter import messagebox
from collections import deque

from models import (
    SystemState, stress_factor, fish_stress_factor,
    growth_index, fish_growth_index, projected_yield,
    projected_fish_gain, harvest_days, CROP_BASE_YIELD,
    simulate_nitrogen_cycle, simulate_plant_growth,
    simulate_sensor_readings, monte_carlo_yield, sensitivity_tornado,
)
from models.scenario_engine import SCENARIOS, ai_recommendations
from utils.data_export import export_state_csv, export_nitrogen_csv, export_growth_csv

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")

# ── PALETTE ───────────────────────────────────────────────────────────────────
BG    = "#0d1117";  SURF  = "#161b22";  CARD  = "#1c2128"
CARD2 = "#21262d";  ACC   = "#58a6ff";  ACC2  = "#1f6feb"
TXT   = "#e6edf3";  TXT2  = "#8b949e";  MUTED = "#30363d"
GREEN = "#3fb950";  ORANGE= "#d29922";  RED   = "#f85149"
PURPLE= "#bc8cff";  TEAL  = "#39d353";  WARN  = "#e3b341"
FISH  = "#79c0ff";  PINK  = "#f778ba"

for k,v in {
    "figure.facecolor":BG,"axes.facecolor":CARD,"axes.edgecolor":MUTED,
    "axes.labelcolor":TXT2,"xtick.color":TXT2,"ytick.color":TXT2,
    "text.color":TXT,"grid.color":MUTED,"grid.alpha":0.3,
    "axes.spines.top":False,"axes.spines.right":False,
    "legend.facecolor":CARD2,"legend.edgecolor":MUTED,"legend.labelcolor":TXT2,
    "font.family":"DejaVu Sans","font.size":10,
}.items():
    try: plt.rcParams[k]=v
    except: pass

# ── FONT HELPERS (no italic in weight) ────────────────────────────────────────
def F(sz=12, bold=False):  return ctk.CTkFont("Helvetica", sz, "bold" if bold else "normal")
def FM(sz=12, bold=False): return ctk.CTkFont("Courier New", sz, "bold" if bold else "normal")

PLANT_STAGES = ["Germination","Seedling","Vegetative","Rapid Growth","Pre-Harvest","Harvest Ready"]

COLOUR_CHANNELS = {
    "blue": {"hex":"#1a50c0","nm":"400-500 nm","effect":"Cryptochrome activation — compact root growth, prevents etiolation"},
    "red":  {"hex":"#b00000","nm":"620-700 nm","effect":"Phytochrome Pfr — biomass, flowering, pre-harvest sugar loading"},
    "green":{"hex":"#155a28","nm":"500-570 nm","effect":"Canopy penetration — reaches lower leaves"},
    "black":{"hex":"#2a2a2a","nm":"0 nm shade", "effect":"Blocks 80%+ solar heat — mandatory night dark period"},
    "clear":{"hex":"#9fd8ef","nm":"Full spectrum","effect":"Natural balanced — overcast days, root crops"},
}

DAY_SCHEDULE = [
    (6,"blue","Dawn — Blue channel (cryptochrome, root development)"),
    (9,"red","Morning — Red channel (peak photosynthesis, biomass)"),
    (11,"black","Midday — Black shade (block heat, -8°C inside)"),
    (15,"red","Afternoon — Red channel (post-peak photosynthesis)"),
    (18,"red","Evening — Red LED (pre-harvest sugar loading)"),
    (20,"black","Night — All channels OFF (dark respiration, hormones)"),
]

# ══════════════════════════════════════════════════════════════════════════════
class AquaGrowApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("AquaGrow  ·  Autonomous IoT Digital Twin  v3.0")
        self.geometry("1440x860")
        self.minsize(1280, 720)
        self.configure(fg_color=BG)

        # ── all instance attrs before any build ──────────────────────────────
        self.sys           = SystemState()
        self.running       = False
        self.autonomous    = False
        self.sim_day       = 0
        self.sim_hour      = 6.0
        self.sim_speed     = 4
        self.plant_days    = 0
        self.plant_stage   = 0
        self.active_ch     = "blue"
        self.energy_kwh    = 0.0
        self.water_L       = 0.0
        self.alerts        = []
        self._sliders      = {}
        self._sv           = {}
        self._last_refresh = 0.0
        self._last_log_t   = 0.0
        self._csv_file     = None
        self._csv_writer   = None
        self._alert_widgets= []
        self._ai_labels    = []
        self._act_labels   = []
        self._gip_big      = None
        self._gif_big      = None
        self._stage_pb     = None

        N = 300
        self._hist = {k: deque([0.0]*N, maxlen=N) for k in
                      ["temp_C","pH","ec_mS","do_mg","ammonia_ppm","gi","fgi","energy","water_used"]}

        # StringVars
        self._gip_var         = ctk.StringVar(value="0.000")
        self._gif_var         = ctk.StringVar(value="0.000")
        self._gip_lbl         = ctk.StringVar(value="---")
        self._gif_lbl         = ctk.StringVar(value="---")
        self._harvest_var     = ctk.StringVar(value="--")
        self._stage_var       = ctk.StringVar(value="Germination")
        self._day_var         = ctk.StringVar(value="Day 0")
        self._clock_var       = ctk.StringVar(value="Day 0  06:00")
        self._ch_name_var     = ctk.StringVar(value="BLUE")
        self._ch_nm_var       = ctk.StringVar(value="400-500 nm")
        self._ch_eff_var      = ctk.StringVar(value="---")
        self._ch_active_var   = ctk.StringVar(value="BLUE — 400-500 nm")
        self._ch_rec_var      = ctk.StringVar(value="---")
        self._sc_name_var     = ctk.StringVar(value="No scenario loaded")
        self._sc_desc_var     = ctk.StringVar(value="")
        self._alert_count_var = ctk.StringVar(value="0 alerts")
        self._amode           = ctk.StringVar(value="24h Trends")
        self._kal_s           = ctk.StringVar(value="pH")
        self._kal_info        = ctk.StringVar(value="RMSE: ---")
        self._pred_vars       = {k: ctk.StringVar(value="---") for k in ("harvest","yield","fish_gain","risk")}
        self._nit_vars        = {k: ctk.StringVar(value="---") for k in ("nh4","no2","no3","bio")}
        self._nitr            = {k: ctk.StringVar(value="---") for k in ("nh4r","no2r","no3r")}
        self._energy_vars     = {k: ctk.StringVar(value="0.0") for k in ("kwh","water","saved","co2","nut","eff")}
        self._scards          = {}
        self._sf_bars         = {}
        self._acts            = {}

        self._speed_var = ctk.StringVar(value="4x")
        self._build_ui()
        self._init_csv()
        self._refresh_all()
        self._start_clock()

    # ══════════════════════════════════════════════════════════════════════════
    # TOP BAR
    # ══════════════════════════════════════════════════════════════════════════
    def _build_ui(self):
        self._build_topbar()
        body = ctk.CTkFrame(self, fg_color=BG)
        body.pack(fill="both", expand=True)

        # Left sidebar — fixed 300px
        self._left = ctk.CTkFrame(body, width=300, fg_color=SURF, corner_radius=0)
        self._left.pack(side="left", fill="y")
        self._left.pack_propagate(False)

        # Center — all tabs
        center = ctk.CTkFrame(body, fg_color=BG)
        center.pack(side="left", fill="both", expand=True)

        self._build_sidebar()
        self._build_tabs(center)

    def _build_topbar(self):
        bar = ctk.CTkFrame(self, fg_color=SURF, height=58, corner_radius=0)
        bar.pack(fill="x", side="top")
        bar.pack_propagate(False)

        # Logo
        logo = ctk.CTkFrame(bar, fg_color="transparent")
        logo.pack(side="left", padx=20, pady=8)
        ctk.CTkLabel(logo, text="🌿  AQUAGROW", font=F(20, True), text_color=GREEN).pack(anchor="w")
        ctk.CTkLabel(logo, text="Portable Integrated Farming", font=F(11), text_color=TXT2).pack(anchor="w")

        # Scenario buttons
        sc_bar = ctk.CTkFrame(bar, fg_color="transparent")
        sc_bar.pack(side="left", padx=16)
        for name, sc in SCENARIOS.items():
            short = {"Optimal Indoor":"Optimal","Monsoon (Kerala)":"Monsoon",
                     "Summer Heat":"Summer","Power Outage":"Outage"}.get(name, name[:7])
            ctk.CTkButton(sc_bar, text=short, width=88, height=32,
                          fg_color=CARD, hover_color=ACC2, text_color=TXT,
                          border_width=1, border_color=MUTED,
                          font=F(11), corner_radius=6,
                          command=lambda n=name: self._load_scenario(n)
                          ).pack(side="left", padx=3)

        # Right controls
        rbar = ctk.CTkFrame(bar, fg_color="transparent")
        rbar.pack(side="right", padx=16)

        # LIVE indicator
        live = ctk.CTkFrame(rbar, fg_color="transparent")
        live.pack(side="right", padx=12)
        ctk.CTkLabel(live, text="●", font=F(14, True), text_color=GREEN).pack(side="left")
        ctk.CTkLabel(live, textvariable=self._clock_var, font=FM(12, True), text_color=TXT2).pack(side="left", padx=4)

        self._auto_btn = ctk.CTkButton(rbar, text="AUTONOMOUS", width=130, height=32,
                                       fg_color=PURPLE, hover_color="#9b59b6",
                                       text_color="white", font=F(11, True),
                                       border_width=0, corner_radius=6,
                                       command=self._toggle_autonomous)
        self._auto_btn.pack(side="right", padx=4)

        self._run_btn = ctk.CTkButton(rbar, text="▶  Start", width=100, height=32,
                                      fg_color=GREEN, hover_color="#2ea043",
                                      text_color="#0d1117", font=F(12, True),
                                      corner_radius=6, command=self._toggle_sim)
        self._run_btn.pack(side="right", padx=4)

        ctk.CTkButton(rbar, text="Export CSV", width=100, height=32,
                      fg_color=CARD, hover_color=ACC2, text_color=TXT,
                      border_width=1, border_color=MUTED,
                      font=F(11), corner_radius=6,
                      command=self._export_all).pack(side="right", padx=4)

        # Speed control
        spd_frame = ctk.CTkFrame(rbar, fg_color=CARD, corner_radius=8)
        spd_frame.pack(side="right", padx=8, pady=8)
        ctk.CTkLabel(spd_frame, text="Speed", font=F(10), text_color=TXT2).pack(side="left", padx=(10,4))
        self._speed_var = ctk.StringVar(value="4x")
        ctk.CTkLabel(spd_frame, textvariable=self._speed_var, font=FM(12, True),
                     text_color=WARN, width=34).pack(side="left")
        for label, spd in [("1x",1),("2x",2),("4x",4),("8x",8),("16x",16),("32x",32)]:
            ctk.CTkButton(spd_frame, text=label, width=36, height=24,
                          fg_color=MUTED, hover_color=ACC2, text_color=TXT,
                          font=F(10), corner_radius=5,
                          command=lambda s=spd, l=label: self._set_speed(s, l)
                          ).pack(side="left", padx=2, pady=4)
        ctk.CTkLabel(spd_frame, text="", width=6).pack(side="left")

    # ══════════════════════════════════════════════════════════════════════════
    # LEFT SIDEBAR — clean spacious sliders
    # ══════════════════════════════════════════════════════════════════════════
    def _build_sidebar(self):
        scroll = ctk.CTkScrollableFrame(self._left, fg_color=SURF,
                                        scrollbar_button_color=MUTED, label_text="")
        scroll.pack(fill="both", expand=True, padx=0, pady=0)

        # Section title
        ctk.CTkLabel(scroll, text="Environmental Parameters",
                     font=F(14, True), text_color=TXT
                     ).pack(pady=(20, 12), padx=20, anchor="w")

        # Sliders — spacious, clear
        SLIDERS = [
            ("temp_C",       "Temperature (°C)",  15,  40, 0.1),
            ("pH",           "pH",                5.5,  9, 0.01),
            ("ec_mS",        "EC (mS/cm)",         0.1, 4, 0.05),
            ("do_mg",        "DO (mg/L)",          0,   12, 0.1),
            ("light_klux",   "Light (klux)",       0,   70, 1),
            ("co2_ppm",      "CO₂ (ppm)",          300,2000,10),
            ("ammonia_ppm",  "Ammonia (ppm)",      0,   3, 0.01),
            ("turbidity",    "Turbidity (NTU)",    0,  200, 1),
        ]
        for attr, label, lo, hi, step in SLIDERS:
            self._add_slider(scroll, attr, label, lo, hi, step)

        # Divider
        ctk.CTkFrame(scroll, height=1, fg_color=MUTED).pack(fill="x", padx=20, pady=(16, 8))

        # Crop selector
        ctk.CTkLabel(scroll, text="Crop", font=F(13, True), text_color=TXT
                     ).pack(padx=20, anchor="w", pady=(4, 6))
        self._crop_var = ctk.StringVar(value="Lettuce")
        ctk.CTkComboBox(scroll, values=list(CROP_BASE_YIELD.keys()),
                        variable=self._crop_var, width=260, height=36,
                        fg_color=CARD, border_color=MUTED, text_color=TXT,
                        button_color=ACC2, font=F(13), dropdown_font=F(12),
                        command=lambda _: self._refresh_all()
                        ).pack(padx=20, pady=(0, 12))

        # Key metrics
        ctk.CTkFrame(scroll, height=1, fg_color=MUTED).pack(fill="x", padx=20, pady=(4, 12))

        for lb, sv, col in [
            ("Crop Yield (kg/m²/mo)", ctk.StringVar(value="0.000"), GREEN),
            ("Plant Growth Index",    ctk.StringVar(value="0.000"), ACC),
            ("Harvest (days)",        ctk.StringVar(value="--"),    WARN),
        ]:
            if lb == "Crop Yield (kg/m²/mo)": self._yield_sv = sv
            elif lb == "Plant Growth Index":   self._gi_sidebar_sv = sv
            else:                              self._harvest_sidebar_sv = sv

            box = ctk.CTkFrame(scroll, fg_color=CARD, corner_radius=8)
            box.pack(fill="x", padx=20, pady=4)
            ctk.CTkLabel(box, text=lb, font=F(11), text_color=TXT2
                         ).pack(padx=14, pady=(10, 2), anchor="w")
            ctk.CTkLabel(box, textvariable=sv, font=FM(28, True), text_color=col
                         ).pack(padx=14, pady=(0, 10), anchor="w")

        # Fish biomass
        ctk.CTkFrame(scroll, height=1, fg_color=MUTED).pack(fill="x", padx=20, pady=(12, 8))
        ctk.CTkLabel(scroll, text="Fish Biomass (kg)", font=F(13, True), text_color=TXT
                     ).pack(padx=20, anchor="w", pady=(4, 6))
        self._add_slider(scroll, "fish_biomass_kg", "", 1, 30, 0.5, show_label=False)

        ctk.CTkLabel(scroll, text="").pack(pady=8)

    def _add_slider(self, parent, attr, label, lo, hi, step, show_label=True):
        box = ctk.CTkFrame(parent, fg_color="transparent")
        box.pack(fill="x", padx=20, pady=6)

        if show_label and label:
            row = ctk.CTkFrame(box, fg_color="transparent")
            row.pack(fill="x")
            ctk.CTkLabel(row, text=label, font=F(12), text_color=TXT2, anchor="w").pack(side="left")
            dp = 2 if step < 0.1 else (1 if step < 1 else 0)
            sv = ctk.StringVar(value=f"{getattr(self.sys, attr):.{dp}f}")
            self._sv[attr] = sv
            val_lbl = ctk.CTkLabel(row, textvariable=sv, font=FM(13, True), text_color=TXT)
            val_lbl.pack(side="right")
        else:
            dp = 2 if step < 0.1 else (1 if step < 1 else 0)
            sv = ctk.StringVar(value=f"{getattr(self.sys, attr):.{dp}f}")
            self._sv[attr] = sv

        sl = ctk.CTkSlider(box, from_=lo, to=hi,
                           number_of_steps=max(20, int((hi - lo) / step)),
                           button_color=ACC, progress_color=ACC2,
                           fg_color=MUTED, height=16, corner_radius=8)
        sl.set(getattr(self.sys, attr))
        sl.pack(fill="x", pady=(4, 0))
        sl.configure(command=lambda v, a=attr, s=step: self._on_slider(a, v, s))
        self._sliders[attr] = sl

    # ══════════════════════════════════════════════════════════════════════════
    # MAIN TABS
    # ══════════════════════════════════════════════════════════════════════════
    def _build_tabs(self, parent):
        self.tabs = ctk.CTkTabview(parent, fg_color=BG,
            segmented_button_fg_color=SURF,
            segmented_button_selected_color=ACC2,
            segmented_button_selected_hover_color=ACC,
            segmented_button_unselected_color=SURF,
            segmented_button_unselected_hover_color=CARD,
            text_color=TXT2, text_color_disabled=MUTED,
            border_width=0)
        self.tabs.pack(fill="both", expand=True, padx=0, pady=0)

        for t in ["Yield Study","Sensor Noise","Nutrient Cycle","Plant Growth",
                  "Sensitivity","Real-world Scenarios","AI Integration","Live Monitor"]:
            self.tabs.add(t)

        self._build_yield_tab()
        self._build_kalman_tab()
        self._build_nitrogen_tab()
        self._build_growth_tab()
        self._build_sensitivity_tab()
        self._build_scenarios_tab()
        self._build_ai_tab()
        self._build_live_tab()

    def _fig_canvas(self, tab, figsize=(9, 5)):
        frame = self.tabs.tab(tab)
        fig   = Figure(figsize=figsize, dpi=96, facecolor=BG)
        cv    = FigureCanvasTkAgg(fig, master=frame)
        cv.get_tk_widget().pack(fill="both", expand=True, padx=8, pady=8)
        return fig, cv, frame

    def _redraw(self, fig, cv, fn):
        fig.clear(); fn(fig); cv.draw_idle()

    # ── YIELD STUDY ───────────────────────────────────────────────────────────
    def _build_yield_tab(self):
        self._fig_yield, self._cv_yield, _ = self._fig_canvas("Yield Study", (9, 5.2))

    def _refresh_yield(self):
        crop = self._crop_var.get()
        gi   = growth_index(self.sys)
        yld  = projected_yield(self.sys, crop)
        sf   = stress_factor(self.sys)

        self._yield_sv.set(f"{yld:.2f}")
        self._gi_sidebar_sv.set(f"{gi:.3f}")
        self._harvest_sidebar_sv.set(str(harvest_days(self.sys)))

        def draw(fig):
            # 2×2 grid
            ax1 = fig.add_subplot(221)
            ax2 = fig.add_subplot(222)
            ax3 = fig.add_subplot(223, projection='polar')
            ax4 = fig.add_subplot(224)

            # ── Crop yield comparison bars ──
            crops = list(CROP_BASE_YIELD.keys())
            cur   = [projected_yield(self.sys, c) for c in crops]
            opt   = list(CROP_BASE_YIELD.values())
            x     = np.arange(len(crops)); w = 0.38
            b1 = ax1.bar(x - w/2, cur, w, color=ACC, alpha=0.85, label="Current", zorder=3)
            b2 = ax1.bar(x + w/2, opt, w, color=MUTED, alpha=0.6, label="Optimal", zorder=3)
            ax1.set_xticks(x); ax1.set_xticklabels(crops, fontsize=10)
            ax1.set_ylabel("kg / m² / month", fontsize=10)
            ax1.set_title("Crop yield comparison", fontsize=12, color=TXT, pad=8)
            ax1.legend(fontsize=9); ax1.grid(axis="y", alpha=0.2)
            for b, v in zip(b1, cur):
                ax1.text(b.get_x()+b.get_width()/2, v+0.04, f"{v:.2f}",
                         ha="center", fontsize=8, color=TXT2)

            # ── Yield vs temperature sweep ──
            temps = np.linspace(15, 40, 80)
            base  = SystemState()
            yvt   = []
            for t in temps:
                s2 = SystemState(**{k: getattr(self.sys, k) for k in vars(self.sys)})
                s2.temp_C = t
                yvt.append(projected_yield(s2, crop))
            ax2.plot(temps, yvt, color=ORANGE, lw=2.5)
            ax2.axvline(self.sys.temp_C, color=RED, lw=1.5, linestyle="--",
                        label=f"Current {self.sys.temp_C:.1f}°C")
            ax2.set_xlabel("Temperature (°C)", fontsize=10)
            ax2.set_ylabel(f"Yield ({crop}) kg/m²/mo", fontsize=10)
            ax2.set_title("Yield vs temperature sweep", fontsize=12, color=TXT, pad=8)
            ax2.legend(fontsize=9); ax2.grid(True, alpha=0.2)

            # ── Stress factor radar ──
            factors = ["Temp","pH","EC","DO","Light","CO₂","Ammonia","Turbidity"]
            values  = [sf.get(k.replace("₂","2"), 0) for k in factors]
            N_f     = len(factors)
            angles  = [n/float(N_f)*2*math.pi for n in range(N_f)]
            angles += angles[:1]; values += values[:1]
            ax3.set_facecolor(CARD)
            ax3.plot(angles, values, color=ACC, lw=2)
            ax3.fill(angles, values, color=ACC, alpha=0.18)
            ax3.set_xticks(angles[:-1])
            ax3.set_xticklabels(factors, fontsize=9, color=TXT2)
            ax3.set_ylim(0, 1)
            ax3.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
            ax3.set_yticklabels(["0.2","0.4","0.6","0.8","1.0"], fontsize=7, color=MUTED)
            ax3.tick_params(colors=MUTED)
            ax3.spines["polar"].set_color(MUTED)
            ax3.set_title("Stress factor radar", fontsize=12, color=TXT, pad=14)

            # ── Individual stress factors bars ──
            sfk  = ["Temp","pH","EC","DO","Light","CO2","Ammonia","Turbidity"]
            sfv  = [sf.get(k,0) for k in sfk]
            cols = [GREEN if v>=0.7 else (WARN if v>=0.4 else RED) for v in sfv]
            y    = range(len(sfk))
            ax4.barh(list(y), sfv, color=cols, height=0.55, zorder=3)
            ax4.set_yticks(list(y)); ax4.set_yticklabels(sfk, fontsize=10)
            ax4.set_xlim(0, 1.05); ax4.set_xlabel("Stress factor (0–1)", fontsize=10)
            ax4.set_title("Individual stress factors", fontsize=12, color=TXT, pad=8)
            ax4.grid(axis="x", alpha=0.2)
            for i, (v, c) in enumerate(zip(sfv, cols)):
                ax4.text(v+0.02, i, f"{v:.2f}", va="center", fontsize=9, color=TXT2)

            fig.suptitle("", fontsize=1)
            fig.tight_layout(pad=2.0)
        self._redraw(self._fig_yield, self._cv_yield, draw)

    # ── SENSOR NOISE / KALMAN ─────────────────────────────────────────────────
    def _build_kalman_tab(self):
        tab = self.tabs.tab("Sensor Noise")
        top = ctk.CTkFrame(tab, fg_color="transparent")
        top.pack(fill="x", padx=16, pady=12)
        ctk.CTkLabel(top, text="Sensor:", font=F(13), text_color=TXT2).pack(side="left", padx=4)
        ctk.CTkComboBox(top, values=["pH","temp_C","ec_mS","do_mg","turbidity","co2_ppm"],
                        variable=self._kal_s, width=160, height=34,
                        fg_color=CARD, border_color=MUTED, text_color=TXT,
                        button_color=ACC2, font=F(13), dropdown_font=F(12),
                        command=lambda _: self._refresh_kalman()).pack(side="left")
        ctk.CTkLabel(top, textvariable=self._kal_info, font=FM(12), text_color=ACC
                     ).pack(side="left", padx=16)
        self._fig_kal, self._cv_kal, _ = self._fig_canvas("Sensor Noise", (9, 4.8))

    def _refresh_kalman(self):
        s = self._kal_s.get()
        t, raw, filt = simulate_sensor_readings(s, 24, 5.0)
        rmse = round(float(np.sqrt(np.mean((raw-filt)**2))), 4)
        snr  = round(float(np.var(raw)/max(float(np.var(raw-filt)),1e-10)), 1)
        self._kal_info.set(f"RMSE = {rmse}   |   SNR improvement = {snr}×")
        from models.aquaponics_model import SENSOR_CONFIG
        unit = SENSOR_CONFIG.get(s,{}).get("unit","")
        def draw(fig):
            ax = fig.add_subplot(111)
            ax.plot(t/60, raw,  color=PURPLE, lw=1.0, alpha=0.55, label="Raw sensor (noise + drift + spikes)")
            ax.plot(t/60, filt, color=ACC,    lw=2.2, label="Kalman filtered signal")
            ax.fill_between(t/60, raw, filt, alpha=0.08, color=WARN, label="Noise envelope")
            ax.set_xlabel("Time (hours)", fontsize=11)
            ax.set_ylabel(f"{s}  ({unit})", fontsize=11)
            ax.set_title(f"Kalman Filter — {s} sensor simulation  (Gaussian noise + drift + spike injection)",
                         fontsize=13, color=TXT, pad=10)
            ax.legend(fontsize=10); ax.grid(True, alpha=0.2)
            fig.tight_layout(pad=2.0)
        self._redraw(self._fig_kal, self._cv_kal, draw)

    # ── NITROGEN CYCLE ────────────────────────────────────────────────────────
    def _build_nitrogen_tab(self):
        tab = self.tabs.tab("Nutrient Cycle")
        top = ctk.CTkFrame(tab, fg_color="transparent")
        top.pack(fill="x", padx=16, pady=12)
        for lbl, key, col in [("NH₄⁺ ppm","nh4",RED),("NO₂⁻ ppm","no2",ORANGE),
                               ("NO₃⁻ ppm","no3",PURPLE),("Biofilter","bio",GREEN)]:
            b = ctk.CTkFrame(top, fg_color=CARD, corner_radius=8)
            b.pack(side="left", expand=True, fill="x", padx=6)
            ctk.CTkLabel(b, text=lbl, font=F(11), text_color=TXT2).pack(pady=(10,2))
            ctk.CTkLabel(b, textvariable=self._nit_vars[key], font=FM(24,True), text_color=col).pack(pady=(0,10))
        self._fig_nit, self._cv_nit, _ = self._fig_canvas("Nutrient Cycle", (9, 4.3))

    def _refresh_nitrogen(self):
        gi = growth_index(self.sys)
        t, sol = simulate_nitrogen_cycle(72, self.sys.fish_biomass_kg, gi)
        nh4, no2, no3 = sol[:,0], sol[:,1], sol[:,2]
        self._nit_vars["nh4"].set(f"{nh4[-1]:.3f}")
        self._nit_vars["no2"].set(f"{no2[-1]:.4f}")
        self._nit_vars["no3"].set(f"{no3[-1]:.1f}")
        self._nit_vars["bio"].set(f"{min(100,int(gi*100))}%")
        for k, v in [("nh4r",f"{nh4[-1]:.3f} ppm"),("no2r",f"{no2[-1]:.4f} ppm"),("no3r",f"{no3[-1]:.1f} ppm")]:
            self._nitr[k].set(v)
        self.sys.nitrate_ppm = float(no3[-1])
        self.sys.nitrite_ppm = float(no2[-1])
        skip = 6
        def draw(fig):
            ax = fig.add_subplot(111)
            ax.plot(t[::skip], nh4[::skip], color=RED,    lw=2,   label="NH₄⁺  (ammonia)")
            ax.plot(t[::skip], no2[::skip], color=ORANGE, lw=2,   label="NO₂⁻  (nitrite)")
            ax.plot(t[::skip], no3[::skip], color=PURPLE, lw=2.5, label="NO₃⁻  (nitrate — plant food)")
            ax.fill_between(t[::skip], no3[::skip], alpha=0.10, color=PURPLE)
            ax.axhline(1.0, color=RED, lw=1, linestyle="--", alpha=0.6, label="NH₄ danger threshold (1 ppm)")
            ax.set_xlabel("Time (hours)", fontsize=11)
            ax.set_ylabel("Concentration (ppm)", fontsize=11)
            ax.set_title("Nutrient Cycle — 72-hour ODE Simulation  (Fish Waste → Biofilter → Plant Uptake)",
                         fontsize=13, color=TXT, pad=10)
            ax.legend(fontsize=10, loc="center right"); ax.grid(True, alpha=0.2)
            fig.tight_layout(pad=2.0)
        self._redraw(self._fig_nit, self._cv_nit, draw)

    # ── PLANT GROWTH ──────────────────────────────────────────────────────────
    def _build_growth_tab(self):
        self._fig_grow, self._cv_grow, _ = self._fig_canvas("Plant Growth", (9, 5.0))

    def _refresh_growth(self):
        gi = growth_index(self.sys)
        colors = [ACC, GREEN, ORANGE, PURPLE, WARN]
        def draw(fig):
            ax = fig.add_subplot(111)
            for i, (crop, base) in enumerate(CROP_BASE_YIELD.items()):
                t, mass = simulate_plant_growth(35, 10.0, gi)
                ax.plot(t[::24], mass[::24] * base * 0.38,
                        color=colors[i%5], lw=2.2, label=crop)
            for d, st in [(0,"Germ."),(5,"Seedling"),(12,"Vegetative"),(20,"Rapid"),(28,"Harvest")]:
                ax.axvline(d, color=MUTED, lw=0.8, linestyle=":", alpha=0.6)
                ax.text(d+0.3, 0.4, st, fontsize=9, color=MUTED, rotation=90)
            ax.set_xlabel("Days", fontsize=11)
            ax.set_ylabel("Plant mass  (g)", fontsize=11)
            ax.set_title(f"Verhulst Logistic Growth Model  ·  GI = {gi:.3f}  ·  All crops  ·  35-day simulation",
                         fontsize=13, color=TXT, pad=10)
            ax.legend(fontsize=10, loc="upper left"); ax.grid(True, alpha=0.2)
            fig.tight_layout(pad=2.0)
        self._redraw(self._fig_grow, self._cv_grow, draw)

    # ── SENSITIVITY ───────────────────────────────────────────────────────────
    def _build_sensitivity_tab(self):
        self._fig_sens, self._cv_sens, _ = self._fig_canvas("Sensitivity", (9, 5.0))

    def _refresh_sensitivity(self):
        def draw(fig):
            ax1 = fig.add_subplot(121)
            ax2 = fig.add_subplot(122)

            # Tornado
            res = sensitivity_tornado(self.sys)
            labels = list(res.keys())
            lo_v = [v[0] for v in res.values()]
            hi_v = [v[1] for v in res.values()]
            y = range(len(labels))
            ax1.barh(list(y), [abs(v) for v in lo_v], left=[min(v,0) for v in lo_v],
                     color=RED, alpha=0.78, height=0.5, label="−15% effect")
            ax1.barh(list(y), hi_v, left=0, color=GREEN, alpha=0.78, height=0.5, label="+15% effect")
            ax1.set_yticks(list(y)); ax1.set_yticklabels(labels, fontsize=11)
            ax1.axvline(0, color=MUTED, lw=1.0)
            ax1.set_xlabel("Yield change (%)", fontsize=11)
            ax1.set_title("Sensitivity Tornado  (±15% sweep)", fontsize=13, color=TXT, pad=10)
            ax1.legend(fontsize=10); ax1.grid(axis="x", alpha=0.2)

            # Monte Carlo histogram
            yields = monte_carlo_yield(500, "Lettuce")
            mean = float(yields.mean())
            p10  = float(np.percentile(yields, 10))
            p90  = float(np.percentile(yields, 90))
            ax2.hist(yields, bins=28, color=WARN, alpha=0.75, edgecolor=BG, lw=0.4)
            ax2.axvline(mean, color=ACC,   lw=2.0, linestyle="--", label=f"Mean = {mean:.3f}")
            ax2.axvline(p10,  color=RED,   lw=1.5, linestyle=":",  label=f"P10 = {p10:.3f}")
            ax2.axvline(p90,  color=GREEN, lw=1.5, linestyle=":",  label=f"P90 = {p90:.3f}")
            ax2.set_xlabel("Lettuce yield  (kg/m²/month)", fontsize=11)
            ax2.set_ylabel("Frequency", fontsize=11)
            ax2.set_title("Monte Carlo Distribution  (n=500)", fontsize=13, color=TXT, pad=10)
            ax2.legend(fontsize=10); ax2.grid(True, alpha=0.2)

            fig.tight_layout(pad=2.0)
        self._redraw(self._fig_sens, self._cv_sens, draw)

    # ── REAL-WORLD SCENARIOS ──────────────────────────────────────────────────
    def _build_scenarios_tab(self):
        tab = self.tabs.tab("Real-world Scenarios")

        # 4 scenario cards
        grid = ctk.CTkFrame(tab, fg_color="transparent")
        grid.pack(fill="x", padx=16, pady=12)

        COLORS = {"Optimal Indoor":GREEN,"Monsoon (Kerala)":TEAL,"Summer Heat":ORANGE,"Power Outage":WARN}
        for i, (name, sc) in enumerate(SCENARIOS.items()):
            col = COLORS.get(name, ACC)
            card = ctk.CTkFrame(grid, fg_color=CARD, corner_radius=10)
            card.grid(row=0, column=i, padx=6, pady=4, sticky="nsew")
            grid.columnconfigure(i, weight=1)
            ctk.CTkLabel(card, text=name, font=F(13, True), text_color=col
                         ).pack(padx=14, pady=(14, 4), anchor="w")
            ctk.CTkLabel(card, text=sc.description[:120]+"...",
                         font=F(10), text_color=TXT2, wraplength=220, justify="left"
                         ).pack(padx=14, pady=(0, 8), anchor="w")
            ctk.CTkButton(card, text="Load", width=80, height=28,
                          fg_color=col, hover_color=col, text_color="#000",
                          font=F(11, True), corner_radius=6,
                          command=lambda n=name: self._load_scenario(n)
                          ).pack(padx=14, pady=(0, 14), anchor="w")

        # Scenario detail
        self._sc_detail = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        self._sc_detail.pack(fill="both", expand=True, padx=16, pady=(0,12))
        ctk.CTkLabel(self._sc_detail, textvariable=self._sc_name_var,
                     font=F(16, True), text_color=ACC, anchor="w").pack(anchor="w", pady=(8,4))
        ctk.CTkLabel(self._sc_detail, textvariable=self._sc_desc_var,
                     font=F(12), text_color=TXT2, wraplength=760, justify="left"
                     ).pack(anchor="w", pady=(0,12))
        self._act_frame = ctk.CTkFrame(self._sc_detail, fg_color="transparent")
        self._act_frame.pack(fill="x")

    # ── AI INTEGRATION ────────────────────────────────────────────────────────
    def _build_ai_tab(self):
        tab = self.tabs.tab("AI Integration")

        # Prediction row
        pred = ctk.CTkFrame(tab, fg_color="transparent")
        pred.pack(fill="x", padx=16, pady=12)
        for lb, key, col in [("Harvest ETA","harvest",ACC),("Yield Forecast","yield",GREEN),
                              ("Fish Gain/mo","fish_gain",FISH),("System Risk","risk",WARN)]:
            b = ctk.CTkFrame(pred, fg_color=CARD, corner_radius=10)
            b.pack(side="left", expand=True, fill="x", padx=6)
            ctk.CTkLabel(b, text=lb, font=F(11), text_color=TXT2).pack(pady=(12,2))
            ctk.CTkLabel(b, textvariable=self._pred_vars[key], font=FM(22,True), text_color=col).pack(pady=(0,12))

        # Colour rec
        crec = ctk.CTkFrame(tab, fg_color=CARD, corner_radius=10)
        crec.pack(fill="x", padx=16, pady=(0,10))
        ctk.CTkLabel(crec, text="🎨  Colour Channel Recommendation:",
                     font=F(13, True), text_color=ORANGE).pack(side="left", padx=14, pady=12)
        ctk.CTkLabel(crec, textvariable=self._ch_rec_var,
                     font=FM(14, True), text_color=ACC).pack(side="right", padx=14)

        # Automation controls inline
        ctrl = ctk.CTkFrame(tab, fg_color="transparent")
        ctrl.pack(fill="x", padx=16, pady=(0,8))
        self._acts = {}
        for lb, key in [("Main Pump","pump"),("Aerator","aerator"),("Exhaust Fan","fan"),
                        ("Evap Cooling","evap"),("LED Lights","led"),("Nutrient Dose","dose"),
                        ("pH Correction","ph_dose"),("Water Refill","refill")]:
            b = ctk.CTkFrame(ctrl, fg_color=CARD, corner_radius=8)
            b.pack(side="left", expand=True, fill="x", padx=4)
            ctk.CTkLabel(b, text=lb, font=F(10), text_color=TXT2).pack(pady=(8,2))
            sv = ctk.StringVar(value="OFF")
            sw = ctk.CTkSwitch(b, text="", variable=sv, onvalue="ON", offvalue="OFF",
                               progress_color=GREEN, button_color=ACC,
                               command=lambda k=key, v=sv: None)
            sw.pack(pady=(0,8))
            slbl = ctk.CTkLabel(b, text="OFF", font=FM(10,True), text_color=MUTED)
            slbl.pack(pady=(0,8))
            self._acts[key] = (sw, sv, slbl)

        # Recommendations scroll
        scroll = ctk.CTkScrollableFrame(tab, fg_color="transparent")
        scroll.pack(fill="both", expand=True, padx=16, pady=(0,8))
        self._ai_scroll = scroll
        self._ai_labels = []

    # ── LIVE MONITOR ──────────────────────────────────────────────────────────
    def _build_live_tab(self):
        tab = self.tabs.tab("Live Monitor")

        # Status bar
        stat = ctk.CTkFrame(tab, fg_color="transparent")
        stat.pack(fill="x", padx=16, pady=12)
        self._auto_log_sv = ctk.StringVar(value="System ready — press Start or Autonomous")
        ctk.CTkLabel(stat, textvariable=self._auto_log_sv, font=F(12), text_color=GREEN
                     ).pack(side="left")
        ctk.CTkButton(stat, text="Clear Alerts", width=110, height=30,
                      fg_color=CARD, hover_color=RED, text_color=TXT,
                      border_width=1, border_color=MUTED, font=F(11),
                      command=self._clear_alerts).pack(side="right")
        self._alert_count_lbl = ctk.CTkLabel(stat, textvariable=self._alert_count_var,
                                              font=F(12, True), text_color=RED)
        self._alert_count_lbl.pack(side="right", padx=12)

        self._fig_live, self._cv_live, _ = self._fig_canvas("Live Monitor", (9, 4.8))
        self._alert_scroll = ctk.CTkScrollableFrame(tab, fg_color="transparent", height=120)
        self._alert_scroll.pack(fill="x", padx=16, pady=(0,8))

    def _refresh_live(self):
        def draw(fig):
            n = len(self._hist["temp_C"]); idx = list(range(n))
            ax1 = fig.add_subplot(221); ax2 = fig.add_subplot(222)
            ax3 = fig.add_subplot(223); ax4 = fig.add_subplot(224)
            ax1.plot(idx, list(self._hist["temp_C"]), color=RED, lw=1.8)
            ax1.set_title("Water Temperature (°C)", fontsize=11, color=TXT)
            ax1.axhline(32, color=RED, lw=0.8, linestyle="--", alpha=0.5)
            ax1.grid(True, alpha=0.2)
            ax2.plot(idx, list(self._hist["pH"]), color=ACC, lw=1.8)
            ax2.axhline(6.5, color=WARN, lw=0.8, linestyle="--", alpha=0.5)
            ax2.axhline(7.5, color=WARN, lw=0.8, linestyle="--", alpha=0.5)
            ax2.set_title("pH", fontsize=11, color=TXT); ax2.grid(True, alpha=0.2)
            ax3.plot(idx, list(self._hist["do_mg"]), color=GREEN, lw=1.8)
            ax3.axhline(5.0, color=RED, lw=0.8, linestyle="--", alpha=0.5, label="Min safe")
            ax3.set_title("Dissolved Oxygen (mg/L)", fontsize=11, color=TXT)
            ax3.legend(fontsize=8); ax3.grid(True, alpha=0.2)
            ax4.plot(idx, list(self._hist["gi"]),  color=ACC,  lw=2, label="Plant GI")
            ax4.plot(idx, list(self._hist["fgi"]), color=FISH, lw=2, label="Fish GI")
            ax4.fill_between(idx, list(self._hist["gi"]),  alpha=0.12, color=ACC)
            ax4.fill_between(idx, list(self._hist["fgi"]), alpha=0.12, color=FISH)
            ax4.set_ylim(0, 1.05); ax4.set_title("Growth Indices", fontsize=11, color=TXT)
            ax4.legend(fontsize=9); ax4.grid(True, alpha=0.2)
            fig.suptitle(f"Live Monitor  ·  Day {self.sim_day}  {int(self.sim_hour):02d}:{int((self.sim_hour%1)*60):02d}",
                         fontsize=13, color=TXT2, y=0.99)
            fig.tight_layout(pad=1.8)
        self._redraw(self._fig_live, self._cv_live, draw)

    # ══════════════════════════════════════════════════════════════════════════
    # REFRESH ALL
    # ══════════════════════════════════════════════════════════════════════════
    def _refresh_all(self):
        self._refresh_yield()
        self._refresh_kalman()
        self._refresh_nitrogen()
        self._refresh_growth()
        self._refresh_sensitivity()
        self._refresh_ai()
        self._refresh_live()
        self._refresh_energy()
        self._run_automation()

    def _refresh_ai(self):
        gi   = growth_index(self.sys)
        fgi  = fish_growth_index(self.sys)
        gain = projected_fish_gain(self.sys)
        hd   = harvest_days(self.sys)
        yld  = projected_yield(self.sys, self._crop_var.get())
        risk = "LOW" if gi>=0.8 and fgi>=0.8 else ("MODERATE" if gi>=0.5 else "HIGH")
        rc   = RED if risk=="HIGH" else (WARN if risk=="MODERATE" else GREEN)

        self._pred_vars["harvest"].set(f"{hd} days")
        self._pred_vars["yield"].set(f"{yld:.3f}")
        self._pred_vars["fish_gain"].set(f"+{gain:.3f} kg")
        self._pred_vars["risk"].set(risk)
        self._ch_rec_var.set(f"→ {self._recommend_channel().upper()}  ({COLOUR_CHANNELS[self._recommend_channel()]['nm']})")

        for w in self._ai_labels: w.destroy()
        self._ai_labels.clear()
        for rec in ai_recommendations(self.sys):
            col = RED if "CRITICAL" in rec or "🚨" in rec else (WARN if "⚠" in rec else (GREEN if "✓" in rec else (FISH if "🐟" in rec else TXT2)))
            lbl = ctk.CTkLabel(self._ai_scroll, text=rec, font=F(12),
                               text_color=col, anchor="w", justify="left", wraplength=760)
            lbl.pack(fill="x", padx=10, pady=4, anchor="w")
            sep = ctk.CTkFrame(self._ai_scroll, height=1, fg_color=MUTED)
            sep.pack(fill="x", padx=10)
            self._ai_labels.extend([lbl, sep])

    def _refresh_energy(self):
        gi = growth_index(self.sys)
        self.energy_kwh += 1.2 * self.sim_speed / 3600
        self.water_L    += 0.5 * self.sim_speed / 3600
        self._energy_vars["kwh"].set(f"{self.energy_kwh:.2f}")
        self._energy_vars["water"].set(f"{self.water_L:.1f}")
        self._energy_vars["eff"].set(f"{round(gi*94,1)}%")
        self._hist["energy"].append(self.energy_kwh)

    # ══════════════════════════════════════════════════════════════════════════
    # AUTOMATION
    # ══════════════════════════════════════════════════════════════════════════
    def _run_automation(self):
        s = self.sys; msgs = []
        if s.temp_C > 32:
            self._set_act("fan", True); self._set_act("evap", True)
            msgs.append(f"⚙ Temp {s.temp_C:.1f}°C > 32 → Fan + Evap ON")
            if s.temp_C > 35:
                self._add_alert("🚨 CRITICAL TEMP", f"Water {s.temp_C:.1f}°C — fish mortality risk!", RED)
        else:
            if not self.autonomous:
                self._set_act("fan", False, False); self._set_act("evap", False, False)
        if s.do_mg < 5.0:
            self._set_act("aerator", True)
            msgs.append(f"⚙ DO {s.do_mg:.1f} < 5.0 → Aerator ON")
            if s.do_mg < 4.0: self._add_alert("🚨 CRITICAL DO", f"DO={s.do_mg:.1f} mg/L — fish at risk!", RED)
        else:
            if s.do_mg > 7.0 and not self.autonomous: self._set_act("aerator", False, False)
        if s.pH < 6.5:
            self._set_act("ph_dose", True); s.pH = min(7.5, s.pH + 0.003)
            msgs.append(f"⚙ pH {s.pH:.2f} < 6.5 → Alkali dosing")
        elif s.pH > 7.8:
            self._set_act("ph_dose", True); s.pH = max(6.5, s.pH - 0.003)
        else: self._set_act("ph_dose", False, False)
        if s.ec_mS < 0.5:
            self._set_act("dose", True); s.ec_mS = min(2.0, s.ec_mS + 0.005)
            msgs.append("⚙ EC low → Nutrient dosing ON")
        else: self._set_act("dose", False, False)
        if s.ammonia_ppm > 1.0:
            self._add_alert("⚠ HIGH AMMONIA", f"NH4={s.ammonia_ppm:.2f} ppm — stop feeding!", WARN)
        if self.autonomous:
            sch = self._get_sched_channel()
            if sch != self.active_ch: self._set_channel(sch); msgs.append(f"⚙ Schedule → {sch.upper()}")
        if msgs:
            ts = f"{int(self.sim_hour):02d}:{int((self.sim_hour%1)*60):02d}"
            self._auto_log_sv.set(f"[{ts}] {msgs[0]}")

    def _set_act(self, key, on, log_it=True):
        if key not in self._acts: return
        sw, sv, slbl = self._acts[key]
        if sv.get() != ("ON" if on else "OFF"):
            sv.set("ON" if on else "OFF")
            slbl.configure(text="ON" if on else "OFF", text_color=GREEN if on else MUTED)
            if on: sw.select()
            else:  sw.deselect()

    def _set_channel(self, name):
        self.active_ch = name
        info = COLOUR_CHANNELS.get(name, {})
        self._ch_name_var.set(name.upper())
        self._ch_nm_var.set(info.get("nm",""))
        self._ch_eff_var.set(info.get("effect",""))
        self._ch_active_var.set(f"{name.upper()} — {info.get('nm','')}")

    def _recommend_channel(self):
        h = self.sim_hour; si = min(len(PLANT_STAGES)-1, int(self.plant_days/5))
        stage = PLANT_STAGES[si]
        if 20 <= h or h < 6: return "black"
        if 11 <= h <= 15 and self.sys.temp_C > 30: return "black"
        if stage in ("Germination","Seedling"): return "blue"
        if stage in ("Pre-Harvest","Harvest Ready"): return "red"
        return "red" if h < 18 else "black"

    def _get_sched_channel(self):
        ch = "black"
        for sh, sch, _ in DAY_SCHEDULE:
            if self.sim_hour >= sh: ch = sch
        return ch

    # ══════════════════════════════════════════════════════════════════════════
    # SLIDER
    # ══════════════════════════════════════════════════════════════════════════
    def _on_slider(self, attr, val, step):
        v = float(val); setattr(self.sys, attr, v)
        dp = 2 if step < 0.1 else (1 if step < 1 else 0)
        self._sv[attr].set(f"{v:.{dp}f}")
        now = time.time()
        if now - self._last_refresh > 0.15:
            self._refresh_all(); self._last_refresh = now

    # ══════════════════════════════════════════════════════════════════════════
    # ALERTS
    # ══════════════════════════════════════════════════════════════════════════
    def _add_alert(self, title, msg, col=RED):
        key = f"{title}:{msg[:30]}"
        if any(a[3]==key for a in self.alerts[-10:]): return
        ts = datetime.now().strftime("%H:%M:%S")
        self.alerts.append((ts, title, msg, key, col))
        self._render_alerts()

    def _render_alerts(self):
        for w in self._alert_widgets: w.destroy()
        self._alert_widgets.clear()
        self._alert_count_var.set(f"{len(self.alerts)} alert(s)")
        for ts, title, msg, _, col in reversed(self.alerts[-10:]):
            r = ctk.CTkFrame(self._alert_scroll, fg_color=CARD, corner_radius=6)
            r.pack(fill="x", pady=2)
            ctk.CTkLabel(r, text=title, font=F(11,True), text_color=col).pack(side="left", padx=12, pady=6)
            ctk.CTkLabel(r, text=msg,   font=F(11),      text_color=TXT2).pack(side="left", padx=4)
            ctk.CTkLabel(r, text=ts,    font=FM(10),     text_color=MUTED).pack(side="right", padx=10)
            self._alert_widgets.append(r)

    def _clear_alerts(self):
        self.alerts.clear()
        for w in self._alert_widgets: w.destroy()
        self._alert_widgets.clear()
        self._alert_count_var.set("0 alerts")

    # ══════════════════════════════════════════════════════════════════════════
    # SIMULATION ENGINE
    # ══════════════════════════════════════════════════════════════════════════
    def _set_speed(self, spd, label):
        self.sim_speed = spd
        self._speed_var.set(label)

    def _toggle_sim(self):
        self.running = not self.running
        if self.running:
            self._run_btn.configure(text="⏸  Pause", fg_color=WARN, text_color="#000")
            threading.Thread(target=self._sim_loop, daemon=True).start()
        else:
            self._run_btn.configure(text="▶  Start", fg_color=GREEN, text_color="#0d1117")

    def _toggle_autonomous(self):
        self.autonomous = not self.autonomous
        if self.autonomous:
            self.running = True
            self._auto_btn.configure(fg_color=GREEN, text="AUTONOMOUS  ON", text_color="#000")
            self._run_btn.configure(text="⏸  Pause", fg_color=WARN, text_color="#000")
            threading.Thread(target=self._sim_loop, daemon=True).start()
        else:
            self._auto_btn.configure(fg_color=PURPLE, text="AUTONOMOUS", text_color="white")

    def _sim_loop(self):
        rng = np.random.default_rng()
        while self.running:
            dt = self.sim_speed / 3600.0
            self.sim_hour += dt
            if self.sim_hour >= 24: self.sim_hour -= 24; self.sim_day += 1; self.plant_days += 1
            self.sys.temp_C      = max(15, min(40,  self.sys.temp_C      + rng.normal(0, 0.025)))
            self.sys.pH          = max(5.5,min(9.0, self.sys.pH          + rng.normal(0, 0.002)))
            self.sys.do_mg       = max(0,  min(12,  self.sys.do_mg       + rng.normal(0, 0.025)))
            self.sys.ec_mS       = max(0.1,min(4,   self.sys.ec_mS       + rng.normal(0, 0.003)))
            self.sys.ammonia_ppm = max(0,  min(3,   self.sys.ammonia_ppm + rng.normal(0, 0.001)))
            self.sys.turbidity   = max(0,  min(200, self.sys.turbidity   + rng.normal(0, 0.1)))
            if self.autonomous:
                heff = math.sin((self.sim_hour - 6) * math.pi / 12)
                self.sys.temp_C      += heff * 0.4
                self.sys.light_klux   = max(0, 35 * max(0, math.sin((self.sim_hour-6)*math.pi/14)))
            gi  = growth_index(self.sys); fgi = fish_growth_index(self.sys)
            for k, v in [("temp_C",self.sys.temp_C),("pH",self.sys.pH),
                         ("ec_mS",self.sys.ec_mS),("do_mg",self.sys.do_mg),
                         ("ammonia_ppm",self.sys.ammonia_ppm),("gi",gi),("fgi",fgi)]:
                self._hist[k].append(v)
            for attr in ("temp_C","pH","do_mg","ec_mS","ammonia_ppm"):
                v = getattr(self.sys, attr)
                dp = 2 if attr in ("pH","ec_mS","ammonia_ppm") else 1
                self._sliders[attr].set(v); self._sv[attr].set(f"{v:.{dp}f}")
            now = time.time()
            if now - self._last_log_t >= 10: self._autolog_row(); self._last_log_t = now
            self.after(0, self._refresh_all); time.sleep(0.9)

    def _start_clock(self):
        def upd():
            h = int(self.sim_hour); m = int((self.sim_hour%1)*60)
            self._clock_var.set(f"Day {self.sim_day}  {h:02d}:{m:02d}")
            self.after(800, upd)
        upd()

    # ══════════════════════════════════════════════════════════════════════════
    # SCENARIO
    # ══════════════════════════════════════════════════════════════════════════
    def _load_scenario(self, name):
        sc = SCENARIOS[name]; self.sys = SystemState(**sc.state.__dict__)
        for attr, sl in self._sliders.items():
            v = getattr(self.sys, attr, None)
            if v is None: continue
            sl.set(v)
            step = 0.01 if attr in ("pH","ec_mS","ammonia_ppm") else (0.1 if attr in ("temp_C","do_mg") else 1)
            dp = 2 if step<0.1 else (1 if step<1 else 0)
            self._sv[attr].set(f"{v:.{dp}f}")
        self._sc_name_var.set(sc.name); self._sc_desc_var.set(sc.description)
        for lbl in self._act_labels: lbl.destroy(); self._act_labels.clear()
        for action in sc.actions:
            col = RED if "CRITICAL" in action else (WARN if "ALERT" in action else TXT2)
            lbl = ctk.CTkLabel(self._act_frame, text=f"  ▸  {action}",
                               font=F(12), text_color=col, anchor="w", justify="left", wraplength=720)
            lbl.pack(fill="x", padx=4, pady=3, anchor="w")
            self._act_labels.append(lbl)
        self.tabs.set("Real-world Scenarios"); self._refresh_all()

    # ══════════════════════════════════════════════════════════════════════════
    # CSV AUTO-LOG
    # ══════════════════════════════════════════════════════════════════════════
    def _init_csv(self):
        os.makedirs("data", exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._csv_path  = f"data/autolog_{ts}.csv"
        self._csv_file  = open(self._csv_path, "w", newline="")
        self._csv_writer= csv.writer(self._csv_file)
        self._csv_writer.writerow(["timestamp","sim_day","sim_hour","temp_C","pH","ec_mS",
                                    "do_mg","ammonia_ppm","turbidity","light_klux","plant_gi","fish_gi"])

    def _autolog_row(self):
        if not self._csv_writer: return
        gi = growth_index(self.sys); fgi = fish_growth_index(self.sys)
        self._csv_writer.writerow([datetime.now().strftime("%H:%M:%S"), self.sim_day,
            round(self.sim_hour,2), round(self.sys.temp_C,2), round(self.sys.pH,3),
            round(self.sys.ec_mS,3), round(self.sys.do_mg,2), round(self.sys.ammonia_ppm,3),
            round(self.sys.turbidity,1), round(self.sys.light_klux,1), round(gi,4), round(fgi,4)])
        self._csv_file.flush()

    def _export_all(self):
        try:
            p1 = export_state_csv(self.sys); gi = growth_index(self.sys)
            p2 = export_nitrogen_csv(self.sys.fish_biomass_kg, gi)
            p3 = export_growth_csv(gi=gi)
            messagebox.showinfo("Export Complete",
                f"Saved to data/ folder:\n{os.path.basename(p1)}\n{os.path.basename(p2)}\n{os.path.basename(p3)}")
        except Exception as e: messagebox.showerror("Export Error", str(e))

    def destroy(self):
        if self._csv_file:
            try: self._csv_file.close()
            except: pass
        super().destroy()
