import type { TripPlan } from "./planner/plan-types";
import type { PlannerDraft } from "./planner/types";

export const LOCAL_TRIPS_KEY = "thainhaidee:trips";
export const ACTIVE_TRIP_KEY = "thainhaidee:active-trip";
export const LOCAL_TRIPS_CHANGED = "thainhaidee:trips-changed";

export type LocalTrip = {
  id: string;
  savedAt: string;
  draft: PlannerDraft;
  plan: TripPlan;
  /** Persisted when a local trip enters or finishes live navigation. */
  status?: "upcoming" | "active" | "done";
};

export function readLocalTrips(): LocalTrip[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_TRIPS_KEY) ?? "[]") as LocalTrip[];
    return Array.isArray(parsed)
      ? parsed.filter((trip) => trip?.id && trip.draft && trip.plan?.days?.length)
      : [];
  } catch {
    return [];
  }
}

export function saveLocalTrip(trip: LocalTrip) {
  const trips = readLocalTrips().filter((item) => item.id !== trip.id);
  localStorage.setItem(LOCAL_TRIPS_KEY, JSON.stringify([...trips, trip]));
  window.dispatchEvent(new Event(LOCAL_TRIPS_CHANGED));
}

export function deleteLocalTrip(id: string) {
  localStorage.setItem(
    LOCAL_TRIPS_KEY,
    JSON.stringify(readLocalTrips().filter((trip) => trip.id !== id)),
  );
  window.dispatchEvent(new Event(LOCAL_TRIPS_CHANGED));
}

export function setActiveLocalTrip(id: string) {
  localStorage.setItem(ACTIVE_TRIP_KEY, id);
}

export function readActiveLocalTrip() {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(ACTIVE_TRIP_KEY);
  const trips = readLocalTrips();
  return trips.find((trip) => trip.id === id) ?? trips[0] ?? null;
}
