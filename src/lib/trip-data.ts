import type { CostCategory, PlanItemKind, PlanPlace } from "./planner/plan-types";

export type TripSource = "supabase" | "local";
export type TripProgressStatus = "pending" | "completed" | "skipped";

export type TripSummary = {
  id: string;
  source: TripSource;
  title: string;
  originLabel: string;
  destinationLabel: string;
  startDate: string;
  endDate: string;
  dayCount: number;
  stopCount: number;
  distanceKm: number;
  fuelCost: number;
  vehicleLabel: string;
  status: "draft" | "upcoming" | "active" | "done";
};

export type LiveTripItem = {
  id: string;
  kind: PlanItemKind;
  start: string | null;
  end: string | null;
  activity: string;
  place: PlanPlace | null;
  costEstimate: number | null;
  costCategory: CostCategory | null;
  phone: string | null;
  openingHours: string | null;
  notes: string | null;
  warning: string | null;
  parking: string | null;
  progressStatus: TripProgressStatus;
};

export type LiveTripDay = {
  id: string;
  index: number;
  date: string;
  finished: boolean;
  items: LiveTripItem[];
};

export type LiveTrip = {
  id: string;
  source: TripSource;
  title: string;
  originLabel: string;
  destinationLabel: string;
  status: "draft" | "upcoming" | "active" | "done";
  days: LiveTripDay[];
};
