import "server-only";
import type { CityVM, CountryVM } from "@/lib/data";
import { countryAnchor } from "@/lib/countries";
import { buildLegs, buildStops, type HomeStop, type Leg, type Stop } from "@/lib/route";
import { tzForCoords } from "@/lib/server/tz-lookup";
import type { JetLag } from "@/lib/jetlag";
import type { ClimateStop } from "@/lib/climate";
import type { Settings } from "@/lib/types";

/** Serializable leg for client components. */
export type LegView = {
  key: string;
  fromName: string;
  fromHome: boolean;
  toName: string;
  toKind: "city" | "country";
  toId: string;
  tripCountryId: string;
  /** Previous stop's trip country (null when coming from home). */
  fromTripCountryId: string | null;
  arrive: string | null;
  mode: string | null;
  note: string | null;
  owner: { kind: "city" | "country"; id: string };
  jetlag: JetLag | null;
  toTz: string | null;
};

/** Zone for a country: its first city with a zone, else the capital/centroid lookup. */
export function countryTimezone(code: string, cities: { timezone?: string | null }[]): string | null {
  const fromCity = cities.find((c) => c.timezone)?.timezone;
  if (fromCity) return fromCity;
  const a = countryAnchor(code);
  return a ? tzForCoords(a[0], a[1]) : null;
}

export function homeStop(settings: Settings | null): HomeStop | null {
  if (!settings?.home_timezone && settings?.home_lat == null) return null;
  const tz = settings.home_timezone ?? tzForCoords(settings.home_lat, settings.home_lng);
  return { key: "home", kind: "home", name: settings.home_city ?? "Home", lat: settings.home_lat, lng: settings.home_lng, tz };
}

function toView(l: Leg): LegView {
  const fromHome = l.from.kind === "home";
  const from = l.from as Stop;
  return {
    key: `${l.from.key}>${l.to.key}`,
    fromName: l.from.name,
    fromHome,
    toName: l.to.name,
    toKind: l.to.kind,
    toId: l.to.id,
    tripCountryId: l.to.tripCountryId,
    fromTripCountryId: fromHome ? null : from.tripCountryId,
    arrive: l.to.arrive,
    mode: l.to.transport,
    note: l.to.transportNote,
    owner: l.to.transportOwner,
    jetlag: l.jetlag,
    toTz: l.to.tz,
  };
}

/** Stops + legs (with jet lag) for one trip. */
export function tripRoute(tripId: string, countries: CountryVM[], cities: CityVM[], settings: Settings | null) {
  const tcs = countries.filter((c) => c.trip_id === tripId);
  const tcIds = new Set(tcs.map((c) => c.id));
  const cs = cities.filter((c) => tcIds.has(c.trip_country_id));
  const stops = buildStops(
    tcs.map((c) => {
      const a = countryAnchor(c.code);
      return { ...c, tz: countryTimezone(c.code, cs.filter((x) => x.trip_country_id === c.id)), lat: a?.[0] ?? null, lng: a?.[1] ?? null };
    }),
    cs,
  );
  const legs = buildLegs(stops, homeStop(settings)).map(toView);
  return { stops, legs };
}

/** All trips in scope, flattened. */
export function routesForTrips(tripIds: string[], countries: CountryVM[], cities: CityVM[], settings: Settings | null) {
  const stops: Stop[] = [];
  const legs: LegView[] = [];
  for (const id of tripIds) {
    const r = tripRoute(id, countries, cities, settings);
    stops.push(...r.stops);
    legs.push(...r.legs);
  }
  return { stops, legs };
}

/** Stops of one trip country that can be looked up for climate (coordinates required). */
export function climateStopsFor(stops: Stop[], tripCountryId: string): ClimateStop[] {
  return stops
    .filter((s) => s.tripCountryId === tripCountryId && s.lat != null && s.lng != null)
    .map((s) => ({ name: s.name, lat: s.lat!, lng: s.lng!, arrive: s.arrive, depart: s.depart }));
}

/** The leg that enters a trip country (from home or from the previous country). */
export function legIntoCountry(legs: LegView[], tripCountryId: string) {
  return legs.find((l) => l.tripCountryId === tripCountryId && l.fromTripCountryId !== tripCountryId) ?? null;
}
