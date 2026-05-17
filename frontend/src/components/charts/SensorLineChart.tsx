"use client";

import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export type Series = { key: string; label: string; color: string; unit?: string };
export type Row = Record<string, number | string>;

export function SensorLineChart({
  data,
  series,
  xKey = "recorded_at",
  height = 280,
  xTickFormatter,
}: {
  data: Row[];
  series: Series[];
  xKey?: string;
  height?: number;
  xTickFormatter?: (v: string | number) => string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(125,125,125,0.2)" strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} tickFormatter={xTickFormatter} minTickGap={32} />
          <YAxis tick={{ fontSize: 11 }} width={42} />
          <Tooltip
            contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", color: "rgb(var(--fg))" }}
            labelFormatter={(v) => xTickFormatter ? xTickFormatter(v) : String(v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
