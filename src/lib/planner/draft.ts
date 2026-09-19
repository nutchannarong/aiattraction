import type { PlannerDraft } from "./types";

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function defaultDraft(today = new Date()): PlannerDraft {
  const start = new Date(today);
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  return {
    version: 1,
    origin: null,
    destination: null,
    startDate: isoDate(start),
    endDate: isoDate(end),
    travelers: { adults: 2, children: 0, seniors: 0, adultAges: [] },
    occasion: null,
    interests: [],
    interestTypes: [],
    balanced: true,
    stopKinds: ["restaurant", "fuel", "rest_area", "lodging"],
    vehicle: {
      type: "sedan",
      brand: "",
      model: "",
      cc: null,
      year: null,
      fuel: "gasohol_95",
      fuelPrice: 39.94,
      efficiencyOverride: null,
    },
    routeStyle: "fastest",
    customWaypoints: [],
  };
}
