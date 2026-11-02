import { z } from "zod";
import { fmtDate, fmtRange } from "@/lib/dates";
import { roundCoord } from "@/lib/geo";
import type { RecapStats } from "@/lib/recap";

export const SHARE_EXPIRY_OPTIONS = [7, 30, 90] as const;
export const DEFAULT_SHARE_EXPIRY = 30;

export const shareConfigSchema = z.object({
  exact_locations: z.boolean().default(false),
  show_dates: z.boolean().default(true),
  include_itinerary: z.boolean().default(false),
  preview_image: z.boolean().default(true),
  /** Photos are all shared unless left out here, so a photo added later is shared too. */
  excluded_photo_ids: z.array(z.string()).max(2000).default([]),
});
export type ShareConfig = z.output<typeof shareConfigSchema>;

/** Bad or missing stored config falls back to the most private settings, never the most open. */
export function parseShareConfig(json: unknown): ShareConfig {
  const parsed = shareConfigSchema.safeParse(json);
  return parsed.success ? parsed.data : { exact_locations: false, show_dates: false, include_itinerary: false, preview_image: false, excluded_photo_ids: [] };
}

export function isShareValid(share: { revoked_at: string | null; expires_at: string | null } | null | undefined, now = new Date()) {
  if (!share || share.revoked_at) return false;
  return !share.expires_at || new Date(share.expires_at) > now;
}

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|twitter|discord|slack|linkedin|preview|embedly|headless|curl|wget|python-requests/i;

/** Link unfurlers and crawlers don't count as views. Anything else that claims to be a browser does. */
export function isLikelyBot(userAgent: string | null | undefined) {
  return !userAgent || BOT.test(userAgent);
}

/** Best effort: one instance's memory only, and nothing is stored. Enough to slow down token guessing. */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now = Date.now()) => {
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  };
}

export type PublicPhoto = { id: string; width: number | null; height: number | null; caption: string | null };
export type PublicPoint = { lat: number; lng: number };
export type PublicStop = { time: string | null; title: string };
export type PublicDay = { title: string; date: string | null; stops: PublicStop[] };
export type PublicItem = { title: string | null; date: string | null; place: string | null; body: string | null; photos: PublicPhoto[] };
export type PublicSection = { heading: string; subheading: string | null; flag: string | null; items: PublicItem[]; days: PublicDay[] };

/**
 * Everything a visitor gets. Built field by field from the functions below, so a column added to a
 * table later can't reach this page by accident. Budget, cash, documents, entry data, private notes,
 * home and settings have no field here at all.
 */
export type PublicView = {
  kind: "memory" | "trip" | "recap";
  title: string;
  dateLine: string | null;
  placeLine: string | null;
  intro: string | null;
  coverId: string | null;
  attribution: string | null;
  countries: string[];
  points: PublicPoint[];
  stats: { label: string; value: string }[];
  sections: PublicSection[];
  /** Everything the gallery shows, and the only ids the photo route will serve (plus the cover). */
  photos: PublicPhoto[];
};

type PhotoRow = { id: string; entity_id: string; width: number | null; height: number | null; caption: string | null; lat?: number | null; lng?: number | null };

const publicPhoto = (p: PhotoRow): PublicPhoto => ({ id: p.id, width: p.width, height: p.height, caption: p.caption });
const allowed = (photos: PhotoRow[], config: ShareConfig) => photos.filter((p) => !config.excluded_photo_ids.includes(p.id));

/** City level unless exact locations were chosen: rounded to about 11 km. */
function point(lat: number | null | undefined, lng: number | null | undefined, exact: boolean): PublicPoint | null {
  if (lat == null || lng == null) return null;
  return exact ? { lat, lng } : { lat: roundCoord(lat), lng: roundCoord(lng) };
}

export function shareablePhotoIds(view: PublicView) {
  return new Set([...view.photos.map((p) => p.id), ...view.sections.flatMap((s) => s.items.flatMap((i) => i.photos.map((p) => p.id))), ...(view.coverId ? [view.coverId] : [])]);
}

type GeoRow = { lat: number | null; lng: number | null };
type MemoryRow = { id: string; date: string; title: string | null; body: string | null; mood?: string | null };
type NamedGeo = GeoRow & { name: string };
type CountryRow = { code: string; name: string };

export function buildMemoryView(row: { memory: MemoryRow; city: NamedGeo | null; place: NamedGeo | null; country: CountryRow | null; photos: PhotoRow[]; config: ShareConfig }): PublicView {
  const { memory, city, place, country, config } = row;
  const exact = config.exact_locations;
  const photos = allowed(row.photos, config);
  const placeLine = [exact ? place?.name : null, city?.name, country?.name].filter(Boolean).join(", ") || null;
  const gps = exact ? photos.flatMap((p) => { const at = point(p.lat, p.lng, true); return at ? [at] : []; }) : [];
  const anchor = exact ? (place ?? city) : city;
  const at = anchor ? point(anchor.lat, anchor.lng, exact) : null;
  return {
    kind: "memory",
    title: memory.title || (city ? `A memory from ${city.name}` : "A memory"),
    dateLine: config.show_dates ? fmtDate(memory.date, "dd MMMM yyyy") : null,
    placeLine,
    intro: null,
    coverId: photos[0]?.id ?? null,
    attribution: null,
    countries: country ? [country.code] : [],
    points: gps.length ? gps : at ? [at] : [],
    stats: [],
    sections: [{ heading: "", subheading: null, flag: null, days: [], items: [{ title: null, date: null, place: null, body: memory.body, photos: [] }] }],
    photos: photos.map(publicPhoto),
  };
}

type TripRow = { title: string; description: string | null; start_date: string | null; end_date: string | null };
type TripCountryRow = { id: string; code: string; name: string; flag: string; arrive_date: string | null; depart_date: string | null };
type TripCityRow = NamedGeo & { id: string; trip_country_id: string };
type TripMemoryRow = MemoryRow & { trip_country_id: string | null; city_id: string | null };
type DayRow = { id: string; trip_country_id: string; title: string | null; day_number: number; date: string | null };
type ItemRow = { day_id: string; title: string; start_time: string | null };

export function buildTripView(row: { trip: TripRow; countries: TripCountryRow[]; cities: TripCityRow[]; memories: TripMemoryRow[]; photos: PhotoRow[]; days: DayRow[]; items: ItemRow[]; cover: { id: string; attribution: string | null } | null; config: ShareConfig }): PublicView {
  const { trip, countries, cities, memories, days, items, cover, config } = row;
  const exact = config.exact_locations;
  const photos = allowed(row.photos, config);
  const dated = config.show_dates;
  const itemFor = (m: TripMemoryRow): PublicItem => ({
    title: m.title,
    date: dated ? fmtDate(m.date, "dd MMM yyyy") : null,
    place: cities.find((c) => c.id === m.city_id)?.name ?? null,
    body: m.body,
    photos: photos.filter((p) => p.entity_id === m.id).map(publicPhoto),
  });
  const known = new Set(countries.map((c) => c.id));
  const sections: PublicSection[] = countries.map((c) => ({
    heading: c.name,
    flag: c.flag,
    subheading: [dated ? fmtRange(c.arrive_date, c.depart_date) : null, cities.filter((x) => x.trip_country_id === c.id).map((x) => x.name).join(", ") || null].filter(Boolean).join(" · ") || null,
    items: memories.filter((m) => m.trip_country_id === c.id).map(itemFor),
    days: config.include_itinerary
      ? days
          .filter((d) => d.trip_country_id === c.id)
          .map((d) => ({
            title: d.title ?? `Day ${d.day_number}`,
            date: dated && d.date ? fmtDate(d.date, "EEE, dd MMM") : null,
            stops: items.filter((i) => i.day_id === d.id).map((i) => ({ time: i.start_time ? i.start_time.slice(0, 5) : null, title: i.title })),
          }))
      : [],
  }));
  const loose = memories.filter((m) => !m.trip_country_id || !known.has(m.trip_country_id));
  if (loose.length) sections.push({ heading: "Along the way", flag: null, subheading: null, days: [], items: loose.map(itemFor) });
  return {
    kind: "trip",
    title: trip.title,
    dateLine: dated && (trip.start_date || trip.end_date) ? fmtRange(trip.start_date, trip.end_date) : null,
    placeLine: countries.map((c) => c.name).join(" · ") || null,
    intro: trip.description,
    coverId: cover?.id ?? photos[0]?.id ?? null,
    attribution: cover?.attribution ?? null,
    countries: countries.map((c) => c.code),
    points: cities.flatMap((c) => {
      const at = point(c.lat, c.lng, exact);
      return at ? [at] : [];
    }),
    stats: [
      { label: countries.length === 1 ? "country" : "countries", value: String(countries.length) },
      ...(cities.length ? [{ label: cities.length === 1 ? "city" : "cities", value: String(cities.length) }] : []),
    ],
    sections: sections.filter((s) => s.items.length || s.days.length || s.subheading),
    photos: photos.map(publicPhoto),
  };
}

/** A recap without its money: spending is never shared, whatever else is. */
export function buildRecapView(stats: RecapStats, photos: PhotoRow[], config: ShareConfig): PublicView {
  const mosaic = allowed(photos, config).filter((p) => stats.mosaic.some((m) => m.id === p.id));
  const memory = stats.favoriteMemory;
  const facts: [string, number][] = [
    [stats.countries.length === 1 ? "country" : "countries", stats.countries.length],
    [stats.cities.length === 1 ? "city" : "cities", stats.cities.length],
    [stats.daysOnRoad === 1 ? "day on the road" : "days on the road", stats.daysOnRoad],
    ["km, roughly", stats.distanceKm],
    [stats.placesVisited === 1 ? "place visited" : "places visited", stats.placesVisited],
    [stats.photoCount === 1 ? "photo" : "photos", stats.photoCount],
  ];
  return {
    kind: "recap",
    title: stats.period === "all" ? "All my travels" : `My ${stats.period} in travel`,
    dateLine: null,
    placeLine: stats.countries.map((c) => c.name).slice(0, 8).join(" · ") || null,
    intro: null,
    coverId: mosaic[0]?.id ?? null,
    attribution: null,
    countries: stats.countries.map((c) => c.code),
    points: stats.route.flatMap((r) => {
      const at = point(r.lat, r.lng, config.exact_locations);
      return at ? [at] : [];
    }),
    stats: facts.filter(([, n]) => n > 0).map(([label, n]) => ({ label, value: n.toLocaleString("en-US") })),
    sections: memory
      ? [{ heading: "A favourite memory", flag: null, subheading: null, days: [], items: [{ title: memory.title, date: config.show_dates ? fmtDate(memory.date, "dd MMM yyyy") : null, place: null, body: memory.excerpt, photos: [] }] }]
      : [],
    photos: mosaic.map(publicPhoto),
  };
}
