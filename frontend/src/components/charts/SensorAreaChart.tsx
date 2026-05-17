"use client";

import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { Series, Row } from "./SensorLineChart";

export function SensorAreaChart({
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
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient id={`grad-${s.key}`} key={s.key} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.5}/>
                <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="rgba(125,125,125,0.2)" strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} tickFormatter={xTickFormatter} minTickGap={32}/>
          <YAxis tick={{ fontSize: 11 }} width={42}/>
          <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", color: "rgb(var(--fg))" }}
            labelFormatter={(v) => xTickFormatter ? xTickFormatter(v) : String(v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label}
              stroke={s.color} fillOpacity={1} fill={`url(#grad-${s.key})`} strokeWidth={2}/>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
