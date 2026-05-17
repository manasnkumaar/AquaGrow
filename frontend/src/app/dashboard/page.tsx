"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { SensorAreaChart } from "@/components/charts/SensorAreaChart";
import { api } from "@/lib/api";
import { ago, fmt, fmtDate } from "@/lib/format";

type Device = { id: string; name: string; location: string; status: string; last_seen: string | null };
type Reading = {
  id: number;
  device_id: string;
  device_name?: string;
  temperature: string | number;
  humidity: string | number;
  water_level: string | number;
  ph: string | number;
  light_intensity: string | number;
  recorded_at: string;
};
type Alert = { id: string; device_id: string | null; device_name: string | null; severity: "info"|"warning"|"critical"; message: string; created_at: string; acknowledged: boolean };

const SERIES = [
  { key: "temperature",     label: "Temperature (°C)", color: "#ef4444" },
  { key: "humidity",        label: "Humidity (%)",     color: "#06b6d4" },
  { key: "water_level",     label: "Water Level (%)",  color: "#3b82f6" },
  { key: "ph",              label: "pH",               color: "#a855f7" },
  { key: "light_intensity", label: "Light (lux)",      color: "#f59e0b" },
];

function alertTone(sev: Alert["severity"]) {
  return sev === "critical" ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
       : sev === "warning"  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
       : "bg-sky-500/15 text-sky-700 dark:text-sky-300";
}

export default function DashboardPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [latest, setLatest] = useState<Reading[]>([]);
  const [history, setHistory] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [visible, setVisible] = useState<Set<string>>(new Set(SERIES.map(s => s.key)));

  const load = useCallback(async () => {
    const [d, l, a] = await Promise.all([
      api<{ devices: Device[] }>("/api/devices"),
      api<{ readings: Reading[] }>("/api/sensors/latest"),
      api<{ alerts: Alert[] }>("/api/alerts?ack=false"),
    ]);
    setDevices(d.devices);
    setLatest(l.readings);
    setAlerts(a.alerts);
    if (!deviceId && d.devices.length) setDeviceId(d.devices[0].id);
  }, [deviceId]);

  const loadHistory = useCallback(async (id: string) => {
    if (!id) return;
    const r = await api<{ readings: Reading[] }>(`/api/sensors/history?deviceId=${id}&bucket=minute&limit=500`);
    setHistory(r.readings.map(x => ({ ...x, recorded_at: new Date(x.recorded_at).toISOString() })));
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadHistory(deviceId); }, [deviceId, loadHistory]);

  useEffect(() => {
    const t = setInterval(() => {
      void load();
      if (deviceId) void loadHistory(deviceId);
    }, 5000);
    return () => clearInterval(t);
  }, [deviceId, load, loadHistory]);

  const selectedLatest = useMemo(
    () => latest.find(r => r.device_id === deviceId) ?? latest[0],
    [latest, deviceId]
  );

  const chartData = useMemo(
    () => history.map(r => ({
      ...r,
      temperature: Number(r.temperature),
      humidity: Number(r.humidity),
      water_level: Number(r.water_level),
      ph: Number(r.ph),
      light_intensity: Number(r.light_intensity),
    })),
    [history]
  );

  const toggleSeries = (key: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <AppShell title="Real-Time Monitoring">
      <section className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Device</label>
          <select className="input mt-1" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-[rgb(var(--muted))] mb-2">
          Last update: {selectedLatest ? ago(selectedLatest.recorded_at) : "—"} • Auto-refresh: 5s
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Temperature" icon="🌡️" value={fmt(selectedLatest?.temperature)} unit="°C"
          tone={selectedLatest && Number(selectedLatest.temperature) > 30 ? "bad" : "good"}/>
        <StatCard label="Humidity" icon="💧" value={fmt(selectedLatest?.humidity)} unit="%"
          tone={selectedLatest && Number(selectedLatest.humidity) < 40 ? "warn" : "good"}/>
        <StatCard label="Water Level" icon="🚰" value={fmt(selectedLatest?.water_level)} unit="%"
          tone={selectedLatest && Number(selectedLatest.water_level) < 40 ? "bad" : "good"}/>
        <StatCard label="pH" icon="⚗️" value={fmt(selectedLatest?.ph, 2)}
          tone={(() => { const v = Number(selectedLatest?.ph); return v < 6.0 || v > 7.4 ? "warn" : "good"; })()}/>
        <StatCard label="Light Intensity" icon="🔆" value={fmt(selectedLatest?.light_intensity, 0)} unit="lux"/>
      </section>

      <section className="card">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-medium">Sensor trends (last 500 minute-bucketed samples)</div>
          <div className="flex flex-wrap gap-1">
            {SERIES.map(s => (
              <button key={s.key}
                className={`badge cursor-pointer ${visible.has(s.key) ? "bg-brand-600/15 text-brand-700 dark:text-brand-300" : "bg-black/5 dark:bg-white/10 text-[rgb(var(--muted))]"}`}
                onClick={() => toggleSeries(s.key)}>
                <span className="w-2 h-2 rounded-full mr-1" style={{ background: s.color }}/>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <SensorAreaChart
            data={chartData}
            series={SERIES.filter(s => visible.has(s.key))}
            xTickFormatter={(v) => new Date(v as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          />
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="font-medium mb-2">All devices — latest readings</div>
          <div className="overflow-x-auto">
            <table className="table-default">
              <thead>
                <tr><th>Device</th><th>Temp</th><th>Hum</th><th>Water</th><th>pH</th><th>Light</th><th>Time</th></tr>
              </thead>
              <tbody>
                {latest.map(r => (
                  <tr key={r.device_id} className={r.device_id === deviceId ? "bg-brand-500/5" : ""}>
                    <td className="font-medium">{r.device_name}</td>
                    <td>{fmt(r.temperature)} °C</td>
                    <td>{fmt(r.humidity)} %</td>
                    <td>{fmt(r.water_level)} %</td>
                    <td>{fmt(r.ph, 2)}</td>
                    <td>{fmt(r.light_intensity, 0)} lux</td>
                    <td className="text-[rgb(var(--muted))] text-xs">{ago(r.recorded_at)}</td>
                  </tr>
                ))}
                {!latest.length ? <tr><td colSpan={7} className="text-center text-[rgb(var(--muted))]">No readings yet</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="font-medium mb-2">Active alerts</div>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {alerts.length === 0 ? <div className="text-sm text-[rgb(var(--muted))]">All systems nominal 🎉</div> : null}
            {alerts.map(a => (
              <div key={a.id} className={`rounded-lg px-3 py-2 ${alertTone(a.severity)}`}>
                <div className="text-xs uppercase tracking-wide font-semibold">{a.severity}</div>
                <div className="text-sm">{a.message}</div>
                <div className="text-xs opacity-70">{a.device_name ?? "system"} • {fmtDate(a.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
