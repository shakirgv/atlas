import { fmtDate } from "@/lib/dates";

/** An itinerary day a memory can be linked to. */
export type LinkDay = { id: string; trip_country_id: string; day_number: number; date: string | null; city_id: string | null; title: string | null };
/** A place a memory can be linked to. */
export type LinkPlace = { id: string; name: string; city_id: string; lat: number | null; lng: number | null };

export type MemoryLinkOptions = { places: LinkPlace[]; days: LinkDay[] };

/** "Day 3 · 12 Mar · Kyoto": what a linked day is called on a memory and in the form. */
export function dayLabel(day: Pick<LinkDay, "day_number" | "date" | "title">, cityName?: string | null) {
  return [`Day ${day.day_number}`, day.date ? fmtDate(day.date, "d MMM") : null, day.title?.trim() || cityName || null].filter(Boolean).join(" · ");
}

export const dayHref = (day: Pick<LinkDay, "id" | "trip_country_id">) => `/itinerary?country=${day.trip_country_id}&day=${day.id}`;
export const placeHref = (placeId: string) => `/places?open=${placeId}`;
