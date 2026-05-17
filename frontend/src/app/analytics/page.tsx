"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { SensorLineChart } from "@/components/charts/SensorLineChart";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, fetchAndDownload } from "@/lib/api";

type GrowthRow = { device_id: string; device_name: string; recorded_on: string; gi_value: string | number };
type TrendRow = {
  device_id: string; device_name: string; day: string;
  temperature: string | number; humidity: string | number; water_level: string | number;
  ph: string | number; light_intensity: string | number;
};

const COLORS = ["#06b6d4", "#22c55e", "#ef4444", "#a855f7", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6"];

export default function AnalyticsPage() {
  const [days, setDays] = useState(14);
  const [growth, setGrowth] = useState<GrowthRow[]>([]);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [g, t] = await Promise.all([
      api<{ rows: GrowthRow[] }>("/api/analytics/growth-index"),
      api<{ rows: TrendRow[] }>(`/api/analytics/trends?days=${days}`),
    ]);
    setGrowth(g.rows);
    setTrends(t.rows);
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  // Wide-format trend data per metric for multi-line chart
  function wideByDay(metric: keyof TrendRow): Record<string, number | string>[] {
    const map = new Map<string, Record<string, number | string>>();
    for (const r of trends) {
      const day = new Date(r.day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const entry = map.get(day) ?? { day };
      entry[r.device_name] = Number(r[metric]);
      map.set(day, entry);
    }
    return [...map.values()];
  }

  const devicesInTrends = useMemo(
    () => Array.from(new Set(trends.map(t => t.device_name))),
    [trends]
  );

  const trendSeries = (metric: keyof TrendRow) =>
    devicesInTrends.map((d, i) => ({ key: d, label: d, color: COLORS[i % COLORS.length] }));

  const growthMean = useMemo(() => {
    const byDev = new Map<string, number[]>();
    for (const g of growth) {
      const arr = byDev.get(g.device_name) ?? [];
      arr.push(Number(g.gi_value));
      byDev.set(g.device_name, arr);
    }
    return [...byDev.entries()].map(([device_name, vals]) => ({
      device_name,
      gi: vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length),
    }));
  }, [growth]);

  async function download(kind: "csv" | "pdf") {
    const label = kind === "csv" ? "CSV" : "PDF";
    setDownloading(label);
    try {
      await fetchAndDownload(`/api/analytics/export.${kind}?days=${days}`, `aquagrow_${days}d.${kind}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <AppShell title="Data Analytics">
      <section className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Window</label>
          <select className="input mt-1" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>
        <button className="btn-primary" disabled={!!downloading} onClick={() => download("csv")}>
          {downloading === "CSV" ? "Exporting…" : "⬇ Export CSV"}
        </button>
        <button className="btn-ghost" disabled={!!downloading} onClick={() => download("pdf")}>
          {downloading === "PDF" ? "Exporting…" : "⬇ Export PDF"}
        </button>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-medium mb-1">Growth Index — daily by device</div>
          <SensorLineChart
            data={(() => {
              const map = new Map<string, Record<string, number | string>>();
              for (const g of growth) {
                const day = new Date(g.recorded_on).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                const entry = map.get(day) ?? { day };
                entry[g.device_name] = Number(g.gi_value);
                map.set(day, entry);
              }
              return [...map.values()];
            })()}
            series={Array.from(new Set(growth.map(g => g.device_name))).map((d, i) => ({ key: d, label: d, color: COLORS[i % COLORS.length] }))}
            xKey="day"
            height={260}
          />
        </div>
        <div className="card">
          <div className="font-medium mb-1">Mean Growth Index (period)</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={growthMean} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(125,125,125,0.2)" strokeDasharray="3 3"/>
                <XAxis dataKey="device_name" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }} width={42} domain={[0, 1]}/>
                <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", color: "rgb(var(--fg))" }}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Bar dataKey="gi" name="Mean GI">
                  {growthMean.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="font-medium mb-2">Historical trends per device</div>
        <div className="grid lg:grid-cols-2 gap-6">
          {[
            { key: "temperature", label: "Temperature (°C)" },
            { key: "humidity", label: "Humidity (%)" },
            { key: "water_level", label: "Water Level (%)" },
            { key: "ph", label: "pH" },
            { key: "light_intensity", label: "Light Intensity (lux)" },
          ].map(({ key, label }) => (
            <div key={key}>
              <div className="text-sm text-[rgb(var(--muted))] mb-1">{label}</div>
              <SensorLineChart
                data={wideByDay(key as keyof TrendRow)}
                series={trendSeries(key as keyof TrendRow)}
                xKey="day"
                height={200}
              />
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
