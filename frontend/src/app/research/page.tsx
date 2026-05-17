"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { SensorLineChart } from "@/components/charts/SensorLineChart";

interface Author { name: string; affiliation: string; email: string }
interface ReportSection { heading: string; body: string; tables?: { id: string; caption: string; rows: Record<string, unknown>[] }[] }
interface Report {
  title: string;
  authors: Author[];
  abstract: string;
  keywords: string[];
  sections: ReportSection[];
}

const COLORS = ["#06b6d4", "#22c55e", "#ef4444", "#a855f7", "#f59e0b", "#3b82f6"];

export default function ResearchPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [tempData, setTempData] = useState<{ device_name: string; temperature_mean: number; humidity_mean: number; ph_mean: number; light_mean: number }[]>([]);
  const [growthLine, setGrowthLine] = useState<Record<string, number | string>[]>([]);
  const [growthSeries, setGrowthSeries] = useState<{ key: string; label: string; color: string }[]>([]);
  const [downloading, setDownloading] = useState(false);
  const printableRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [rep, gi] = await Promise.all([
      api<{ report: Report }>("/api/research/report"),
      api<{ rows: { device_name: string; recorded_on: string; gi_value: string | number }[] }>("/api/analytics/growth-index"),
    ]);
    setReport(rep.report);

    const sensorTable = rep.report.sections.find(s => s.heading.startsWith("IV"))?.tables?.[0];
    setTempData(((sensorTable?.rows ?? []) as Record<string, unknown>[]).map((r) => ({
      device_name: String(r.device_name),
      temperature_mean: Number(r.temperature_mean),
      humidity_mean: Number(r.humidity_mean),
      ph_mean: Number(r.ph_mean),
      light_mean: Number(r.light_mean),
    })));

    const map = new Map<string, Record<string, number | string>>();
    for (const r of gi.rows) {
      const day = new Date(r.recorded_on).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const entry = map.get(day) ?? { day };
      entry[r.device_name] = Number(r.gi_value);
      map.set(day, entry);
    }
    const devs = Array.from(new Set(gi.rows.map(r => r.device_name)));
    setGrowthLine([...map.values()]);
    setGrowthSeries(devs.map((d, i) => ({ key: d, label: d, color: COLORS[i % COLORS.length] })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function downloadReportPdf() {
    if (!printableRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const node = printableRef.current;
      const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 40;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = 20;
      if (imgH < pageH - 40) {
        pdf.addImage(imgData, "PNG", 20, y, imgW, imgH);
      } else {
        // multi-page: slice by destination page height
        const sliceH = ((pageH - 40) * canvas.width) / imgW;
        let pos = 0;
        while (pos < canvas.height) {
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = Math.min(sliceH, canvas.height - pos);
          const ctx = slice.getContext("2d");
          if (!ctx) break;
          ctx.drawImage(canvas, 0, pos, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
          const sliceData = slice.toDataURL("image/png");
          const sliceImgH = (slice.height * imgW) / canvas.width;
          if (pos > 0) pdf.addPage();
          pdf.addImage(sliceData, "PNG", 20, 20, imgW, sliceImgH);
          pos += slice.height;
        }
      }
      pdf.save("aquagrow_research_report.pdf");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadChartPng(id: string, filename: string) {
    const node = document.getElementById(id);
    if (!node) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 3 });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename;
    a.click();
  }

  return (
    <AppShell title="Research Presentation">
      <section className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={downloadReportPdf} disabled={downloading || !report}>
          {downloading ? "Rendering…" : "⬇ Export Report PDF (IEEE-style)"}
        </button>
        <button className="btn-ghost" onClick={() => downloadChartPng("chart-means", "aquagrow_means.png")}>
          ⬇ Means chart (PNG, PPT-ready)
        </button>
        <button className="btn-ghost" onClick={() => downloadChartPng("chart-gi", "aquagrow_growth_index.png")}>
          ⬇ Growth index chart (PNG, PPT-ready)
        </button>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-medium mb-2">Per-device sensor means (publication-ready)</div>
          <div id="chart-means" style={{ height: 280, background: "rgb(var(--card))" }}>
            <ResponsiveContainer>
              <BarChart data={tempData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(125,125,125,0.2)" strokeDasharray="3 3"/>
                <XAxis dataKey="device_name" tick={{ fontSize: 10 }}/>
                <YAxis tick={{ fontSize: 11 }} width={42}/>
                <Tooltip contentStyle={{ background: "rgb(var(--card))", border: "1px solid rgb(var(--border))", color: "rgb(var(--fg))" }}/>
                <Legend wrapperStyle={{ fontSize: 12 }}/>
                <Bar dataKey="temperature_mean" name="Temperature (°C)" fill="#ef4444"/>
                <Bar dataKey="humidity_mean" name="Humidity (%)" fill="#06b6d4"/>
                <Bar dataKey="ph_mean" name="pH" fill="#a855f7"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="font-medium mb-2">Growth Index trajectories</div>
          <div id="chart-gi" style={{ height: 280, background: "rgb(var(--card))" }}>
            <SensorLineChart
              data={growthLine}
              series={growthSeries}
              xKey="day"
              height={280}
            />
          </div>
        </div>
      </section>

      {report ? (
        <section className="card">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="font-medium">IEEE-style report preview</div>
            <div className="text-xs text-[rgb(var(--muted))]">Use the export button above for a PDF copy.</div>
          </div>

          <article ref={printableRef} className="mt-4 rounded-lg border border-[rgb(var(--border))] bg-white text-black p-8 font-serif max-w-[860px] mx-auto">
            <h1 className="text-2xl font-bold text-center leading-snug">{report.title}</h1>
            <div className="text-sm text-center mt-2">
              {report.authors.map(a => `${a.name} (${a.affiliation})`).join(", ")}
            </div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-justify">
              <p><b>Abstract — </b>{report.abstract}</p>
              <p><b>Keywords — </b>{report.keywords.join(", ")}</p>
            </div>
            <hr className="my-4 border-black/20"/>
            <div className="space-y-4 text-justify columns-1 sm:columns-2 gap-6">
              {report.sections.map((s) => (
                <div key={s.heading} className="break-inside-avoid">
                  <h2 className="font-semibold text-sm uppercase tracking-wide">{s.heading}</h2>
                  <p className="text-sm whitespace-pre-line mt-1">{s.body}</p>
                  {s.tables?.map(t => (
                    <div key={t.id} className="mt-2">
                      <div className="text-xs font-medium">Table {t.id}. {t.caption}</div>
                      <table className="w-full text-[11px] border border-black/30 mt-1">
                        <thead className="bg-black/5">
                          <tr>{Object.keys(t.rows[0] ?? {}).map(k => <th key={k} className="px-1 py-0.5 border border-black/20 text-left">{k}</th>)}</tr>
                        </thead>
                        <tbody>
                          {t.rows.map((row, i) => (
                            <tr key={i}>
                              {Object.values(row).map((v, j) => (
                                <td key={j} className="px-1 py-0.5 border border-black/10">{String(v)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
