// What the travel assistant knows about the user's planner, built in the browser.
// The text part goes to the model; coordinates stay with our server for tool lookups
// and are never put into the prompt.

import { formatDuration } from "../geo";
import { costTotals } from "../planner/edit";
import type { TripPlan } from "../planner/plan-types";
import {
  ADULT_AGES,
  isOneWay,
  OCCASIONS,
  ROUTE_STYLES,
  type PlaceGroupOption,
  type PlannerDraft,
} from "../planner/types";
import { VEHICLE_TYPES } from "../planner/vehicles";

/** A place the assistant can search around ("near_stop"). */
export type AssistantStop = { id: string; name: string; lat: number; lng: number };

export type AssistantContext = {
  /** Plain-text summary of the answers and plan, in Thai. */
  summary: string;
  stops: AssistantStop[];
  /** Trip dates, for the weather tool. */
  dates: string[];
};

const MAX_SUMMARY = 6000;

export function buildAssistantContext(
  draft: PlannerDraft,
  plan: TripPlan | null,
  groups: PlaceGroupOption[],
): AssistantContext {
  const lines: string[] = [];
  const stops: AssistantStop[] = [];
  const addStop = (id: string, name: string, lat: number, lng: number) => {
    if (!stops.some((s) => s.id === id)) stops.push({ id, name, lat, lng });
  };

  if (draft.origin) {
    // Home/GPS origins are described by area only.
    const name =
      draft.origin.type === "gps" || draft.origin.type === "pin"
        ? (draft.origin.sublabel ?? draft.origin.label)
        : draft.origin.label;
    lines.push(`ต้นทาง: ${name}`);
    addStop("origin", `ต้นทาง (${name})`, draft.origin.latitude, draft.origin.longitude);
  } else {
    lines.push("ต้นทาง: ยังไม่ได้เลือก");
  }
  if (draft.destination) {
    const tier = draft.destination.isSecondaryCity ? " (เมืองรอง)" : "";
    lines.push(`ปลายทาง: ${draft.destination.label}${tier}`);
    addStop(
      "destination",
      `ปลายทาง (${draft.destination.label})`,
      draft.destination.latitude,
      draft.destination.longitude,
    );
  } else {
    lines.push("ปลายทาง: ยังไม่ได้เลือก");
  }
  lines.push(
    `รูปแบบ: ${isOneWay(draft) ? "ไปอย่างเดียว" : "ไป-กลับ"} · วันที่ ${draft.startDate} ถึง ${draft.endDate}`,
  );

  const t = draft.travelers;
  const ages = t.adultAges.map((a) => ADULT_AGES.find((x) => x.key === a)?.label ?? a).join(", ");
  lines.push(
    `ผู้เดินทาง: ผู้ใหญ่ ${t.adults}${ages ? ` (${ages})` : ""} · เด็ก ${t.children} · ผู้สูงอายุ ${t.seniors}`,
  );
  const occasion = OCCASIONS.find((o) => o.key === draft.occasion)?.label;
  if (occasion) lines.push(`โอกาส: ${occasion}`);
  const interests = draft.interests.map((k) => groups.find((g) => g.key === k)?.label ?? k);
  lines.push(`แนวที่สนใจ: ${interests.length ? interests.join(", ") : "ยังไม่เลือก"}`);
  const vehicle =
    VEHICLE_TYPES.find((v) => v.key === draft.vehicle.type)?.label ?? draft.vehicle.type;
  const style = ROUTE_STYLES.find((r) => r.key === draft.routeStyle)?.label ?? draft.routeStyle;
  lines.push(
    `รถ: ${vehicle}${draft.vehicle.brand ? ` ${draft.vehicle.brand} ${draft.vehicle.model}` : ""} · เส้นทาง: ${style}`,
  );

  if (plan) {
    const { total } = costTotals(plan);
    lines.push(
      "",
      `แผนที่ร่างแล้ว: ${Math.round(plan.totals.distanceKm)} กม. · ขับรวม ${formatDuration(plan.totals.driveMin)} · ค่าน้ำมัน ${Math.round(plan.totals.fuelCost)} บาท · ค่าใช้จ่ายรวมประมาณ ${Math.round(total)} บาท`,
    );
    for (const day of plan.days) {
      lines.push(
        `วันที่ ${day.index + 1} (${day.date}) ${day.title}${day.finished ? " [จบแล้ว]" : ""}`,
      );
      for (const item of day.items) {
        const time = item.start ? `${item.start}${item.end ? `–${item.end}` : ""}` : "--:--";
        const name = item.place?.name ?? "";
        const label =
          item.kind === "drive" ? item.activity : `${item.activity}${name ? `: ${name}` : ""}`;
        const extra = [
          item.warning ? `⚠ ${item.warning}` : null,
          item.costEstimate ? `${Math.round(item.costEstimate)} บาท` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        lines.push(`- ${time} ${label}${extra ? ` (${extra})` : ""}`);
        if (item.place && item.kind !== "drive") {
          addStop(
            `d${day.index + 1}-${stops.length}`,
            `วันที่ ${day.index + 1}: ${item.place.name}`,
            item.place.latitude,
            item.place.longitude,
          );
        }
      }
    }
  } else {
    lines.push("", "ยังไม่ได้กดร่างแผน");
  }

  const dates: string[] = [];
  for (
    let d = new Date(`${draft.startDate}T00:00:00Z`);
    dates.length < 14;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > draft.endDate) break;
    dates.push(iso);
  }

  return { summary: lines.join("\n").slice(0, MAX_SUMMARY), stops: stops.slice(0, 60), dates };
}
