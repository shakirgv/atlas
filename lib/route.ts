import { jetLag, type JetLag } from "@/lib/jetlag";
import { todayIso } from "@/lib/dates";

/**
 * A "stop" is where I sleep along the route: each city with coordinates, or the country itself
 * when it has no cities yet. `transport` is how I get HERE from the previous stop; for the first
 * stop that means "from home".
 */
export type Stop = {
  key: string;
  kind: "city" | "country";
  id: string;
  tripCountryId: string;
  countryCode: string;
  name: string;
  lat: number | null;
  lng: number | null;
  tz: string | null;
  arrive: string | null;
  depart: string | null;
  transport: string | null;
  transportNote: string | null;
  /** The entity that owns `transport` (city row or trip_country row). */
  transportOwner: { kind: "city" | "country"; id: string };
};

export type Leg = {
  from: Stop | HomeStop;
  to: Stop;
  jetlag: JetLag | null;
};

export type HomeStop = { key: "home"; kind: "home"; name: string; lat: number | null; lng: number | null; tz: string | null };

type CountryLike = {
  id: string;
  code: string;
  name: string;
  order_index: number;
  arrive_date: string | null;
  depart_date: string | null;
  transport_mode?: string | null;
  transport_note?: string | null;
  tz?: string | null;
  lat?: number | null;
  lng?: number | null;
};
type CityLike = {
  id: string;
  trip_country_id: string;
  name: string;
  order_index: number;
  lat: number | null;
  lng: number | null;
  arrive_date: string | null;
  depart_date: string | null;
  timezone?: string | null;
  transport_mode?: string | null;
  transport_note?: string | null;
};

/** Ordered stops for one trip (countries in route order, cities in their order). */
export function buildStops(countries: CountryLike[], cities: CityLike[]): Stop[] {
  const out: Stop[] = [];
  for (const c of [...countries].sort((a, b) => a.order_index - b.order_index)) {
    const list = cities.filter((x) => x.trip_country_id === c.id).sort((a, b) => a.order_index - b.order_index);
    if (!list.length) {
      out.push({
        key: `country:${c.id}`,
        kind: "country",
        id: c.id,
        tripCountryId: c.id,
        countryCode: c.code,
        name: c.name,
        lat: c.lat ?? null,
        lng: c.lng ?? null,
        tz: c.tz ?? null,
        arrive: c.arrive_date,
        depart: c.depart_date,
        transport: c.transport_mode ?? null,
        transportNote: c.transport_note ?? null,
        transportOwner: { kind: "country", id: c.id },
      });
      continue;
    }
    list.forEach((city, i) => {
      // Entering a new country: the country's own "how do I get here" applies unless the city overrides it.
      const first = i === 0;
      const mode = first ? (city.transport_mode ?? c.transport_mode ?? null) : (city.transport_mode ?? null);
      const note = first ? (city.transport_note ?? c.transport_note ?? null) : (city.transport_note ?? null);
      out.push({
        key: `city:${city.id}`,
        kind: "city",
        id: city.id,
        tripCountryId: c.id,
        countryCode: c.code,
        name: city.name,
        lat: city.lat,
        lng: city.lng,
        tz: city.timezone ?? c.tz ?? null,
        arrive: city.arrive_date ?? (first ? c.arrive_date : null),
        depart: city.depart_date ?? (i === list.length - 1 ? c.depart_date : null),
        transport: mode,
        transportNote: note,
        transportOwner: first && !city.transport_mode && c.transport_mode ? { kind: "country", id: c.id } : { kind: "city", id: city.id },
      });
    });
  }
  return out;
}

/** Legs between consecutive stops (first leg from home when home is known), with jet lag. */
export function buildLegs(stops: Stop[], home: HomeStop | null): Leg[] {
  const legs: Leg[] = [];
  const fallbackDate = todayIso();
  stops.forEach((to, i) => {
    const from: Stop | HomeStop | null = i === 0 ? home : stops[i - 1]!;
    if (!from) return;
    const departDate = ("depart" in from ? from.depart : null) ?? to.arrive ?? fallbackDate;
    const arriveDate = to.arrive ?? departDate;
    legs.push({ from, to, jetlag: jetLag(from.tz, departDate, to.tz, arriveDate) });
  });
  return legs;
}

/** Leg arriving at the given trip country (its first stop), if any. */
export function legIntoCountry(legs: Leg[], tripCountryId: string) {
  return legs.find((l) => l.to.tripCountryId === tripCountryId && (l.from.kind === "home" || (l.from as Stop).tripCountryId !== tripCountryId)) ?? null;
}
