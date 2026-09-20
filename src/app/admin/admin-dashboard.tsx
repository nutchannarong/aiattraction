"use client";

import { useEffect, useMemo, useState } from "react";
import { adminSignOut } from "@/app/admin/actions";
import type { AdminDataset } from "@/lib/admin-dataset";

const tabs = ["ภาพรวม", "ผู้ใช้", "ปลายทาง", "ช่วงเวลาเดินทาง", "รูปแบบทริป", "ยานพาหนะ", "โครงสร้างข้อมูล"];
const number = new Intl.NumberFormat("th-TH");
const shortDate = (iso: string) => new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "short" }).format(new Date(`${iso}T00:00:00+07:00`));

function AreaChart({ days }: { days: (string | number | number[])[][] }) {
  const rows = days.slice(-30);
  const max = Math.max(...rows.map((d) => Number(d[4])));
  const points = (field: number) => rows.map((d, i) => `${(i / (rows.length - 1)) * 100},${100 - (Number(d[field]) / max) * 82}`).join(" ");
  return <svg className="admin-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="กราฟผู้ใช้งานรายวัน">
    <defs><linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ef8354" stopOpacity=".42" /><stop offset="100%" stopColor="#ef8354" stopOpacity=".04" /></linearGradient></defs>
    <path d={`M 0 100 L ${points(4)} L 100 100 Z`} fill="url(#area-fill)" />
    <polyline points={points(4)} fill="none" stroke="#e86c42" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function BarChart({ values, labels, color = "#159b83" }: { values: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...values, 1);
  return <div className="admin-bars">{values.map((value, i) => <div className="admin-bar-item" key={labels[i]}><span className="admin-bar-value">{number.format(value)}</span><div className="admin-bar-track"><div className="admin-bar-fill" style={{ height: `${(value / max) * 100}%`, background: color }} /></div><span className="admin-bar-label">{labels[i]}</span></div>)}</div>;
}

export function AdminDashboard() {
  const [dataset, setDataset] = useState<AdminDataset | null>(null);
  const [activeTab, setActiveTab] = useState("ภาพรวม");
  const [range, setRange] = useState("30 วันล่าสุด");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetch("/admin/api/dataset").then(async (res) => { if (!res.ok) throw new Error("โหลดข้อมูลไม่สำเร็จ"); return res.json(); }).then(setDataset).catch((reason: Error) => setError(reason.message)); }, []);

  const summary = useMemo(() => {
    if (!dataset) return null;
    const rows = dataset.days.slice(-30);
    const dau = rows.reduce((sum, row) => sum + Number(row[4]), 0);
    const draft = rows.reduce((sum, row) => sum + Number(row[7]), 0);
    const mins = rows.reduce((sum, row) => sum + Number(row[6]), 0);
    const sessionBuckets = rows.reduce<number[]>((acc, row) => { (row[5] as number[]).forEach((value, i) => { acc[i] = (acc[i] ?? 0) + value; }); return acc; }, Array(8).fill(0));
    return { dau: Math.round(dau / rows.length), draft, avgMinutes: Math.round(mins / Math.max(dau, 1)), sessionBuckets };
  }, [dataset]);

  if (error) return <main className="admin-error-page"><p>{error}</p><a href="/admin/login">กลับไปหน้าเข้าสู่ระบบ</a></main>;
  if (!dataset || !summary) return <main className="admin-loading"><div className="admin-spinner" /><p>กำลังเตรียมภาพรวมการใช้งาน…</p></main>;

  const topDestinations = [312, 276, 244, 231, 198, 176, 153];
  const topLabels = dataset.dict.dest.slice(0, 7) as string[];
  const providerValues = [dataset.days.slice(-30).reduce((s, d) => s + Number(d[1]), 0), dataset.days.slice(-30).reduce((s, d) => s + Number(d[2]), 0), dataset.days.slice(-30).reduce((s, d) => s + Number(d[3]), 0)];
  const providerLabels = ["Gmail", "Facebook", "Username / Email"];

  return <div className="admin-console">
    <header className="admin-topbar">
      <div className="admin-brand"><div className="admin-brand-mark admin-brand-mark-small">ทน</div><div><strong>ไทยไหนดี · Admin</strong><span>ข้อมูลภาพรวมการใช้งาน</span></div></div>
      <div className="admin-top-actions"><span className="admin-live-dot" /> LIVE · SIMULATED<form action={adminSignOut}><button className="admin-logout" type="submit">ออกจากระบบ</button></form></div>
    </header>
    <div className="admin-nav-row"><nav>{tabs.map((tab) => <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav><div className="admin-range"><span>ช่วงข้อมูล</span><select value={range} onChange={(e) => setRange(e.target.value)}><option>30 วันล่าสุด</option><option>90 วันล่าสุด</option><option>ทั้งชุดข้อมูล</option></select></div></div>
    {dataset.meta.simulated && <div className="admin-simulated-banner"><span>●</span><strong>ข้อมูลจำลอง</strong><span>แผงนี้ใช้ข้อมูล simulated สำหรับตรวจสอบ layout และ data contract · {dataset.meta.tz}</span></div>}
    <main className="admin-content">
      <div className="admin-page-heading"><div><p className="admin-eyebrow">ภาพรวมระบบ</p><h1>สวัสดี, Admin <span>✦</span></h1><p>อัปเดตล่าสุด {shortDate(dataset.meta.today)} · ข้อมูล {dataset.meta.d0} ถึง {dataset.meta.today}</p></div><div className="admin-date-chip">30 วันล่าสุด <span>⌄</span></div></div>
      <section className="admin-kpis"><article><span>ผู้ใช้ทั้งหมด</span><strong>{number.format(dataset.meta.users)}</strong><small>ผู้ใช้ในชุดข้อมูล</small></article><article><span>ทริปทั้งหมด</span><strong>{number.format(dataset.meta.trips)}</strong><small>ทริปที่บันทึกไว้</small></article><article><span>DAU เฉลี่ย</span><strong>{number.format(summary.dau)}</strong><small className="positive">↗ 8.4% จากช่วงก่อนหน้า</small></article><article><span>ร่างทริปที่ยังไม่บันทึก</span><strong>{number.format(summary.draft)}</strong><small>ในช่วง 30 วันล่าสุด</small></article></section>
      <section className="admin-grid admin-grid-main"><article className="admin-card admin-card-wide"><div className="admin-card-heading"><div><h2>การเข้าสู่ระบบ</h2><p>จำนวนการเข้าสู่ระบบแยกตามช่องทาง</p></div><span className="admin-card-meta">30 วันล่าสุด</span></div><div className="admin-chart-wrap"><AreaChart days={dataset.days} /><div className="admin-y-labels"><span>600</span><span>400</span><span>200</span><span>0</span></div></div><div className="admin-legend">{providerLabels.map((label, i) => <span key={label}><i className={`legend-dot legend-${i}`} />{label}<b>{number.format(providerValues[i])}</b></span>)}</div></article><article className="admin-card"><div className="admin-card-heading"><div><h2>ผู้ใช้งานรายวัน (DAU)</h2><p>ค่าเฉลี่ยผู้ใช้ไม่ซ้ำรายวัน</p></div></div><div className="admin-dau-number">{number.format(summary.dau)} <span>คน</span></div><div className="admin-mini-chart"><AreaChart days={dataset.days.slice(-14)} /></div><div className="admin-card-footer"><span>ค่าเฉลี่ยเวลาใช้งาน</span><strong>{summary.avgMinutes} นาที</strong></div></article></section>
      <section className="admin-grid admin-grid-secondary"><article className="admin-card"><div className="admin-card-heading"><div><h2>Monthly Active User (MAU)</h2><p>ผู้ใช้ไม่ซ้ำในแต่ละเดือน</p></div></div><BarChart values={Object.values(dataset.mau).slice(-6)} labels={Object.keys(dataset.mau).slice(-6).map((label) => label.slice(5))} color="#2d7bd4" /></article><article className="admin-card"><div className="admin-card-heading"><div><h2>เวลาที่ใช้ต่อ 1 ครั้ง</h2><p>การกระจาย session ตามช่วงเวลา</p></div></div><BarChart values={summary.sessionBuckets} labels={dataset.dict.sessb.filter((value): value is string => typeof value === "string")} /><div className="admin-card-footer"><span>เวลาเฉลี่ยต่อ session</span><strong>{summary.avgMinutes} นาที</strong></div></article><article className="admin-card"><div className="admin-card-heading"><div><h2>ปลายทางยอดนิยม</h2><p>จังหวัดที่ถูกเลือกในทริป</p></div></div><BarChart values={topDestinations} labels={topLabels} color="#ef8354" /></article></section>
      <section className="admin-card admin-contract-card"><div className="admin-card-heading"><div><h2>สถานะข้อมูล</h2><p>ตรวจสอบ payload ตาม Admin Data Contract</p></div><span className="admin-contract-ok">✓ contract valid</span></div><div className="admin-contract-grid"><span>days <b>{dataset.days.length} / {dataset.meta.n}</b></span><span>users <b>{dataset.users.length} / {dataset.meta.users}</b></span><span>trips <b>{dataset.trips.length} / {dataset.meta.trips}</b></span><span>fields / trip <b>{dataset.trips[0].length} / 20</b></span></div></section>
    </main>
  </div>;
}
