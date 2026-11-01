import "server-only";
import sharp from "sharp";
import type { ServerSupabase } from "@/lib/supabase/server";
import { BUCKETS, USER_AGENT } from "@/lib/config";
import { getCountry } from "@/lib/countries";

/** Only these hosts may be fetched server-side (no open proxy). */
const WIKI_HOSTS = new Set(["en.wikipedia.org", "commons.wikimedia.org", "upload.wikimedia.org"]);

export type CoverKind = "trip" | "country" | "city" | "place";
export type CoverCandidate = { url: string; thumb: string; title: string; attribution: string };

const lookupCache = new Map<string, { at: number; value: CoverCandidate | null }>();
const CACHE_MS = 1000 * 60 * 60 * 12;

async function wikiFetch(url: string) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !WIKI_HOSTS.has(u.hostname)) throw new Error("Blocked host");
  return fetch(u, {
    headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT, Accept: "application/json" },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(8000),
  });
}

type Summary = {
  type?: string;
  title?: string;
  originalimage?: { source: string; width: number; height: number };
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
};

function looksLikeMapOrFlag(src: string) {
  return /(flag|locator|location|map|coat_of_arms|emblem|seal|\.svg)/i.test(src);
}

async function summary(title: string): Promise<CoverCandidate | null> {
  const res = await wikiFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
  if (!res.ok) return null;
  const json = (await res.json()) as Summary;
  if (json.type === "disambiguation") return null;
  const src = json.originalimage?.source ?? json.thumbnail?.source;
  if (!src || looksLikeMapOrFlag(src)) return null;
  return {
    url: src,
    thumb: json.thumbnail?.source ?? src,
    title: json.title ?? title,
    attribution: `Photo via Wikipedia — “${json.title ?? title}” (${json.content_urls?.desktop?.page ?? "en.wikipedia.org"}). See the file page on Wikimedia Commons for author and license.`,
  };
}

async function searchTitle(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(query)}`;
  const res = await wikiFetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { query?: { search?: { title: string }[] } };
  return json.query?.search?.[0]?.title ?? null;
}

/** Wikipedia summary image for the first query that hits (direct title, then search). */
export async function findWikiImage(queries: string[]): Promise<CoverCandidate | null> {
  for (const q of queries) {
    const key = q.toLowerCase();
    const cached = lookupCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      if (cached.value) return cached.value;
      continue;
    }
    let hit: CoverCandidate | null = null;
    try {
      hit = await summary(q);
      if (!hit) {
        const title = await searchTitle(q);
        if (title) hit = await summary(title);
      }
    } catch {
      hit = null;
    }
    lookupCache.set(key, { at: Date.now(), value: hit });
    if (hit) return hit;
  }
  return null;
}

/** Up to 8 Wikimedia Commons image candidates (Phase 2 "Choose another"). */
export async function commonsCandidates(query: string): Promise<CoverCandidate[]> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=16" +
    `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640`;
  const res = await wikiFetch(url);
  if (!res.ok) return [];
  type Info = { url: string; thumburl?: string; mime?: string; extmetadata?: Record<string, { value?: string }> };
  const json = (await res.json()) as { query?: { pages?: Record<string, { title: string; index?: number; imageinfo?: Info[] }> } };
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const strip = (s?: string) => (s ?? "").replace(/<[^>]+>/g, "").trim();
  const out: CoverCandidate[] = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime ?? "")) continue;
    if (looksLikeMapOrFlag(info.url)) continue;
    const artist = strip(info.extmetadata?.Artist?.value) || "Unknown author";
    const license = strip(info.extmetadata?.LicenseShortName?.value) || "see Commons";
    out.push({
      url: info.url,
      thumb: info.thumburl ?? info.url,
      title: p.title.replace(/^File:/, ""),
      attribution: `${artist} · ${license} · Wikimedia Commons (${p.title})`,
    });
    if (out.length >= 8) break;
  }
  return out;
}

/** Build the lookup queries for an entity (see CLAUDE.md §6). */
export async function coverQueries(supabase: ServerSupabase, kind: CoverKind, id: string): Promise<{ queries: string[]; label: string } | null> {
  if (kind === "country") {
    const { data } = await supabase.from("trip_countries").select("country_code").eq("id", id).maybeSingle();
    const c = getCountry(data?.country_code);
    if (!c) return null;
    const qs = [`Tourism in ${c.name}`];
    if (c.capital[0]) qs.push(c.capital[0], `${c.capital[0]}, ${c.name}`);
    return { queries: qs, label: c.name };
  }
  if (kind === "city") {
    const { data } = await supabase.from("cities").select("name, trip_country_id, trip_countries(country_code)").eq("id", id).maybeSingle();
    if (!data) return null;
    const tc = data.trip_countries as unknown as { country_code: string } | null;
    const country = getCountry(tc?.country_code)?.name;
    // Country-qualified first so "Batman" finds the city in Türkiye, not the superhero.
    return { queries: country ? [`${data.name}, ${country}`, `${data.name} (city)`, data.name] : [data.name], label: country ? `${data.name}, ${country}` : data.name };
  }
  if (kind === "place") {
    const { data } = await supabase.from("places").select("name, cities(name)").eq("id", id).maybeSingle();
    if (!data) return null;
    const city = (data.cities as unknown as { name: string } | null)?.name;
    return { queries: city ? [`${data.name}, ${city}`, data.name] : [data.name], label: data.name };
  }
  const { data } = await supabase.from("trips").select("title").eq("id", id).maybeSingle();
  if (!data) return null;
  return { queries: [data.title], label: data.title };
}

const TABLE = { trip: "trips", country: "trip_countries", city: "cities", place: "places" } as const;

/** Download → resize to WebP with sharp → upload to Storage → set cover_path + photos row. */
export async function storeCover(
  supabase: ServerSupabase,
  userId: string,
  kind: CoverKind,
  entityId: string,
  candidate: CoverCandidate,
) {
  const res = await wikiFetch(candidate.url);
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 30 * 1024 * 1024) throw new Error("Image too large");
  const input = Buffer.from(await res.arrayBuffer());
  const img = sharp(input, { failOn: "none" }).rotate();
  const full = await img.clone().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const thumb = await img.clone().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  const id = crypto.randomUUID();
  const base = `${userId}/${kind}/${entityId}/${id}`;
  const path = `${base}.webp`;
  const thumbPath = `${base}_thumb.webp`;
  const bucket = supabase.storage.from(BUCKETS.photos);
  const up1 = await bucket.upload(path, full.data, { contentType: "image/webp", upsert: false });
  if (up1.error) throw new Error(up1.error.message);
  const up2 = await bucket.upload(thumbPath, thumb, { contentType: "image/webp", upsert: false });
  if (up2.error) throw new Error(up2.error.message);
  await supabase.from("photos").insert({
    entity_type: kind,
    entity_id: entityId,
    path,
    thumb_path: thumbPath,
    width: full.info.width,
    height: full.info.height,
    source: "wikimedia",
    attribution: candidate.attribution,
    caption: candidate.title,
  });
  await supabase.from(TABLE[kind]).update({ cover_path: path }).eq("id", entityId);
  return { path };
}

export function isAllowedImageUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "upload.wikimedia.org";
  } catch {
    return false;
  }
}
