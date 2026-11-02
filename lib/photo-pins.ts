import { distanceKm } from "@/lib/geo";
import type { Photo, PhotoView } from "@/lib/types";

export type PinSource = "gps" | "place" | "city";

export type PhotoPin = {
  photo: PhotoView;
  lat: number;
  lng: number;
  /** Which fact gave the location. Internal: it decides nothing on screen. */
  source: PinSource;
  tripId: string | null;
  tripCountryId: string | null;
  cityId: string | null;
  year: string | null;
  label: string;
};

export type UnlocatedPhoto = Omit<PhotoPin, "lat" | "lng" | "source">;

type GeoRef = { lat: number | null; lng: number | null };
type PlaceRef = GeoRef & { id: string; city_id: string };
type CityRef = GeoRef & { id: string; trip_country_id: string };
type CountryRef = { id: string; trip_id: string };
type MemoryRef = { id: string; trip_id: string; trip_country_id: string | null; city_id: string | null; place_id: string | null; date: string; title: string | null };

export type PinContext = { memories: MemoryRef[]; places: PlaceRef[]; cities: CityRef[]; countries: CountryRef[] };

type Links = { placeId: string | null; cityId: string | null; countryId: string | null; tripId: string | null; memory: MemoryRef | null };

/** What a photo is attached to, whichever kind of entity holds it. */
function linksFor(photo: Pick<Photo, "entity_type" | "entity_id">, ctx: PinContext): Links {
  const none: Links = { placeId: null, cityId: null, countryId: null, tripId: null, memory: null };
  switch (photo.entity_type) {
    case "memory": {
      const m = ctx.memories.find((x) => x.id === photo.entity_id);
      return m ? { placeId: m.place_id, cityId: m.city_id, countryId: m.trip_country_id, tripId: m.trip_id, memory: m } : none;
    }
    case "place":
      return { ...none, placeId: photo.entity_id };
    case "city":
      return { ...none, cityId: photo.entity_id };
    case "country":
      return { ...none, countryId: photo.entity_id };
    case "trip":
      return { ...none, tripId: photo.entity_id };
    default:
      return none;
  }
}

/** The photo's own GPS, else its linked place, else its linked city, else nothing. */
export function resolveLocation(photo: Pick<Photo, "lat" | "lng" | "entity_type" | "entity_id">, ctx: PinContext): { lat: number; lng: number; source: PinSource } | null {
  if (photo.lat != null && photo.lng != null) return { lat: photo.lat, lng: photo.lng, source: "gps" };
  const links = linksFor(photo, ctx);
  const place = ctx.places.find((p) => p.id === links.placeId);
  if (place?.lat != null && place.lng != null) return { lat: place.lat, lng: place.lng, source: "place" };
  const city = ctx.cities.find((c) => c.id === (links.cityId ?? place?.city_id));
  if (city?.lat != null && city.lng != null) return { lat: city.lat, lng: city.lng, source: "city" };
  return null;
}

/** Splits photos into those with a location (pins) and those waiting for one (the tray). */
export function buildPins(photos: PhotoView[], ctx: PinContext): { pins: PhotoPin[]; unlocated: UnlocatedPhoto[] } {
  const pins: PhotoPin[] = [];
  const unlocated: UnlocatedPhoto[] = [];
  for (const photo of photos) {
    const links = linksFor(photo, ctx);
    const place = ctx.places.find((p) => p.id === links.placeId);
    const cityId = links.cityId ?? place?.city_id ?? null;
    const city = ctx.cities.find((c) => c.id === cityId);
    const tripCountryId = links.countryId ?? city?.trip_country_id ?? null;
    const tripId = links.tripId ?? ctx.countries.find((c) => c.id === tripCountryId)?.trip_id ?? null;
    const date = photo.taken_at ?? links.memory?.date ?? null;
    const base = { photo, tripId, tripCountryId, cityId, year: date ? date.slice(0, 4) : null, label: photo.caption ?? links.memory?.title ?? "" };
    const at = resolveLocation(photo, ctx);
    if (at) pins.push({ ...base, ...at });
    else unlocated.push(base);
  }
  return { pins, unlocated };
}

export type PinFilter = { trip?: string; country?: string; year?: string };

export function filterPins<T extends Pick<PhotoPin, "tripId" | "tripCountryId" | "year">>(pins: T[], f: PinFilter) {
  return pins.filter((p) => (!f.trip || p.tripId === f.trip) && (!f.country || p.tripCountryId === f.country) && (!f.year || p.year === f.year));
}

export function pinYears(pins: { year: string | null }[]) {
  return Array.from(new Set(pins.flatMap((p) => (p.year ? [p.year] : [])))).sort().reverse();
}

export type PhotoBadge = { key: string; lat: number; lng: number; count: number; name: string };

/** A GPS photo with no linked city still counts for a city it was taken next to. */
const NEAR_CITY_KM = 100;

/** World map badges: photo counts per city (zoomed in) and per country (zoomed out). */
export function photoBadges(pins: PhotoPin[], cities: (CityRef & { name: string })[], countries: { id: string; name: string; anchor: [number, number] | null }[]): { cities: PhotoBadge[]; countries: PhotoBadge[] } {
  const located = cities.filter((c) => c.lat != null && c.lng != null);
  const byCity = new Map<string, number>();
  const byCountry = new Map<string, number>();
  for (const pin of pins) {
    let cityId = pin.cityId;
    if (!cityId) {
      const near = located
        .map((c) => ({ c, km: distanceKm({ lat: c.lat!, lng: c.lng! }, pin) }))
        .filter((x) => x.km <= NEAR_CITY_KM)
        .sort((a, b) => a.km - b.km)[0];
      cityId = near?.c.id ?? null;
    }
    if (cityId) byCity.set(cityId, (byCity.get(cityId) ?? 0) + 1);
    const countryId = pin.tripCountryId ?? located.find((c) => c.id === cityId)?.trip_country_id ?? null;
    if (countryId) byCountry.set(countryId, (byCountry.get(countryId) ?? 0) + 1);
  }
  return {
    cities: located.flatMap((c) => (byCity.get(c.id) ? [{ key: c.id, lat: c.lat!, lng: c.lng!, count: byCity.get(c.id)!, name: c.name }] : [])),
    countries: countries.flatMap((c) => (byCountry.get(c.id) && c.anchor ? [{ key: c.id, lat: c.anchor[0], lng: c.anchor[1], count: byCountry.get(c.id)!, name: c.name }] : [])),
  };
}
