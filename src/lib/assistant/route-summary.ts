// Plain-text description of one drafted route, for the AI route advice. No coordinates.

import { formatDuration } from "../geo";
import { costTotals } from "../planner/edit";
import type { TripPlan } from "../planner/plan-types";
import { ROUTE_STYLES, type RouteStyle } from "../planner/types";

export function routeStyleLabel(style: RouteStyle) {
  const info = ROUTE_STYLES.find((r) => r.key === style);
  return info ? `${info.label} (${info.hint})` : style;
}

/** One line of headline numbers, used for the other options in a comparison. */
export function routeHeadline(style: RouteStyle, plan: TripPlan) {
  const visits = plan.days.flatMap((d) => d.items).filter((i) => i.kind === "attraction");
  return `${routeStyleLabel(style)}: ${Math.round(plan.totals.distanceKm)} กม. · ขับ ${formatDuration(plan.totals.driveMin)} · ค่าใช้จ่ายรวม ${Math.round(costTotals(plan).total)} บาท · จุดแวะเที่ยว ${visits.length} จุด`;
}

/** Day-by-day detail of one route option. */
export function describeRoute(style: RouteStyle, plan: TripPlan, maxChars = 5000) {
  const lines = [routeHeadline(style, plan)];
  if (plan.waypoints.length) {
    lines.push(`ผ่าน: ${plan.waypoints.map((w) => w.name).join(", ")}`);
  }
  for (const day of plan.days) {
    const drives = day.items.filter((i) => i.kind === "drive");
    const km = drives.reduce((n, i) => n + (i.driveKm ?? 0), 0);
    lines.push(`วันที่ ${day.index + 1} (${day.date}) ${day.title} · ขับรวม ${Math.round(km)} กม.`);
    for (const item of day.items) {
      if (item.kind === "drive") continue;
      const where = item.place
        ? `${item.place.name}${item.place.area ? ` (${item.place.area})` : ""}${item.place.isSecondaryCity ? " [เมืองรอง]" : ""}`
        : "";
      const time = item.start ? `${item.start}${item.end ? `–${item.end}` : ""}` : "";
      lines.push(
        `- ${time} ${item.activity}${where ? `: ${where}` : ""}${item.warning ? ` ⚠ ${item.warning}` : ""}`,
      );
    }
    for (const d of drives) if (d.warning) lines.push(`  ⚠ ${d.warning}`);
  }
  if (plan.notes.length) lines.push(`หมายเหตุ: ${plan.notes.join(" / ")}`);
  return lines.join("\n").slice(0, maxChars);
}
