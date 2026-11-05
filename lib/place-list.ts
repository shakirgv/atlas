import { todayIso } from "@/lib/dates";
import { matchesName } from "@/lib/normalize-name";
import { PLACE_CATEGORIES, PLACE_STATUSES, type PlaceCategory, type PlaceStatus, type StopType } from "@/lib/types";

export const PLACE_VIEWS = ["grid", "table", "map"] as const;
export type PlaceView = (typeof PLACE_VIEWS)[number];

/** Everything the Places page can be narrowed by. It lives in the address, so it holds across Cards, Table and Map and survives a reload. */
export type PlaceListFilters = {
  query: string;
  country: string;
  city: string;
  category: PlaceCategory | "all";
  status: PlaceStatus | "all";
  notInItinerary: boolean;
  missingPin: boolean;
  missingCover: boolean;
  view: PlaceView;
};

export const DEFAULT_PLACE_FILTERS: PlaceListFilters = {
  query: "",
  country: "all",
  city: "all",
  category: "all",
  status: "all",
  notInItinerary: false,
  missingPin: false,
  missingCover: false,
  view: "grid",
};

/** The address keys this list owns. Anything else in the address, such as the open place, is left alone. */
export const PLACE_FILTER_KEYS = ["q", "country", "city", "category", "status", "unscheduled", "no_pin", "no_cover", "view"] as const;

type CityRef = { id: string; trip_country_id: string };

/** A hand-edited or out-of-date address falls back to the default instead of hiding the whole list. */
export function parsePlaceFilters(params: { get(name: string): string | null }, known: { countryIds: string[]; cities: CityRef[] }): PlaceListFilters {
  const country = params.get("country") ?? "";
  const city = params.get("city") ?? "";
  const category = params.get("category") ?? "";
  const status = params.get("status") ?? "";
  const view = params.get("view") ?? "";
  const cityRow = known.cities.find((c) => c.id === city);
  const countryOk = known.countryIds.includes(country);
  return {
    query: params.get("q") ?? "",
    country: countryOk ? country : "all",
    // A city outside the chosen country would show nothing, so it gives way.
    city: cityRow && (!countryOk || cityRow.trip_country_id === country) ? city : "all",
    category: (PLACE_CATEGORIES as readonly string[]).includes(category) ? (category as PlaceCategory) : "all",
    status: (PLACE_STATUSES as readonly string[]).includes(status) ? (status as PlaceStatus) : "all",
    notInItinerary: params.get("unscheduled") === "1",
    missingPin: params.get("no_pin") === "1",
    missingCover: params.get("no_cover") === "1",
    view: (PLACE_VIEWS as readonly string[]).includes(view) ? (view as PlaceView) : "grid",
  };
}

/** Only what differs from the defaults, so an untouched list keeps a clean address. */
export function placeFiltersToParams(f: PlaceListFilters) {
  const p = new URLSearchParams();
  if (f.query) p.set("q", f.query);
  if (f.country !== "all") p.set("country", f.country);
  if (f.city !== "all") p.set("city", f.city);
  if (f.category !== "all") p.set("category", f.category);
  if (f.status !== "all") p.set("status", f.status);
  if (f.notInItinerary) p.set("unscheduled", "1");
  if (f.missingPin) p.set("no_pin", "1");
  if (f.missingCover) p.set("no_cover", "1");
  if (f.view !== "grid") p.set("view", f.view);
  return p;
}

/** Puts the filters into an existing address, keeping whatever else it holds (the open place). */
export function mergePlaceFilters(search: string, f: PlaceListFilters) {
  const next = new URLSearchParams(search);
  for (const k of PLACE_FILTER_KEYS) next.delete(k);
  placeFiltersToParams(f).forEach((v, k) => next.set(k, v));
  return next.toString();
}

/** Picking a country narrows the cities, so a city from another country is let go. */
export function withCountry(f: PlaceListFilters, country: string, cities: CityRef[]): PlaceListFilters {
  const city = cities.find((c) => c.id === f.city);
  return { ...f, country, city: country === "all" || city?.trip_country_id === country ? f.city : "all" };
}

/** The cities the City filter offers: the chosen country's, or every one. */
export function citiesInCountry<T extends CityRef>(cities: T[], country: string): T[] {
  return country === "all" ? cities : cities.filter((c) => c.trip_country_id === country);
}

export const hasPin = (p: { lat: number | null; lng: number | null }) => p.lat != null && p.lng != null;

type ListPlace = {
  id: string;
  name: string;
  address: string | null;
  city_id: string;
  city_name: string;
  category: string;
  status: string;
  lat: number | null;
  lng: number | null;
  cover_path: string | null;
};

/** The extra filters, counted against the list as the other filters leave it, so each number says what the chip would show. */
export type MoreFilterCounts = { notInItinerary: number; missingPin: number; missingCover: number };

export function filterPlaceList<T extends ListPlace>(places: T[], f: PlaceListFilters, ctx: { cities: CityRef[]; scheduled: Set<string> }): T[] {
  const countryOf = new Map(ctx.cities.map((c) => [c.id, c.trip_country_id]));
  return places.filter(
    (p) =>
      (f.country === "all" || countryOf.get(p.city_id) === f.country) &&
      (f.city === "all" || p.city_id === f.city) &&
      (f.category === "all" || p.category === f.category) &&
      (f.status === "all" || p.status === f.status) &&
      (!f.notInItinerary || !ctx.scheduled.has(p.id)) &&
      (!f.missingPin || !hasPin(p)) &&
      (!f.missingCover || !p.cover_path) &&
      (matchesName(p.name, f.query) || matchesName(p.address ?? "", f.query) || matchesName(p.city_name, f.query)),
  );
}

export function moreFilterCounts<T extends ListPlace>(places: T[], f: PlaceListFilters, ctx: { cities: CityRef[]; scheduled: Set<string> }): MoreFilterCounts {
  const base = filterPlaceList(places, { ...f, notInItinerary: false, missingPin: false, missingCover: false }, ctx);
  return {
    notInItinerary: base.filter((p) => !ctx.scheduled.has(p.id)).length,
    missingPin: base.filter((p) => !hasPin(p)).length,
    missingCover: base.filter((p) => !p.cover_path).length,
  };
}

/** How a place goes into a day: food stays food, a bed stays a bed, the rest is something to do. */
export function stopTypeForPlace(category: string): StopType {
  if (category === "food" || category === "cafe") return "food";
  if (category === "stay") return "stay";
  if (category === "transport") return "transport";
  return "activity";
}

/** "09:30–11:00", "09:30" or nothing. */
export function stopTimeLabel(start: string | null, end: string | null) {
  const s = start?.slice(0, 5);
  const e = end?.slice(0, 5);
  if (s && e) return `${s}–${e}`;
  return s ?? (e ? `until ${e}` : "");
}

/** Directions to a pinned place, in whatever maps app the device hands the link to. */
export function directionsUrl(p: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}

/** The day a place most likely belongs on: the next one in its own city, then any in its city, then the next one at all. */
export function suggestedDay<T extends { city_id: string | null; date: string | null }>(days: T[], cityId: string, today = todayIso()): T | null {
  const inCity = days.filter((d) => d.city_id === cityId);
  const upcoming = (list: T[]) => list.find((d) => d.date && d.date >= today);
  return upcoming(inCity) ?? inCity[0] ?? upcoming(days) ?? days[0] ?? null;
}

export type PlaceGroup<P, C> = {
  country: C;
  places: P[];
  /** The country's cities that hold some of these places, in route order, with how many each holds. */
  cities: { id: string; name: string; count: number }[];
};

/** Places under their countries, in route order. Countries with nothing left after the filters are left out. */
export function groupPlacesByCountry<P extends { city_id: string }, C extends { id: string }>(places: P[], countries: C[], cities: { id: string; name: string; trip_country_id: string }[]): PlaceGroup<P, C>[] {
  const cityById = new Map(cities.map((c) => [c.id, c]));
  return countries.flatMap((country) => {
    const own = places.filter((p) => cityById.get(p.city_id)?.trip_country_id === country.id);
    if (!own.length) return [];
    const counts = new Map<string, number>();
    for (const p of own) counts.set(p.city_id, (counts.get(p.city_id) ?? 0) + 1);
    const inCountry = cities.filter((c) => counts.has(c.id)).map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id)! }));
    return [{ country, places: own, cities: inCountry }];
  });
}
