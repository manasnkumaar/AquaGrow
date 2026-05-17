"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Device = { id: string; name: string; status: string };
type LedConfig = {
  device_id: string;
  device_name?: string;
  mode: "seedling"|"vegetative"|"flowering"|"fruiting"|"custom"|"off";
  color_r: number; color_g: number; color_b: number;
  brightness: number;
  schedule_on: string;
  schedule_off: string;
  auto_adjust: boolean;
  updated_at: string;
};
type EnergyRow = { day: string; total_kwh: string | number };
type EnergySummaryRow = { device_id: string; device_name: string; total_kwh: string | number; avg_kwh: string | number };

const MODES = [
  { v: "seedling",   label: "🌱 Seedling",   desc: "Soft white + cyan to encourage germination" },
  { v: "vegetative", label: "🥬 Vegetative", desc: "Cool white + blue/green for leafy growth" },
  { v: "flowering",  label: "🌸 Flowering",  desc: "Red + magenta to encourage blooms" },
  { v: "fruiting",   label: "🍅 Fruiting",   desc: "Red + amber for fruit development" },
  { v: "custom",     label: "🎨 Custom",     desc: "Manual color & brightness" },
  { v: "off",        label: "⏻ Off",         desc: "Lights off" },
] as const;

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace("#", "");
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}

export default function LedPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [config, setConfig] = useState<LedConfig | null>(null);
  const [daily, setDaily] = useState<EnergyRow[]>([]);
  const [summary, setSummary] = useState<EnergySummaryRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, e] = await Promise.all([
      api<{ devices: Device[] }>("/api/devices"),
      api<{ summary: EnergySummaryRow[]; daily: EnergyRow[] }>("/api/led/energy/summary"),
    ]);
    setDevices(d.devices);
    setSummary(e.summary);
    setDaily(e.daily);
    if (!deviceId && d.devices.length) setDeviceId(d.devices[0].id);
  }, [deviceId]);

  const loadConfig = useCallback(async (id: string) => {
    if (!id) return;
    const r = await api<{ config: LedConfig }>(`/api/led/${id}`);
    setConfig(r.config);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadConfig(deviceId); }, [deviceId, loadConfig]);

  const update = async (patch: Partial<LedConfig>) => {
    if (!config) return;
    setSaving(true);
    try {
      const r = await api<{ config: LedConfig }>(`/api/led/${config.device_id}`, {
        method: "PUT", body: patch,
      });
      setConfig(r.config);
      setSavedAt(new Date().toISOString());
      // refresh energy summary
      const e = await api<{ summary: EnergySummaryRow[]; daily: EnergyRow[] }>("/api/led/energy/summary");
      setSummary(e.summary); setDaily(e.daily);
    } finally {
      setSaving(false);
    }
  };

  const hex = config ? rgbToHex(config.color_r, config.color_g, config.color_b) : "#ffffff";

  const chartData = useMemo(
    () => daily.map(d => ({ day: new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }), total_kwh: Number(d.total_kwh) })),
    [daily]
  );

  return (
    <AppShell title="Adaptive LED Control">
      <section className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Device</label>
          <select className="input mt-1" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="text-xs text-[rgb(var(--muted))] mb-2">
          {saving ? "Saving…" : savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : "Ready"}
        </div>
      </section>

      {config ? (
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="card lg:col-span-2 space-y-4">
            <div className="font-medium">Growth mode</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {MODES.map(m => (
                <button
                  key={m.v}
                  onClick={() => update({ mode: m.v })}
                  className={`text-left rounded-xl border p-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]
                              ${config.mode === m.v ? "border-brand-500 ring-2 ring-brand-500/30" : "border-[rgb(var(--border))]"}`}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-[rgb(var(--muted))] mt-1">{m.desc}</div>
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Custom color</label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="color" value={hex}
                    onChange={(e) => {
                      const { r, g, b } = hexToRgb(e.target.value);
                      void update({ mode: "custom", color_r: r, color_g: g, color_b: b });
                    }}
                    className="h-10 w-16 rounded border border-[rgb(var(--border))] bg-transparent"
                  />
                  <code className="text-sm">{hex}</code>
                </div>
              </div>
              <div>
                <label className="label">Brightness ({config.brightness}%)</label>
                <input
                  type="range" min={0} max={100} value={config.brightness}
                  onChange={(e) => setConfig({ ...config, brightness: Number(e.target.value) })}
                  onMouseUp={() => update({ brightness: config.brightness })}
                  onTouchEnd={() => update({ brightness: config.brightness })}
                  className="w-full mt-2"
                />
              </div>
              <div>
                <label className="label">Schedule on</label>
                <input className="input mt-1" type="time"
                  value={String(config.schedule_on).slice(0, 5)}
                  onChange={(e) => update({ schedule_on: e.target.value })}/>
              </div>
              <div>
                <label className="label">Schedule off</label>
                <input className="input mt-1" type="time"
                  value={String(config.schedule_off).slice(0, 5)}
                  onChange={(e) => update({ schedule_off: e.target.value })}/>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={config.auto_adjust}
                  onChange={(e) => update({ auto_adjust: e.target.checked })}/>
                Automatic spectrum/brightness adjustment based on ambient light
              </label>
            </div>
          </div>

          <div className="card flex flex-col items-center justify-center">
            <div className="text-xs text-[rgb(var(--muted))]">Live preview</div>
            <div className="my-3 rounded-2xl w-40 h-40 shadow-inner border border-[rgb(var(--border))] transition-all"
              style={{
                background: `radial-gradient(circle, ${hex} 0%, ${hex}66 60%, transparent 100%)`,
                opacity: 0.2 + (config.brightness / 100) * 0.8,
              }}
            />
            <div className="text-sm font-medium capitalize">{config.mode}</div>
            <div className="text-xs text-[rgb(var(--muted))]">RGB({config.color_r}, {config.color_g}, {config.color_b})</div>
            <div className="text-xs text-[rgb(var(--muted))] mt-2">
              {config.schedule_on?.toString().slice(0,5)} → {config.schedule_off?.toString().slice(0,5)}
            </div>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="font-medium">Energy usage — last 14 days (kWh / day, all devices)</div>
          <div className="text-xs text-[rgb(var(--muted))]">
            Total: {summary.reduce((s, r) => s + Number(r.total_kwh ?? 0), 0).toFixed(2)} kWh
          </div>
        </div>
        <div className="mt-3" style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid stroke="rgba(125,125,125,0.2)" strokeDasharray="3 3"/>
              <XAxis dataKey="day" tick={{ fontSize: 11 }}/>
              <YAxis tick={{ fontSize: 11 }} width={42}/>
              <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", color: "rgb(var(--fg))" }}/>
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="total_kwh" name="Energy (kWh)" fill="#06b6d4" radius={[6, 6, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <div className="font-medium mb-2">Energy per device</div>
        <div className="overflow-x-auto">
          <table className="table-default">
            <thead><tr><th>Device</th><th>Total kWh</th><th>Avg kWh</th></tr></thead>
            <tbody>
              {summary.map(s => (
                <tr key={s.device_id}>
                  <td>{s.device_name}</td>
                  <td>{Number(s.total_kwh ?? 0).toFixed(3)}</td>
                  <td>{Number(s.avg_kwh ?? 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
