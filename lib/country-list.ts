import { daysBetween } from "@/lib/dates";
import { matchesName } from "@/lib/normalize-name";
import type { DisplayStatus } from "@/lib/types";

export type ListView = "grid" | "list";
export type ListSort = "route" | "date" | "name";

/** Everything the Countries list can be narrowed by. It lives in the address, so going back finds it there. */
export type ListFilters = {
  query: string;
  status: DisplayStatus | "all";
  continent: string;
  trip: string;
  sort: ListSort;
  view: ListView;
  missingDates: boolean;
  missingItinerary: boolean;
};

const STATUSES: readonly string[] = ["all", "ongoing", "planned", "visited", "wishlist"];

/** A hand-edited or out-of-date address falls back to the default instead of hiding the whole list. */
export function parseListFilters(params: { get(name: string): string | null }, known: { continents: string[]; tripIds: string[] }): ListFilters {
  const status = params.get("status") ?? "";
  const sort = params.get("sort");
  const continent = params.get("continent") ?? "";
  const trip = params.get("trip") ?? "";
  return {
    query: params.get("q") ?? "",
    status: STATUSES.includes(status) ? (status as ListFilters["status"]) : "all",
    continent: known.continents.includes(continent) ? continent : "all",
    trip: known.tripIds.includes(trip) ? trip : "all",
    sort: sort === "date" || sort === "name" ? sort : "route",
    view: params.get("view") === "list" ? "list" : "grid",
    missingDates: params.get("missing_dates") === "1",
    missingItinerary: params.get("missing_itinerary") === "1",
  };
}

/** Only what differs from the defaults, so an untouched list keeps a clean address. */
export function listFiltersToQuery(f: ListFilters) {
  const p = new URLSearchParams();
  if (f.query) p.set("q", f.query);
  if (f.status !== "all") p.set("status", f.status);
  if (f.continent !== "all") p.set("continent", f.continent);
  if (f.trip !== "all") p.set("trip", f.trip);
  if (f.sort !== "route") p.set("sort", f.sort);
  if (f.view !== "grid") p.set("view", f.view);
  if (f.missingDates) p.set("missing_dates", "1");
  if (f.missingItinerary) p.set("missing_itinerary", "1");
  return p.toString();
}

export type ItineraryStats = { days: number; planned: number };

/** A generated day is only a placeholder: a day counts as planned once it has a title, notes or a stop. */
export function itineraryStats(days: { id: string; trip_country_id: string; title: string | null; notes: string | null }[], items: { day_id: string }[]) {
  const withStops = new Set(items.map((i) => i.day_id));
  const out: Record<string, ItineraryStats> = {};
  for (const d of days) {
    const s = (out[d.trip_country_id] ??= { days: 0, planned: 0 });
    s.days++;
    if (d.title || d.notes || withStops.has(d.id)) s.planned++;
  }
  return out;
}

export function isMissingDates(c: { arrive_date: string | null; depart_date: string | null }) {
  return !c.arrive_date || !c.depart_date;
}

export function isMissingItinerary(stats: ItineraryStats | undefined) {
  return !stats?.planned;
}

type ListCountry = { id: string; name: string; display: DisplayStatus; region: string; trip_id: string; arrive_date: string | null; depart_date: string | null };

export function filterCountries<T extends ListCountry>(countries: T[], f: ListFilters, stats: Record<string, ItineraryStats>): T[] {
  const list = countries.filter(
    (c) =>
      (f.status === "all" || c.display === f.status) &&
      (f.continent === "all" || c.region === f.continent) &&
      (f.trip === "all" || c.trip_id === f.trip) &&
      (!f.missingDates || isMissingDates(c)) &&
      (!f.missingItinerary || isMissingItinerary(stats[c.id])) &&
      matchesName(c.name, f.query),
  );
  if (f.sort === "name") return [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (f.sort === "date") return [...list].sort((a, b) => (a.arrive_date ?? "9999").localeCompare(b.arrive_date ?? "9999"));
  return list;
}

/** Position on each trip's route, whatever the list is filtered or sorted by. */
export function routeNumbers(countries: { id: string; trip_id: string }[]) {
  const seen: Record<string, number> = {};
  return Object.fromEntries(countries.map((c) => [c.id, (seen[c.trip_id] = (seen[c.trip_id] ?? 0) + 1)]));
}

/** Planned days against the stay. Without dates there is no stay, so the existing days are the whole. */
export function itineraryProgress(c: { arrive_date: string | null; depart_date: string | null }, stats: ItineraryStats | undefined) {
  const stay = daysBetween(c.arrive_date, c.depart_date);
  const total = stay || (stats?.days ?? 0);
  const planned = Math.min(stats?.planned ?? 0, total);
  return { planned, total, percent: total ? (planned / total) * 100 : 0 };
}
