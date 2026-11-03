import "server-only";
import { USER_AGENT } from "@/lib/config";
import { pickPin, placeQuery, type PinPick } from "@/lib/place-pin";
import type { ServerSupabase } from "@/lib/supabase/server";

export type GeoResult = {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  countryCode: string | null;
  city: string | null;
  address: string | null;
  kind: string | null;
};

export type GeoQuery = {
  q: string;
  layer: "city" | "any";
  country?: string;
  lat?: number;
  lng?: number;
};

const cache = new Map<string, { at: number; results: GeoResult[] }>();
const TTL = 1000 * 60 * 60 * 24;
let lastNominatim = 0;

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    district?: string;
    type?: string;
    osm_value?: string;
  };
};

function fromPhoton(f: PhotonFeature): GeoResult | null {
  const p = f.properties;
  if (!p.name) return null;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const address = [street, p.district, p.city, p.postcode, p.country].filter(Boolean).join(", ") || null;
  const label = [p.name, p.city && p.city !== p.name ? p.city : null, p.state, p.country].filter(Boolean).join(", ");
  return {
    id: `${p.osm_type ?? "x"}${p.osm_id ?? Math.random()}`,
    name: p.name,
    label,
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    countryCode: p.countrycode?.toUpperCase() ?? null,
    city: p.city ?? null,
    address,
    kind: p.osm_value ?? p.type ?? null,
  };
}

async function photon(input: GeoQuery, timeoutMs: number): Promise<GeoResult[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", input.q);
  url.searchParams.set("limit", input.country ? "15" : "6");
  url.searchParams.set("lang", "en");
  if (input.layer === "city") {
    url.searchParams.append("layer", "city");
  }
  if (input.lat !== undefined && input.lng !== undefined) {
    url.searchParams.set("lat", String(input.lat));
    url.searchParams.set("lon", String(input.lng));
  }
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).map(fromPhoton).filter((r): r is GeoResult => Boolean(r));
}

async function nominatim(input: GeoQuery, timeoutMs: number): Promise<GeoResult[]> {
  // Respect the 1 request / second policy.
  const wait = 1000 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", input.q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");
  if (input.country) url.searchParams.set("countrycodes", input.country.toLowerCase());
  if (input.layer === "city") url.searchParams.set("featureType", "city");
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  type N = { place_id: number; name?: string; display_name: string; lat: string; lon: string; type?: string; address?: Record<string, string> };
  const json = (await res.json()) as N[];
  return json.map((n) => ({
    id: `n${n.place_id}`,
    name: n.name || n.display_name.split(",")[0]!,
    label: n.display_name,
    lat: Number(n.lat),
    lng: Number(n.lon),
    countryCode: n.address?.country_code?.toUpperCase() ?? null,
    city: n.address?.city ?? n.address?.town ?? n.address?.village ?? null,
    address: n.display_name,
    kind: n.type ?? null,
  }));
}

/** Photon with Nominatim fallback. Throws when neither can answer. */
export async function geocode(input: GeoQuery, timeoutMs = 6000): Promise<GeoResult[]> {
  const key = JSON.stringify(input).toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.results;

  let results: GeoResult[] = [];
  try {
    results = await photon(input, timeoutMs);
  } catch {
    results = [];
  }
  if (input.country) results = results.filter((r) => !r.countryCode || r.countryCode === input.country!.toUpperCase());
  if (!results.length) results = await nominatim(input, timeoutMs);
  results = results.slice(0, 6);
  cache.set(key, { at: Date.now(), results });
  return results;
}

export type PlacePin = { lat: number; lng: number; address: string };

/** The save waits for this, so a slow search gives up early and leaves the place without a pin. */
const PIN_TIMEOUT_MS = 2500;

/** Where a place in this city probably is. Never throws: a place without a pin can still be saved. */
export async function findPlacePin(supabase: ServerSupabase, cityId: string, name: string): Promise<PlacePin | null> {
  const query = placeQuery(name);
  if (!query) return null;
  let best: PinPick | null = null;
  try {
    const { data: city } = await supabase.from("cities").select("name, lat, lng, trip_countries(country_code)").eq("id", cityId).maybeSingle();
    if (!city) return null;
    const hasCoords = city.lat != null && city.lng != null;
    const startedAt = Date.now();
    // The city name sharpens most searches, but hides a day trip that lies outside it.
    for (const q of [`${query}, ${city.name}`.slice(0, 200), query.slice(0, 200)]) {
      if (Date.now() - startedAt > PIN_TIMEOUT_MS) break;
      const results = await geocode(
        {
          q,
          layer: "any",
          // Distance already rules out namesakes, and a border shouldn't: the Vatican Museums are in Rome but not in Italy.
          country: hasCoords ? undefined : city.trip_countries?.country_code.trim() || undefined,
          lat: city.lat ?? undefined,
          lng: city.lng ?? undefined,
        },
        PIN_TIMEOUT_MS,
      );
      const pick = pickPin(query, city, results);
      if (pick?.full) {
        best = pick;
        break;
      }
      best ??= pick;
    }
  } catch {
    // Keep whatever the first search found.
  }
  return best && { lat: best.result.lat, lng: best.result.lng, address: best.result.address ?? best.result.label };
}
