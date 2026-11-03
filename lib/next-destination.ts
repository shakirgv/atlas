import { normalizeName } from "@/lib/normalize-name";
import type { Stop } from "@/lib/route";

/** The fixed reference for the dashboard's clocks, whatever the home city in Settings says. */
export const HOME_CITY = { name: "Baku", tz: "Asia/Baku" } as const;

type DayLike = { date: string | null; city_id: string | null; trip_country_id: string };

const dayStopKey = (day: DayLike) => (day.city_id ? `city:${day.city_id}` : `country:${day.trip_country_id}`);

/**
 * The next place on the itinerary after the one you're in today. A dated itinerary day counts as well
 * as the route's arrival dates, so later days in today's stop don't count as going somewhere new.
 */
export function nextDestination(stops: Stop[], days: DayLike[], today: string): { stop: Stop; arrive: string } | null {
  const here = new Set(stops.filter((s) => s.arrive && s.arrive <= today && (!s.depart || s.depart >= today)).map((s) => s.key));
  for (const d of days) if (d.date === today) here.add(dayStopKey(d));

  const byKey = new Map(stops.map((s) => [s.key, s]));
  const fromDays = days.flatMap((d) => {
    const stop = byKey.get(dayStopKey(d));
    return stop && d.date && d.date > today ? [{ stop, arrive: d.date }] : [];
  });
  const fromRoute = stops.flatMap((stop) => (stop.arrive && stop.arrive > today ? [{ stop, arrive: stop.arrive }] : []));
  return [...fromDays, ...fromRoute].filter((c) => !here.has(c.stop.key)).sort((a, b) => a.arrive.localeCompare(b.arrive))[0] ?? null;
}

/** By name, not by zone: Ganja shares Baku's clock but isn't home. */
export function isHomeCity(stop: Pick<Stop, "kind" | "name" | "countryCode">) {
  if (stop.kind !== "city" || stop.countryCode !== "AZ") return false;
  const name = normalizeName(stop.name);
  return name === "baku" || name === "baki";
}
