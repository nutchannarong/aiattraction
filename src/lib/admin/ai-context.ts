import type { Dashboard } from "./reports";

function formatMetricList(items: Dashboard["overview"]) {
  return items
    .map((item) => `- ${item.label}: ${item.value} (${item.note})`)
    .join("\n");
}

function formatChartRows(
  rows: { label: string; value: number }[],
  limit = 10,
  unit = "",
) {
  const total = rows.reduce((acc, r) => acc + r.value, 0);
  return rows
    .slice(0, limit)
    .map((r) => {
      const pct = total > 0 ? ` (${((r.value / total) * 100).toFixed(1)}%)` : "";
      return `  * ${r.label}: ${r.value.toLocaleString("th-TH")}${unit ? ` ${unit}` : ""}${pct}`;
    })
    .join("\n");
}

/**
 * Builds a structured, high-density analytical text summary of the admin dashboard.
 * Used exclusively as system context for the Admin AI Data Analyst.
 */
export function buildAdminAiContext(
  dashboard: Dashboard,
  range: { from: string; to: string },
): string {
  const lines: string[] = [];

  lines.push(`=== ข้อมูลสถิติและรายงานระบบ THAINHAIDEE ADMIN ===`);
  lines.push(`ช่วงเวลาที่วิเคราะห์: ${range.from} ถึง ${range.to}`);
  lines.push(`จำนวนทริปที่ถูกบันทึกทั้งหมดในช่วงนี้: ${dashboard.trips.toLocaleString("th-TH")} ทริป`);
  lines.push(`จำนวนผู้ใช้ใหม่ที่สมัครสมาชิกในช่วงนี้: ${dashboard.profiles.toLocaleString("th-TH")} คน`);
  lines.push("");

  // 1. Overview metrics
  lines.push(`[1. ภาพรวมการใช้งานและกิจกรรม (Overview Metrics)]`);
  lines.push(formatMetricList(dashboard.overview));
  lines.push("");

  // 2. Trip Pattern Stats
  lines.push(`[2. พฤติกรรมและรูปแบบทริป (Trip Patterns)]`);
  lines.push(formatMetricList(dashboard.patternStats));
  lines.push("");

  // 3. Finance Stats
  lines.push(`[3. การเงินและงบประมาณประมาณการ (Financial Projections)]`);
  lines.push(formatMetricList(dashboard.financeStats));
  lines.push("");

  // 4. Vehicle Stats
  lines.push(`[4. ยานพาหนะและพลังงาน (Vehicle & Energy)]`);
  lines.push(formatMetricList(dashboard.vehicleStats));
  lines.push("");

  // 5. Sections detail from charts
  for (const section of dashboard.sections) {
    lines.push(`[หมวด: ${section.title} (${section.label})]`);
    for (const chart of section.charts) {
      lines.push(`- ${chart.title} (${chart.note}):`);
      if (!chart.rows || chart.rows.length === 0) {
        lines.push("  * ไม่มีข้อมูล");
      } else {
        lines.push(formatChartRows(chart.rows, 10));
      }
    }
    lines.push("");
  }

  // 6. Timing Heatmap summary
  if (dashboard.heatmap && dashboard.heatmap.length === 7) {
    const dayNames = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
    lines.push(`[สรุปช่วงเวลาออกเดินทาง (Departure Heatmap)]`);
    const dayTotals = dashboard.heatmap.map((hours, dayIdx) => ({
      day: dayNames[dayIdx],
      total: hours.reduce((a, b) => a + b, 0),
    }));
    lines.push(
      `ยอดออกเดินทางแยกตามวัน: ` +
        dayTotals.map((d) => `${d.day} ${d.total} ทริป`).join(", "),
    );

    // Find peak hours
    const hourTotals = Array.from({ length: 24 }, (_, h) => {
      const sumHour = dashboard.heatmap.reduce((acc, hours) => acc + (hours[h] ?? 0), 0);
      return { hour: `${h}:00`, total: sumHour };
    });
    hourTotals.sort((a, b) => b.total - a.total);
    const topHours = hourTotals.slice(0, 3).filter((h) => h.total > 0);
    if (topHours.length > 0) {
      lines.push(
        `ชั่วโมงที่นิยมออกเดินทางสูงสุด: ` +
          topHours.map((h) => `${h.hour} (${h.total} ทริป)`).join(", "),
      );
    }
    lines.push("");
  }

  // 7. Data Caveats & Notes
  lines.push(`[ข้อจำกัดและความหมายของข้อมูล (Data Caveats)]`);
  lines.push(`- ข้อมูลสถิติเริ่มเก็บหลังติดตั้งระบบรายงาน เฉพาะสมาชิกที่เข้าสู่ระบบเท่านั้น`);
  lines.push(`- ตัวเลขค่าใช้จ่ายเป็น "ประมาณการตามแผน" ที่ผู้ใช้กำหนด ไม่ใช่ยอดเงินทำธุรกรรมจริง ยกเว้นราคาที่พักที่ผู้ใช้ยืนยันการจอง`);
  lines.push(`- เวลาออกเดินทางและจุดแวะคือข้อมูลตามแผนที่ผู้ใช้วางไว้`);
  lines.push(`- ห้ามเปิดเผยข้อมูลส่วนบุคคลหรือข้อมูลดิบที่ไม่ผ่านการรวบรวม`);

  return lines.join("\n");
}
