import type { LiveTripItem } from "../trip-data";
import type { NearbyPlace } from "./nearby";
import { closedWarning } from "./schedule";

export function replaceLiveItem(
  item: LiveTripItem,
  nearby: NearbyPlace,
  date: string,
): LiveTripItem {
  return {
    ...item,
    place: nearby.place,
    phone: nearby.phone,
    openingHours: nearby.openingHours,
    warning: closedWarning(nearby.openingHours, date),
  };
}
