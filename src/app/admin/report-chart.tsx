import { BarChart3 } from "lucide-react";
import { numberFormat, type Chart } from "@/lib/admin/reports";

const COLORS = ["#ed561e", "#2b79d8", "#0d9b80", "#b58a08", "#7952c7", "#bd3763", "#64748b"];
export function ReportChart({ chart }: { chart: Chart }) {
  const max = Math.max(...chart.rows.map(r => r.value), 1);
  const total = chart.rows.reduce((s,r) => s+r.value,0);
  const donut = ["gender", "fuel", "route-style"].includes(chart.id);
  const line = chart.id === "dau" || chart.id.startsWith("login-");
  const points = chart.rows.map((r,i) => `${12 + i / Math.max(chart.rows.length-1,1) * 376},${150 - r.value / max * 130}`).join(" ");
  const gradient = chart.rows.map((r,i) => {
    const start = chart.rows.slice(0,i).reduce((s,v)=>s+v.value,0) / Math.max(total,1) * 100;
    return `${COLORS[i%COLORS.length]} ${start}% ${start+r.value/Math.max(total,1)*100}%`;
  }).join(",");
  return <article className="min-w-0 rounded-2xl border-[1.5px] border-foreground bg-surface p-4 shadow-hard-sm sm:p-5">
    <h3 className="font-display text-base font-bold">{chart.title}</h3>
    <p className="mb-5 mt-1 min-h-8 text-xs leading-relaxed text-subtle">{chart.note}</p>
    {!total ? <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-3 text-sm text-subtle"><BarChart3 className="size-8" aria-hidden="true" /><p>{chart.id === "occasion" ? "ยังไม่มีข้อมูลประเภทนี้" : "ยังไม่มีข้อมูลในช่วงที่เลือก"}</p></div> : donut ? <div className="flex min-h-44 flex-wrap items-center justify-center gap-5">
      <div role="img" aria-label={`${chart.title} รวม ${numberFormat(total)}`} className="grid size-40 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}><div className="grid size-24 place-content-center rounded-full bg-surface text-center"><b className="font-mono text-xl">{numberFormat(total)}</b><span className="text-xs text-subtle">ทั้งหมด</span></div></div>
      <ul className="space-y-2 text-xs">{chart.rows.map((r,i) => <li key={r.label} className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: COLORS[i%COLORS.length] }} /><span>{r.label}</span><b>{numberFormat(r.value)}</b></li>)}</ul>
    </div> : line ? <div className="min-h-44">
      <div className="flex justify-between text-xs text-subtle"><span>จำนวน {chart.id === "dau" ? "คน" : "ครั้ง"}</span><span>สูงสุด {numberFormat(max)}</span></div>
      <svg viewBox="0 0 400 165" role="img" aria-label={chart.title} className="mt-2 w-full overflow-visible">
        {[20,63,107,150].map(y => <line key={y} x1="12" x2="388" y1={y} y2={y} stroke="var(--border)" />)}
        <polygon points={`12,150 ${points} 388,150`} fill={chart.color ?? "#ed561e"} opacity=".12" />
        <polyline points={points} fill="none" stroke={chart.color ?? "#ed561e"} strokeWidth="2.5" strokeLinejoin="round" />
      </svg><div className="flex justify-between text-[10px] text-subtle"><span>{chart.rows[0]?.label}</span><span>{chart.rows.at(-1)?.label}</span></div>
    </div> : <div className="max-h-96 min-h-44 space-y-3 overflow-y-auto pr-1">{chart.rows.map(r => <div key={r.label}>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-xs"><span className="break-words">{r.label}</span><b className="shrink-0 font-mono">{numberFormat(r.value)}</b></div>
      <div className="h-3 rounded-sm bg-surface-2"><div className="h-full rounded-sm" style={{ width: `${r.value / max * 100}%`, background: chart.color ?? "#ed561e" }} /></div>
    </div>)}</div>}
    <details className="mt-5 rounded-lg border border-border bg-surface-3 text-xs">
      <summary className="cursor-pointer px-3 py-2 font-semibold hover:text-accent">ดูเป็นตาราง</summary>
      <div className="max-h-72 overflow-auto px-3 pb-3"><table className="w-full text-left"><caption className="sr-only">{chart.title}</caption><thead><tr className="border-b border-border"><th scope="col" className="py-2">รายการ</th><th scope="col" className="py-2 text-right">จำนวน</th></tr></thead><tbody>{chart.rows.map(r => <tr key={r.label} className="border-b border-border-soft"><th scope="row" className="py-2 font-normal">{r.label}</th><td className="text-right font-mono">{numberFormat(r.value)}</td></tr>)}{!chart.rows.length && <tr><td colSpan={2} className="py-3 text-subtle">ยังไม่มีข้อมูล</td></tr>}</tbody></table></div>
    </details>
  </article>;
}
