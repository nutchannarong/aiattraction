import "server-only";
import { requireAdmin } from "./session";
import { adminDatabase } from "./database";
import { buildDashboard, type ReportInput } from "./reports";

export async function loadReports(range: { from: string; to: string }) {
  await requireAdmin();
  const db = adminDatabase();
  if (!db) return { error: "ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY หรือ SUPABASE_SERVICE_ROLE_KEY บนเซิร์ฟเวอร์ จึงยังอ่านรายงานไม่ได้" };
  const start = `${range.from}T00:00:00+07:00`;
  const end = new Date(Date.parse(`${range.to}T00:00:00+07:00`) + 86400_000).toISOString();
  const yearStart = new Date(Date.parse(`${range.to}T00:00:00+07:00`) - 364 * 86400_000).toISOString();
  async function rows<T>(table: string, select: string, dateColumn?: string, since = start): Promise<T[]> {
    const all: T[] = [];
    for (let offset = 0; offset < 50000; offset += 500) {
      let query = db!.from(table).select(select).order(table === "place_groups" ? "key" : "id").range(offset, offset + 499);
      if (dateColumn) query = query.gte(dateColumn, since).lt(dateColumn, end);
      const { data, error } = await query;
      if (error) throw new Error(`อ่าน ${table} ไม่สำเร็จ (${error.code})`);
      all.push(...data as T[]);
      if (data.length < 500) return all;
    }
    throw new Error(`${table} มีข้อมูลเกินขอบเขตรายงาน 50,000 แถว กรุณาลดช่วงวันที่หรือใช้การสรุปข้อมูลในฐานข้อมูล`);
  }
  try {
    const [profiles, trips, events, sessions, provinces, groups] = await Promise.all([
      rows<ReportInput["profiles"][number]>("profiles", "id,birth_date,gender,occupation,home_province_id,created_at", "created_at"),
      rows<ReportInput["trips"][number]>("trips", "id,user_id,created_at,start_date,end_date,status,origin,destination,travelers,occasion,interests,vehicle,route_style,route_summary,trip_days(day_index,date,finished_at,trip_items(start_time,kind,place_category,cost_estimate,cost_category,trip_bookings(platform,price,status)))", "created_at", yearStart < start ? yearStart : start),
      rows<ReportInput["events"][number]>("analytics_events", "id,user_id,kind,provider,created_at", "created_at"),
      rows<ReportInput["sessions"][number]>("analytics_sessions", "id,user_id,started_at,last_seen_at,active_seconds", "started_at"),
      rows<ReportInput["provinces"][number]>("provinces", "id,name_th"),
      rows<ReportInput["groups"][number]>("place_groups", "key,label_th"),
    ]);
    return { dashboard: buildDashboard({ profiles, trips, events, sessions, provinces, groups }, range) };
  } catch (error) {
    return { error: `${error instanceof Error ? error.message : "โหลดรายงานไม่สำเร็จ"} · ตรวจสอบการเชื่อมต่อและ migration 20260920090000_admin_analytics.sql แล้วลองใหม่` };
  }
}
