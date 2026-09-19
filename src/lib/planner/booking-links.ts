// Deep links into booking sites, pre-filled with the stay, dates and guests.
// None of these sites offer us live prices without an affiliate deal, so the page only
// links out and lets the user type in the price they found.

import type { BookingPlatform, LodgingDetail } from "./plan-types";

export type StayQuery = {
  name: string;
  area?: string | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  lodging: Pick<LodgingDetail, "minPrice" | "maxPrice" | "filters" | "website">;
  phone?: string | null;
};

/** Two guests to a room, at least one room. */
export function roomsFor(adults: number, children: number) {
  return Math.max(1, Math.ceil((adults + children / 2) / 2));
}

function qs(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") sp.set(k, String(v));
  return sp.toString();
}

export function bookingLinks(q: StayQuery): Record<BookingPlatform, string> {
  const text = [q.name, q.area].filter(Boolean).join(" ");
  const rooms = roomsFor(q.adults, q.children);
  const { minPrice, maxPrice, filters } = q.lodging;
  const hasPrice = minPrice != null || maxPrice != null;

  const agoda = `https://www.agoda.com/th-th/search?${qs({
    textToSearch: text,
    checkIn: q.checkIn,
    checkOut: q.checkOut,
    rooms,
    adults: q.adults,
    children: q.children,
    priceCur: "THB",
  })}`;

  const booking = `https://www.booking.com/searchresults.th.html?${qs({
    ss: text,
    checkin: q.checkIn,
    checkout: q.checkOut,
    group_adults: q.adults,
    group_children: q.children,
    no_rooms: rooms,
    selected_currency: "THB",
    // Booking's price filter: THB-min-max-1 (per night).
    nflt: hasPrice ? `price=THB-${minPrice ?? 0}-${maxPrice ?? "max"}-1` : null,
  })}`;

  const trip = `https://th.trip.com/hotels/list?${qs({
    searchWord: text,
    checkin: q.checkIn.replaceAll("-", ""),
    checkout: q.checkOut.replaceAll("-", ""),
    adult: q.adults,
    child: q.children || null,
    crn: rooms,
    curr: "THB",
  })}`;

  const traveloka = `https://www.traveloka.com/th-th/hotel/search?${qs({
    q: text,
    checkIn: q.checkIn,
    checkOut: q.checkOut,
    rooms,
    adults: q.adults,
    children: q.children || null,
  })}`;

  const expedia = `https://www.expedia.co.th/Hotel-Search?${qs({
    destination: text,
    startDate: q.checkIn,
    endDate: q.checkOut,
    rooms,
    adults: q.adults,
    children: q.children || null,
  })}`;

  const airbnb = `https://www.airbnb.co.th/s/${encodeURIComponent(q.area || q.name)}/homes?${qs({
    query: text,
    checkin: q.checkIn,
    checkout: q.checkOut,
    adults: q.adults,
    children: q.children || null,
    pets: filters.includes("pets") ? 1 : null,
    price_min: minPrice,
    price_max: maxPrice,
  })}`;

  const direct =
    q.lodging.website ??
    (q.phone
      ? `tel:${q.phone.split(/[,;/]/)[0].replace(/[^\d+]/g, "")}`
      : `https://www.google.com/search?${qs({ q: `${text} จองตรง` })}`);

  return { agoda, booking, trip, traveloka, expedia, airbnb, direct };
}

/** Number of nights between two ISO dates. */
export function nightsBetween(checkIn: string, checkOut: string) {
  const ms =
    new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

export function nextDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
