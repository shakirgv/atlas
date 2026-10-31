import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";
import { USER_AGENT } from "@/lib/config";

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

const params = z.object({
  q: z.string().trim().min(2).max(200),
  layer: z.enum(["city", "any"]).default("any"),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  lat: z.coerce.number<string>().min(-90).max(90).optional(),
  lng: z.coerce.number<string>().min(-180).max(180).optional(),
});

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

async function photon(input: z.infer<typeof params>): Promise<GeoResult[]> {
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
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).map(fromPhoton).filter((r): r is GeoResult => Boolean(r));
}

async function nominatim(input: z.infer<typeof params>): Promise<GeoResult[]> {
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
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(6000) });
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

/** GET /api/geocode?q=&layer=city&country=JP&lat=&lng= — Photon with Nominatim fallback. */
export async function GET(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  try {
    const sp = new URL(req.url).searchParams;
    const input = params.parse({
      q: sp.get("q"),
      layer: sp.get("layer") ?? undefined,
      country: sp.get("country") ?? undefined,
      lat: sp.get("lat") ?? undefined,
      lng: sp.get("lng") ?? undefined,
    });
    const key = JSON.stringify(input).toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ results: hit.results });

    let results: GeoResult[] = [];
    try {
      results = await photon(input);
    } catch {
      results = [];
    }
    if (input.country) results = results.filter((r) => !r.countryCode || r.countryCode === input.country!.toUpperCase());
    if (!results.length) {
      try {
        results = await nominatim(input);
      } catch {
        return NextResponse.json({ results: [], error: "Search is unavailable right now. You can still type a name." }, { status: 200 });
      }
    }
    results = results.slice(0, 6);
    cache.set(key, { at: Date.now(), results });
    return NextResponse.json({ results });
  } catch (e) {
    return apiError(e);
  }
}
