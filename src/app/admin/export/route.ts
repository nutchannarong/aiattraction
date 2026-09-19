import { isAdmin } from "@/lib/admin/session";
import { loadReports } from "@/lib/admin/load-reports";
import { dateRange } from "@/lib/admin/reports";

function cell(value: string | number) {
  const text = String(value);
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
}
export async function GET(request: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  const params = new URL(request.url).searchParams;
  const range = dateRange(params.get("from") ?? undefined, params.get("to") ?? undefined);
  const { dashboard, error } = await loadReports(range);
  if (!dashboard) return Response.json({ error }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const tab = params.get("tab");
  const sections = dashboard.sections.filter(s => !tab || tab === "schema" || s.id === tab);
  const rows: (string | number)[][] = [["หมวด", "รายงาน", "รายการ", "ค่า", "จากวันที่", "ถึงวันที่", "หมายเหตุ"]];
  for (const section of sections) for (const chart of section.charts) {
    for (const row of chart.rows) rows.push([section.label, chart.title, row.label, row.value, range.from, range.to, chart.note]);
    if (!chart.rows.length) rows.push([section.label, chart.title, "ยังไม่มีข้อมูล", "", range.from, range.to, chart.note]);
  }
  const metrics = tab === "patterns" ? dashboard.patternStats : tab === "vehicles" ? dashboard.vehicleStats : tab === "overview" ? dashboard.overview : [];
  for (const m of metrics) rows.push(["สรุป", m.label, "", m.value, range.from, range.to, m.note]);
  return new Response("\uFEFF" + rows.map(r => r.map(cell).join(",")).join("\r\n"), { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="thainhaidee-report-${range.from}-${range.to}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
