import Link from "next/link";
import { Download, LayoutDashboard, LogOut, ArrowUpRight, Database } from "lucide-react";
import { loadReports } from "@/lib/admin/load-reports";
import { dateRange, buildDashboard, type Dashboard } from "@/lib/admin/reports";
import { requireAdmin } from "@/lib/admin/session";
import { adminLogout } from "./login/actions";
import { ReportChart } from "./report-chart";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminAiChat } from "./admin-ai-chat";

const TABS = [{ id: "overview", label: "ภาพรวม" }, { id: "users", label: "ผู้ใช้" }, { id: "destinations", label: "ปลายทาง" }, { id: "timing", label: "ช่วงเวลาเดินทาง" }, { id: "patterns", label: "รูปแบบทริป" }, { id: "finance", label: "การเงิน" }, { id: "vehicles", label: "ยานพาหนะ" }, { id: "schema", label: "โครงสร้างข้อมูล" }];
function Stats({ items }: { items: Dashboard["overview"] }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{items.map((s,i) => <article key={s.label} className="rounded-xl border-[1.5px] border-foreground bg-surface p-4 shadow-hard-sm"><p className="text-xs font-semibold text-subtle">{s.label}</p><p className={`my-2 break-words font-mono text-2xl font-bold ${i%4 === 0 ? "text-accent" : ""}`}>{s.value}</p><p className="text-[11px] leading-relaxed text-subtle">{s.note}</p></article>)}</div>;
}
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const first = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined;
  const range = dateRange(first("from"), first("to"));
  const tab = TABS.some(t => t.id === first("tab")) ? first("tab")! : "overview";
  const result = await loadReports(range);
  const dashboard = result.dashboard ?? buildDashboard({ profiles: [], trips: [], events: [], sessions: [], provinces: [], groups: [] }, range);
  const section = dashboard.sections.find(s => s.id === tab);
  const query = new URLSearchParams({ from: range.from, to: range.to });
  const field = "min-h-10 min-w-0 rounded-lg border border-border bg-surface px-2 text-sm";
  return <div className="space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div><p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-accent"><LayoutDashboard className="size-4" /> Thainhaidee · Admin</p><h1 className="text-2xl font-extrabold sm:text-3xl">รายงานหลังบ้าน</h1><p className="mt-2 text-sm text-muted">เข้าใจผู้ใช้และทริปที่พวกเขาวางแผน</p></div>
      <div className="flex gap-2"><ThemeToggle /><Link href="/" className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-2 text-xs hover:bg-surface-2">หน้าเว็บไซต์ <ArrowUpRight className="size-3" /></Link><form action={adminLogout}><button className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-surface px-3 py-2 text-xs hover:bg-surface-2"><LogOut className="size-3" /> ออกจากระบบ</button></form></div>
    </header>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <form className="flex flex-wrap items-end gap-2"><input type="hidden" name="tab" value={tab} /><label className="grid gap-1 text-xs text-muted">ตั้งแต่<input type="date" name="from" defaultValue={range.from} max={range.to} required className={field} /></label><label className="grid gap-1 text-xs text-muted">ถึง<input type="date" name="to" defaultValue={range.to} required className={field} /></label><button className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 text-sm font-bold text-white hover:opacity-85 dark:text-black">แสดงรายงาน</button><span className="py-2 text-xs text-subtle">เขตเวลาไทย · สูงสุด 366 วัน</span></form>
      {!result.error && <a href={`/admin/export?${query}&tab=${tab}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-foreground bg-surface px-3 text-sm font-semibold hover:bg-surface-2"><Download className="size-4" /> ส่งออก CSV</a>}
    </div>
    <nav aria-label="หมวดรายงาน" className="flex gap-1 overflow-x-auto border-b border-border pb-3">{TABS.map(t => <Link key={t.id} href={`/admin?${query}&tab=${t.id}`} aria-current={tab === t.id ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === t.id ? "bg-foreground text-background" : "hover:bg-surface-2"}`}>{t.label}</Link>)}</nav>
    {result.error ? <div role="alert" className="rounded-xl border border-danger bg-danger-soft p-5"><h2 className="font-bold">ยังโหลดรายงานไม่ได้</h2><p className="mt-2 text-sm">{result.error}</p><p className="mt-2 text-sm">ระบบจะไม่แทนข้อผิดพลาดด้วยตัวเลขศูนย์ กรุณาตั้งค่าการเชื่อมต่อแล้วกดแสดงรายงานอีกครั้ง</p></div> : <div className="rounded-xl border border-border border-l-4 border-l-secondary bg-surface p-4 text-xs leading-relaxed text-muted"><b className="text-secondary">ข้อมูลจริงจากระบบ</b> · ผู้ใช้และทริปกรองตามวันที่สร้าง สถิติการใช้งานเริ่มเก็บหลังติดตั้งระบบรายงาน เฉพาะสมาชิกที่เข้าสู่ระบบ จึงไม่มีข้อมูลย้อนหลังหรือผู้เยี่ยมชมที่ยังไม่เข้าสู่ระบบ</div>}
    {!result.error && tab !== "schema" && <>
      {tab === "overview" && <Stats items={dashboard.overview} />}
      {tab === "patterns" && <Stats items={dashboard.patternStats} />}
      {tab === "finance" && <Stats items={dashboard.financeStats} />}
      {tab === "vehicles" && <Stats items={dashboard.vehicleStats} />}
      {tab === "finance" && <div className="rounded-xl border border-border border-l-4 border-l-brand bg-surface p-4 text-xs leading-relaxed text-muted"><b>ตัวเลขทั้งหมดเป็นประมาณการจากแผน</b> · ค่าน้ำมันคำนวณจากระยะทาง อัตราสิ้นเปลือง และราคาน้ำมันที่ผู้ใช้กรอก ส่วนค่าอาหาร ที่พัก และค่าเข้าชมมาจากค่าเริ่มต้นของระบบหรือที่ผู้ใช้แก้เอง ยังไม่มีการยืนยันยอดใช้จ่ายจริง ยกเว้นราคาที่พักที่ผู้ใช้กรอกตอนจอง</div>}
      <div><h2 className="text-xl font-bold">{section?.title}</h2><p className="mt-1 text-xs text-subtle">{range.from} – {range.to}</p></div>
      {tab === "timing" && <article className="rounded-2xl border-[1.5px] border-foreground bg-surface p-5 shadow-hard-sm"><h3 className="font-bold">วันในสัปดาห์ × ชั่วโมงออกเดินทางตามแผน</h3><p className="mt-1 text-xs text-subtle">เวลาเริ่มขับรถวันแรก · ช่องสีเข้มแสดงจำนวนแผนที่มากขึ้น</p><div className="mt-5 overflow-x-auto"><div className="min-w-[650px]"><div className="mb-2 grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-subtle"><span />{Array.from({length:24},(_,h)=><span key={h}>{h%3===0?String(h).padStart(2,"0"):""}</span>)}</div>{dashboard.heatmap.map((hours,d)=><div key={d} className="mb-1 grid grid-cols-[40px_repeat(24,minmax(0,1fr))] gap-1"><span className="self-center text-xs text-subtle">{["จ.","อ.","พ.","พฤ.","ศ.","ส.","อา."][d]}</span>{hours.map((value,h)=><div key={h} role="img" aria-label={`${["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"][d]} ${h}:00 จำนวน ${value} ทริป`} title={`${h}:00 · ${value} ทริป`} className="h-8 rounded-sm" style={{ background: value ? `color-mix(in srgb, var(--accent) ${20+value/Math.max(...dashboard.heatmap.flat(),1)*80}%, var(--surface))` : "var(--surface-2)" }} />)}</div>)}</div></div></article>}
      <div className="grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">{section?.charts.map(chart => <ReportChart key={chart.id} chart={chart} />)}</div>
    </>}
    {tab === "schema" && <section className="rounded-2xl border border-foreground bg-surface p-5 shadow-hard-sm"><h2 className="mb-5 flex items-center gap-2 text-xl font-bold"><Database className="size-5" /> แหล่งข้อมูลและวิธีนับ</h2><div className="overflow-x-auto"><table className="w-full min-w-[550px] text-left text-sm"><thead><tr className="border-b border-border"><th className="p-3">ข้อมูล</th><th className="p-3">ใช้สำหรับ</th><th className="p-3">ข้อจำกัด</th></tr></thead><tbody>{[
      ["profiles", "ผู้ใช้ใหม่ เพศ อายุ อาชีพ จังหวัด", "กรอง created_at; ไม่ระบุเมื่อผู้ใช้ยังไม่กรอก"],
      ["trips", "ปลายทาง รูปแบบทริป รถ ระยะทาง และพลังงาน", "เฉพาะแผนที่บันทึก; สถิติ 12 เดือนใช้ช่วง 365 วัน"],
      ["trip_days / trip_items", "เวลาตามแผน ค่าใช้จ่าย จุดแวะ และวันที่ทำเสร็จ", "เวลาออกเดินทางคือเวลาตามแผน ไม่ใช่เหตุการณ์จริง"],
      ["trip_items.cost_estimate / cost_category", "รายงานการเงินทุกหมวด", "ประมาณการจากแผน ผู้ใช้แก้เองได้ ไม่ใช่ยอดจ่ายจริง"],
      ["trip_bookings", "ช่องทางจอง สถานะจอง และราคาที่จองจริง", "ผู้ใช้กรอกเอง เฉพาะคืนที่กดยืนยันว่าจองแล้ว"],
      ["analytics_events", "เข้าสู่ระบบและร่างแผนสำเร็จ", "เริ่มนับหลังติดตั้ง; provider หลักของบัญชีอาจต่างจากช่องทางเข้าใช้ล่าสุด"],
      ["analytics_sessions", "DAU, MAU และเวลาใช้งาน", "สมาชิกที่เข้าสู่ระบบ; heartbeat 30 วินาที ขณะหน้าเว็บอยู่ด้านหน้า"],
      ["route_summary.travel_purpose", "วันหยุด เทศกาล และโอกาสพิเศษ", "เริ่มเก็บจากแบบฟอร์มใหม่; แผนเก่าแสดงไม่ระบุ"],
      ["การออกเดินทางจริง", "จำนวนทริปสถานะ active / done", "ระบบเดิมยังไม่มีปุ่มเริ่มทริป จึงยังไม่เกิดสถานะนี้จากหน้าเว็บ"],
    ].map(row=><tr key={row[0]} className="border-b border-border-soft">{row.map((cell,i)=><td key={i} className="p-3 align-top leading-relaxed">{cell}</td>)}</tr>)}</tbody></table></div><p className="mt-5 text-xs text-subtle">รายงานแสดงเฉพาะข้อมูลรวม ไม่ส่งชื่อ อีเมล หรือรหัสผู้ใช้ไปใน CSV · session แอดมินหมดอายุใน 8 ชั่วโมง</p></section>}
    <AdminAiChat range={range} />
  </div>;
}
