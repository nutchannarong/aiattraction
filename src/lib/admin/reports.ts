export type Row = { label: string; value: number };
export type Chart = { id: string; title: string; note: string; rows: Row[]; color?: string };
export type Section = { id: string; label: string; title: string; charts: Chart[] };
export type ProfileRow = { id: string; birth_date: string | null; gender: string | null; occupation: string | null; home_province_id: string | null; created_at: string };
export type TripRow = {
  id: string; user_id: string; created_at: string; start_date: string; end_date: string; status: string;
  origin: { province_id?: string | null; label?: string; sublabel?: string | null; province_name_th?: string | null }; destination: { province_id?: string | null; label?: string; sublabel?: string | null; province_name_th?: string | null };
  travelers: { adults?: number; children?: number; seniors?: number }; occasion: string | null; interests: string[];
  vehicle: { type?: string; brand?: string; year?: number; cc?: number; fuel?: string };
  route_style: string; route_summary: { distance_km?: number; fuel_cost?: number; fuel_units?: number; travel_purpose?: string | null } | null;
  trip_days: { day_index: number; date: string; finished_at: string | null; trip_items: { start_time: string | null; kind: string; place_category: string | null; cost_estimate: number | null; cost_category: string | null }[] }[];
};
export type SessionRow = { id: string; user_id: string; started_at: string; last_seen_at: string; active_seconds: number };
export type EventRow = { id: number; user_id: string; kind: string; provider: string | null; created_at: string };
export type ReportInput = { profiles: ProfileRow[]; trips: TripRow[]; events: EventRow[]; sessions: SessionRow[]; provinces: { id: string; name_th: string }[]; groups: { key: string; label_th: string }[] };
export type Dashboard = ReturnType<typeof buildDashboard>;
export const bangkokDate = (date: string | Date) => new Date(new Date(date).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
export const numberFormat = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 1 });
export function validDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}
export function dateRange(from?: string, to?: string) {
  const today = bangkokDate(new Date());
  const end = validDate(to) && to <= today ? to : today;
  const fallback = new Date(Date.parse(end) - 29 * 86400_000).toISOString().slice(0, 10);
  const start = validDate(from) && from <= end && Date.parse(end) - Date.parse(from) <= 365 * 86400_000 ? from : fallback;
  return { from: start, to: end };
}
const count = (values: (string | null | undefined)[], limit = 100): Row[] => {
  const counts = new Map<string, number>();
  for (const value of values) { const key = value?.trim() || "ไม่ระบุ"; counts.set(key, (counts.get(key) ?? 0) + 1); }
  return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)).slice(0, limit);
};
const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const mode = (values: string[]) => count(values)[0]?.label ?? "—";
const unique = (values: string[]) => new Set(values).size;
const numeric = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const labelMap = (map: Record<string, string>, key?: string | null) => key ? map[key] ?? key : "ไม่ระบุ";

export function buildDashboard(input: ReportInput, range: { from: string; to: string }) {
  const inside = (date: string) => bangkokDate(date) >= range.from && bangkokDate(date) <= range.to;
  const trips = input.trips.filter(t => inside(t.created_at));
  const profiles = input.profiles.filter(p => inside(p.created_at));
  const sessions = input.sessions.filter(s => inside(s.started_at));
  const events = input.events.filter(e => inside(e.created_at));
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400_000) + 1;
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.parse(range.from) + i * 86400_000).toISOString().slice(0, 10));
  const activity = [...sessions.map(s => ({ date: bangkokDate(s.started_at), user: s.user_id })), ...events.map(e => ({ date: bangkokDate(e.created_at), user: e.user_id }))];
  const daily = dates.map(date => ({ label: date, value: unique(activity.filter(a => a.date === date).map(a => a.user)) }));
  const monthly = [...new Set(dates.map(d => d.slice(0, 7)))].map(month => ({ label: month, value: unique(activity.filter(a => a.date.startsWith(month)).map(a => a.user)) }));
  const latestMau = monthly.at(-1)?.value ?? 0;
  const dailyAvg = avg(daily.map(d => d.value)) ?? 0;
  const provinceNames = Object.fromEntries(input.provinces.map(p => [p.id, p.name_th]));
  const provinceSet = new Set(input.provinces.map(p => p.name_th));
  const sortedProvinces = [...input.provinces].sort((a, b) => b.name_th.length - a.name_th.length);
  const groupNames = Object.fromEntries(input.groups.map(g => [g.key, g.label_th]));
  const province = (p: TripRow["origin"]) => {
    if (!p) return "ไม่ระบุจังหวัด";
    if (p.province_id && provinceNames[p.province_id]) return provinceNames[p.province_id];
    const provNameTh = (p as { province_name_th?: string }).province_name_th;
    if (provNameTh && provinceSet.has(provNameTh)) return provNameTh;
    if (p.label && provinceSet.has(p.label.trim())) return p.label.trim();
    if (p.sublabel) {
      const parts = p.sublabel.split(/[·,\/|-]/).map(s => s.trim());
      for (const part of parts.reverse()) {
        if (provinceSet.has(part)) return part;
        const clean = part.replace(/^(จ\.|จังหวัด)\s*/, "").trim();
        if (provinceSet.has(clean)) return clean;
      }
      for (const prov of sortedProvinces) {
        if (p.sublabel.includes(prov.name_th)) return prov.name_th;
      }
    }
    if (p.label) {
      for (const prov of sortedProvinces) {
        if (p.label.includes(prov.name_th)) return prov.name_th;
      }
    }
    return "ไม่ระบุจังหวัด";
  };
  const gender = { male: "ชาย", female: "หญิง", other: "อื่น ๆ", unspecified: "ไม่ระบุ" };
  const companion = (t: TripRow) => (t.travelers.children ?? 0) && (t.travelers.seniors ?? 0) ? "ครอบครัว · เด็กและผู้สูงอายุ" : (t.travelers.children ?? 0) ? "ครอบครัว · มีเด็ก" : (t.travelers.seniors ?? 0) ? "ครอบครัว · มีผู้สูงอายุ" : labelMap({ couple: "คู่รัก", friends: "กลุ่มเพื่อน", family: "ครอบครัว", parents: "พาพ่อแม่เที่ยว", solo: "เดินทางคนเดียว" }, t.occasion);
  const travelerCount = (t: TripRow) => (t.travelers.adults ?? 0) + (t.travelers.children ?? 0) + (t.travelers.seniors ?? 0);
  const duration = (t: TripRow) => Math.round((Date.parse(t.end_date) - Date.parse(t.start_date)) / 86400_000) + 1;
  const tripItems = trips.flatMap(t => t.trip_days.flatMap(d => d.trip_items));
  const ageBand = (birth: string | null) => {
    if (!birth) return "ไม่ระบุ";
    let age = Number(range.to.slice(0, 4)) - Number(birth.slice(0, 4));
    if (range.to.slice(5) < birth.slice(5)) age--;
    return age < 0 ? "ไม่ระบุ" : age < 18 ? "ต่ำกว่า 18" : age <= 22 ? "18–22" : age <= 30 ? "23–30" : age <= 45 ? "31–45" : age <= 59 ? "46–59" : "60+";
  };
  const departures = trips.flatMap(t => {
    const first = [...t.trip_days].sort((a,b) => a.day_index-b.day_index)[0];
    const time = first?.trip_items.filter(i => i.kind === "drive" && i.start_time).map(i => i.start_time!).sort()[0];
    return time ? [{ date: t.start_date, hour: Number(time.slice(0,2)), weekday: (new Date(`${t.start_date}T00:00:00Z`).getUTCDay() + 6) % 7 }] : [];
  });
  const heatmap = Array.from({ length: 7 }, (_, weekday) => Array.from({ length: 24 }, (_, hour) => departures.filter(d => d.weekday === weekday && d.hour === hour).length));
  const finished = trips.filter(t => t.status === "done" || (t.trip_days.length > 0 && t.trip_days.every(d => d.finished_at))).length;
  const started = trips.filter(t => t.status === "active" || t.status === "done").length;
  const metric = (label: string, value: number | string | null, note: string, unit = "") => ({ label, value: value === null ? "—" : typeof value === "number" ? numberFormat(value) + unit : value, note });
  const chart = (id: string, title: string, note: string, rows: Row[], color?: string): Chart => ({ id, title, note, rows, color });
  const cohort = "ทริปที่บันทึกในช่วงวันที่เลือก";
  const yearStart = new Date(Date.parse(range.to) - 364 * 86400_000).toISOString().slice(0,10);
  const annual = count(input.trips.filter(t => bangkokDate(t.created_at) >= yearStart && bangkokDate(t.created_at) <= range.to).map(t => t.user_id));
  const usersWithTrips = unique(trips.map(t => t.user_id));
  const costValues = trips.map(t => (t.route_summary?.fuel_cost ?? 0) + t.trip_days.flatMap(d => d.trip_items).filter(i => i.cost_category !== "fuel").reduce((s,i) => s + (i.cost_estimate ?? 0), 0));
  const sections: Section[] = [
    { id: "overview", label: "ภาพรวม", title: "การเข้าใช้งานและเส้นทางผู้ใช้", charts: [
      ...["google", "email"].map(provider => chart(`login-${provider}`, `เข้าสู่ระบบ · ${provider === "google" ? "Google" : "อีเมล"}`, "จำนวนครั้งต่อวัน · จัดกลุ่มตาม provider หลักของบัญชี", dates.map(date => ({ label: date, value: events.filter(e => e.kind === "login" && e.provider === provider && bangkokDate(e.created_at) === date).length })), provider === "google" ? "#2b79d8" : "#0d9b80")),
      chart("dau", "Daily Active Users (DAU)", "บัญชีที่ใช้งานไม่ซ้ำต่อวัน · เวลาไทย", daily),
      chart("mau", "Monthly Active Users (MAU)", "บัญชีไม่ซ้ำต่อเดือน เฉพาะวันที่อยู่ในช่วงเลือก", monthly, "#2b79d8"),
      chart("duration", "เวลาใช้งานต่อครั้ง", "นับเฉพาะเวลาที่เปิดหน้าเว็บอยู่ด้านหน้า · heartbeat ทุก 30 วินาที", count(sessions.map(s => s.active_seconds < 60 ? "<1 นาที" : s.active_seconds < 180 ? "1–3 นาที" : s.active_seconds < 300 ? "3–5 นาที" : s.active_seconds < 600 ? "5–10 นาที" : s.active_seconds < 1200 ? "10–20 นาที" : s.active_seconds < 1800 ? "20–30 นาที" : s.active_seconds < 3600 ? "30–60 นาที" : "60+ นาที")), "#0d9b80"),
      chart("funnel", "การสร้างแผน → จบทริป", "การร่างแผนนับครั้งของสมาชิก ส่วนขั้นถัดไปนับทริปที่บันทึกในช่วงเลือก จึงไม่ใช้คำนวณ conversion", [
        { label: "ร่างแผนสำเร็จ (ครั้ง)", value: events.filter(e => e.kind === "plan_created").length }, { label: "บันทึกแผน (ทริป)", value: trips.length }, { label: "ออกเดินทาง (สถานะ active/done)", value: started }, { label: "จบครบทุกวัน", value: finished },
      ]),
    ] },
    { id: "users", label: "ผู้ใช้", title: "ใครคือผู้ใช้ของเรา", charts: [
      chart("gender", "เพศ", "สมาชิกที่สมัครในช่วงเลือก", count(profiles.map(p => labelMap(gender, p.gender)))),
      chart("age", "ช่วงอายุ", "อายุ ณ วันสิ้นสุดช่วงที่เลือก", count(profiles.map(p => ageBand(p.birth_date)))),
      chart("occupation", "อาชีพ", "สมาชิกที่สมัครในช่วงเลือก", count(profiles.map(p => p.occupation)), "#2b79d8"),
      chart("home", "จังหวัดบ้านเกิด · 10 อันดับ", "สมาชิกที่สมัครในช่วงเลือก", count(profiles.map(p => p.home_province_id ? provinceNames[p.home_province_id] : null), 10), "#0d9b80"),
    ] },
    { id: "destinations", label: "ปลายทาง", title: "คนอยากไปไหน และออกจากไหน", charts: [
      chart("destination", "จังหวัดปลายทาง · 14 อันดับ", cohort, count(trips.map(t => province(t.destination)), 14)),
      chart("origin", "จังหวัดต้นทาง · 10 อันดับ", cohort, count(trips.map(t => province(t.origin)), 10), "#2b79d8"),
      chart("routes", "คู่เส้นทางยอดนิยม", cohort, count(trips.map(t => `${province(t.origin)} → ${province(t.destination)}`), 12), "#7952c7"),
    ] },
    { id: "timing", label: "ช่วงเวลาเดินทาง", title: "คนวางแผนออกเดินทางตอนไหน", charts: [
      chart("hours", "ชั่วโมงออกเดินทางตามแผน", "เวลาเริ่มขับรถรายการแรกของวันแรก ไม่ใช่เวลาเดินทางจริง", Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2,"0")}:00`, value: departures.filter(d => d.hour === hour).length })), "#b58a08"),
      chart("weekdays", "วันออกเดินทาง", cohort, ["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"].map((label, i) => ({ label, value: trips.filter(t => (new Date(`${t.start_date}T00:00:00Z`).getUTCDay()+6)%7 === i).length }))),
      chart("months", "เดือนออกเดินทาง", cohort, count(trips.map(t => t.start_date.slice(0,7))), "#2b79d8"),
      chart("years", "ปีออกเดินทาง", cohort, count(trips.map(t => String(Number(t.start_date.slice(0,4))+543))), "#7952c7"),
    ] },
    { id: "patterns", label: "รูปแบบทริป", title: "ทริปแบบไหนที่คนวางแผนมากที่สุด", charts: [
      chart("companions", "เดินทางไปกับใคร", "แยกครอบครัวที่มีเด็ก / ผู้สูงอายุจากจำนวนผู้เดินทาง", count(trips.map(companion))),
      chart("interests", "สไตล์การเที่ยวที่เลือก", "เลือกได้หลายรายการต่อทริป สัดส่วนจึงอาจรวมเกิน 100%", count(trips.flatMap(t => t.interests.map(k => groupNames[k] ?? k))), "#7952c7"),
      chart("occasion", "โอกาสในการเดินทาง", "เริ่มเก็บจากตัวเลือกโอกาสเดินทางในแบบฟอร์มวางแผน · แผนเก่าแสดงไม่ระบุ", count(trips.map(t => labelMap({ holiday: "วันหยุดยาว", festival: "เทศกาล / ประเพณี", homecoming: "กลับบ้าน / เยี่ยมญาติ", celebration: "ฉลองวันพิเศษ", leisure: "พักผ่อน / เที่ยวทั่วไป" }, t.route_summary?.travel_purpose))), "#7952c7"),
      chart("categories", "หมวดสถานที่ที่อยากแวะ", "นับจุดแวะในทริปที่บันทึก", count(tripItems.filter(i => i.kind === "attraction" || i.kind === "poi").map(i => i.place_category ? groupNames[i.place_category] ?? i.place_category : null)), "#0d9b80"),
      chart("days", "จำนวนวันต่อทริป", cohort, count(trips.map(t => `${duration(t)} วัน`)), "#2b79d8"),
      chart("travelers", "จำนวนผู้เดินทางต่อทริป", cohort, count(trips.map(t => `${travelerCount(t)} คน`)), "#b58a08"),
      chart("frequency", "จำนวนทริปต่อคนใน 12 เดือน", `365 วันถึง ${range.to} · เฉพาะผู้ที่บันทึกทริป`, count(annual.map(r => r.value === 1 ? "1 ทริป" : r.value === 2 ? "2 ทริป" : r.value <= 4 ? "3–4 ทริป" : "5 ทริปขึ้นไป")), "#bd3763"),
    ] },
    { id: "vehicles", label: "ยานพาหนะ", title: "ผู้ใช้เดินทางด้วยอะไร", charts: [
      chart("vehicle", "ประเภทรถ", cohort, count(trips.map(t => labelMap({ motorcycle: "มอเตอร์ไซค์", eco_car: "รถอีโคคาร์", sedan: "รถเก๋ง", suv: "SUV", pickup: "รถกระบะ", van: "รถตู้", bus: "รถบัส" }, t.vehicle.type)))),
      chart("brand", "ยี่ห้อรถ · 10 อันดับ", cohort, count(trips.map(t => t.vehicle.brand), 10), "#2b79d8"),
      chart("vehicle-age", "อายุรถ", "คำนวณจากปีรถ ณ ปีสิ้นสุดช่วงเลือก", count(trips.map(t => { const age = Number(range.to.slice(0,4)) - (t.vehicle.year ?? 0); return !t.vehicle.year || age < 0 ? "ไม่ระบุ" : age <= 3 ? "0–3 ปี" : age <= 7 ? "4–7 ปี" : age <= 12 ? "8–12 ปี" : "มากกว่า 12 ปี"; })), "#0d9b80"),
      chart("cc", "ขนาดเครื่องยนต์", "หน่วย cc · ไม่รวมค่าที่ไม่ได้ระบุ", count(trips.map(t => !t.vehicle.cc ? "ไม่ระบุ" : t.vehicle.cc < 1000 ? "<1,000" : t.vehicle.cc < 1500 ? "1,000–1,499" : t.vehicle.cc < 2000 ? "1,500–1,999" : t.vehicle.cc <= 2500 ? "2,000–2,500" : ">2,500")), "#b58a08"),
      chart("fuel", "ชนิดเชื้อเพลิง", cohort, count(trips.map(t => labelMap({ diesel: "ดีเซล", diesel_b20: "ดีเซล B20", gasohol_91: "แก๊สโซฮอล์ 91", gasohol_95: "แก๊สโซฮอล์ 95", gasohol_e20: "แก๊สโซฮอล์ E20", benzine: "เบนซิน", lpg: "LPG", ngv: "NGV", ev: "ไฟฟ้า" }, t.vehicle.fuel))), "#0d9b80"),
      chart("route-style", "รูปแบบเส้นทางที่เลือก", cohort, count(trips.map(t => labelMap({ fastest: "เส้นทางหลัก / เร็วที่สุด", scenic: "เส้นทางชมวิว", community: "เส้นทางชุมชน", mixed: "ผสมผสาน", custom: "กำหนดเอง" }, t.route_style))), "#7952c7"),
    ] },
  ];
  const latestDays = daily.filter(d => d.label.startsWith(range.to.slice(0,7)));
  const overview = [metric("ผู้ใช้ใหม่ในช่วงนี้", profiles.length, "ตามวันที่สมัครสมาชิก"), metric("DAU เฉลี่ย", dailyAvg, `ค่าเฉลี่ย ${days} วัน รวมวันที่ไม่มีการใช้งาน`), metric("MAU เดือนล่าสุด", latestMau, "เฉพาะวันที่อยู่ในช่วงเลือก"), metric("Stickiness", latestMau ? (avg(latestDays.map(d => d.value)) ?? 0) / latestMau * 100 : null, "DAU เฉลี่ย ÷ MAU ของเดือนล่าสุด", "%"), metric("เวลาใช้งานเฉลี่ย", avg(sessions.map(s => s.active_seconds / 60)), "ต่อ session ที่เก็บได้", " นาที"), metric("ทริปที่บันทึก", trips.length, cohort), metric("ออกเดินทางแล้ว", started, "สถานะ active / done · หน้าเริ่มเดินทางยังไม่เปิดใช้"), metric("จบครบทุกวัน", finished, "สถานะ done หรือทุกวันมี finished_at")];
  const patternStats = [metric("ระยะทริปที่พบบ่อย", mode(trips.map(t => `${duration(t)} วัน`)), cohort), metric("จำนวนคนที่พบบ่อย", mode(trips.map(t => `${travelerCount(t)} คน`)), cohort), metric("ไปกับใครมากที่สุด", mode(trips.map(companion)), cohort), metric("ค่าใช้จ่ายเฉลี่ย / ทริป", avg(costValues), "ประมาณการค่าน้ำมันและรายการในแผน", " ฿"), metric("ทริปเฉลี่ยต่อผู้วางแผน", usersWithTrips ? trips.length / usersWithTrips : null, "เฉพาะผู้ที่บันทึกอย่างน้อย 1 ทริป"), metric("ทริปต่อผู้วางแผน / 30 วัน", usersWithTrips ? trips.length / usersWithTrips / days * 30 : null, "ปรับตามจำนวนวันของช่วงเลือก"), metric("ทริปต่อผู้วางแผน / สัปดาห์", usersWithTrips ? trips.length / usersWithTrips / days * 7 : null, "ปรับตามจำนวนวันของช่วงเลือก")];
  const liquidTrips = trips.filter(t => t.vehicle.fuel && !["ngv","ev"].includes(t.vehicle.fuel));
  const fuelUnits = liquidTrips.map(t => t.route_summary?.fuel_units).filter(numeric);
  const vehicleStats = [metric("เชื้อเพลิงเฉลี่ย / ทริป", avg(fuelUnits), "เฉพาะเชื้อเพลิงหน่วยลิตร ไม่รวม NGV / EV", " ลิตร"), metric("ค่าพลังงานเฉลี่ย / ทริป", avg(trips.map(t => t.route_summary?.fuel_cost).filter(numeric)), "ประมาณการรวมทุกชนิดพลังงาน", " ฿"), metric("เชื้อเพลิงรวม", fuelUnits.reduce((a,b)=>a+b,0), "เฉพาะรายการที่มีหน่วยลิตร", " ลิตร"), metric("ระยะทางเฉลี่ย", avg(trips.map(t => t.route_summary?.distance_km).filter(numeric)), "ระยะทางตามแผน", " กม.")];
  return { range, sections, overview, patternStats, vehicleStats, heatmap, trips: trips.length, profiles: profiles.length };
}
