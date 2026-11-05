import { normalizeName } from "@/lib/normalize-name";

/** The filters shared by Timeline, Gallery and Map. An empty string means "all". */
export type MemoryFilters = { q: string; country: string; city: string; year: string; tag: string };
export const NO_FILTERS: MemoryFilters = { q: "", country: "", city: "", year: "", tag: "" };
const KEYS = ["q", "country", "city", "year", "tag"] as const;

type MemoryLike = { id: string; date: string; title: string | null; body: string | null; tags: string[]; trip_country_id: string | null; city_id: string | null; place_id: string | null };
type CountryRef = { id: string; code: string; name: string; flag: string };
type CityRef = { id: string; name: string; trip_country_id: string };
type PlaceRef = { id: string; city_id: string };
export type FacetContext = { countries: CountryRef[]; cities: CityRef[]; places?: PlaceRef[] };

/**
 * The same country or city appears once per trip. Filters group them: a country by its code,
 * a city by its country code and folded name, so "Kyoto" on two trips is one choice.
 */
export function memoryFacets(m: MemoryLike, ctx: FacetContext) {
  const placeCity = m.place_id ? ctx.places?.find((p) => p.id === m.place_id)?.city_id : undefined;
  const city = ctx.cities.find((c) => c.id === (m.city_id ?? placeCity));
  const country = ctx.countries.find((c) => c.id === (m.trip_country_id ?? city?.trip_country_id));
  const code = country?.code.toUpperCase() ?? "";
  return {
    country: code,
    countryLabel: country ? `${country.flag} ${country.name}` : "",
    city: city && code ? cityKey(code, city.name) : "",
    cityName: city?.name ?? "",
    year: m.date.slice(0, 4),
  };
}

export const cityKey = (countryCode: string, name: string) => `${countryCode.toUpperCase()}:${normalizeName(name)}`;

/** Every word of the query, accents and case ignored, somewhere in the title or text. */
export function matchesQuery(m: Pick<MemoryLike, "title" | "body" | "tags">, q: string) {
  const words = normalizeName(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = normalizeName(`${m.title ?? ""} ${m.body ?? ""}`);
  return words.every((w) => hay.includes(w));
}

export function filterMemories<T extends MemoryLike>(memories: T[], f: MemoryFilters, ctx: FacetContext): T[] {
  return memories.filter((m) => {
    if (f.tag && !m.tags.includes(f.tag)) return false;
    if (f.country || f.city || f.year) {
      const facets = memoryFacets(m, ctx);
      if (f.country && facets.country !== f.country) return false;
      if (f.city && facets.city !== f.city) return false;
      if (f.year && facets.year !== f.year) return false;
    }
    return matchesQuery(m, f.q);
  });
}

export const hasFilters = (f: MemoryFilters) => KEYS.some((k) => f[k] !== "");

export type FilterOption = { value: string; label: string; count: number };

/** Choices that match at least one memory, with how many each holds. */
export function filterOptions(memories: MemoryLike[], ctx: FacetContext) {
  const countries = new Map<string, FilterOption>();
  const cities = new Map<string, FilterOption & { country: string }>();
  const years = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const m of memories) {
    const f = memoryFacets(m, ctx);
    if (f.country) countries.set(f.country, { value: f.country, label: f.countryLabel, count: (countries.get(f.country)?.count ?? 0) + 1 });
    if (f.city) cities.set(f.city, { value: f.city, label: cities.get(f.city)?.label ?? f.cityName, country: f.country, count: (cities.get(f.city)?.count ?? 0) + 1 });
    years.set(f.year, (years.get(f.year) ?? 0) + 1);
    for (const t of m.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  }
  const byLabel = (a: FilterOption, b: FilterOption) => a.label.replace(/^\S+\s/, "").localeCompare(b.label.replace(/^\S+\s/, ""));
  return {
    countries: Array.from(countries.values()).sort(byLabel),
    cities: Array.from(cities.values()).sort((a, b) => a.label.localeCompare(b.label)),
    years: Array.from(years.entries())
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.value.localeCompare(a.value)),
    // Most used first, so the tags worth filtering by are at the top.
    tags: Array.from(tags.entries())
      .map(([value, count]) => ({ value, label: `#${value}`, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  };
}

/** Filters from the page URL. Unknown or repeated values fall back to "all". */
export function parseFilters(sp: Record<string, string | string[] | undefined>): MemoryFilters {
  const out = { ...NO_FILTERS };
  for (const k of KEYS) {
    const v = sp[k];
    if (typeof v === "string") out[k] = v.trim();
  }
  if (!/^\d{4}$/.test(out.year)) out.year = "";
  out.country = out.country.toUpperCase();
  // A link to one city (from its page) picks its country too.
  return out.city && !out.country ? withCity(out, out.city) : out;
}

/** Writes the filters into a URL, dropping the ones set to "all". */
export function writeFilters(url: URL, f: MemoryFilters) {
  for (const k of KEYS) {
    if (f[k]) url.searchParams.set(k, f[k]);
    else url.searchParams.delete(k);
  }
  return url;
}

/** Changing the country clears a city that isn't in it. */
export function withCountry(f: MemoryFilters, country: string): MemoryFilters {
  return { ...f, country, city: country && f.city && !f.city.startsWith(`${country}:`) ? "" : f.city };
}

/** Picking a city also picks its country. */
export function withCity(f: MemoryFilters, city: string): MemoryFilters {
  return { ...f, city, country: city ? city.split(":")[0]! : f.country };
}

/** Text long enough to fold behind "Read more". */
export function isLongText(body: string | null | undefined, chars = 320, lines = 6) {
  if (!body) return false;
  return body.length > chars || body.split("\n").filter((l) => l.trim()).length > lines;
}

type GeoPhoto = { lat: number | null; lng: number | null };
type GeoRef = { id: string; lat: number | null; lng: number | null };

/** Where a memory goes on the map: a photo's GPS, else its place, else its city. */
export function memoryLocation(
  m: { photos: GeoPhoto[]; place_id: string | null; city_id: string | null },
  places: (GeoRef & { city_id: string })[],
  cities: GeoRef[],
): { lat: number; lng: number } | null {
  const gps = m.photos.find((p) => p.lat != null && p.lng != null);
  if (gps) return { lat: gps.lat!, lng: gps.lng! };
  const place = places.find((p) => p.id === m.place_id);
  if (place?.lat != null && place.lng != null) return { lat: place.lat, lng: place.lng };
  const city = cities.find((c) => c.id === (m.city_id ?? place?.city_id));
  if (city?.lat != null && city.lng != null) return { lat: city.lat, lng: city.lng };
  return null;
}
