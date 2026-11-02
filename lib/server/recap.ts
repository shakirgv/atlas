import "server-only";
import type { Graph } from "@/lib/data";
import { onThisDay, recapYears, type RecapInput, type RecapPhoto } from "@/lib/recap";
import type { Scope } from "@/lib/scope";
import { routesForTrips } from "@/lib/server/route-data";
import { signPhotoPaths, withPhotoUrls } from "@/lib/storage";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Photo } from "@/lib/types";

/** Everything a recap reads. `g` must hold every trip, with places, expenses and memories. */
export async function loadRecapInput(supabase: ServerSupabase, scope: Scope, g: Graph, today: string): Promise<RecapInput> {
  const { stops } = routesForTrips(g.trips.map((t) => t.id), g.countries, g.cities, scope.settings);
  // Downloaded Wikimedia covers aren't my photos, so they never count here.
  const { data } = await supabase.from("photos").select("*").eq("source", "upload").in("entity_type", ["trip", "country", "city", "place"]);
  const inScope = new Set([...g.trips.map((t) => t.id), ...g.countries.map((c) => c.id), ...g.cities.map((c) => c.id), ...g.places.map((p) => p.id)]);
  const covers = new Set([...g.cities.map((c) => c.cover_path), ...g.places.map((p) => p.cover_path)]);
  const own = await withPhotoUrls(supabase, ((data ?? []) as Photo[]).filter((p) => inScope.has(p.entity_id)));

  const photos: RecapPhoto[] = [
    ...g.memories.flatMap((m) =>
      m.photos.filter((p) => p.source === "upload").map((p): RecapPhoto => ({ id: p.id, url: p.url, thumbUrl: p.thumb_url, date: p.taken_at?.slice(0, 10) ?? m.date, caption: p.caption, linked: "memory" })),
    ),
    ...own.map((p): RecapPhoto => ({ id: p.id, url: p.url, thumbUrl: p.thumb_url, date: (p.taken_at ?? p.created_at).slice(0, 10), caption: p.caption, linked: covers.has(p.path) ? "cover" : "other" })),
  ];

  return {
    today,
    stays: g.countries.map((c) => ({ id: c.id, code: c.code, name: c.name, flag: c.flag, status: c.status, arrive: c.arrive_date, depart: c.depart_date })),
    stops: stops.map((s) => ({ key: s.key, kind: s.kind, id: s.id, tripCountryId: s.tripCountryId, name: s.name, lat: s.lat, lng: s.lng, arrive: s.arrive, mode: s.transport })),
    places: g.places.map((p) => ({ id: p.id, name: p.name, cityId: p.city_id, status: p.status, rating: p.rating })),
    expenses: g.expenses.map((e) => ({ date: e.date, kind: e.kind, category: e.category, amount_base: e.amount_base })),
    memories: g.memories.map((m) => ({ id: m.id, date: m.date, title: m.title, body: m.body })),
    photos,
  };
}

/** Just the dates, for the dashboard's recap link, without loading a whole recap. */
export async function loadRecapYears(supabase: ServerSupabase, today: string) {
  const [{ data: stays }, { data: expenses }, { data: memories }, { data: photos }] = await Promise.all([
    supabase.from("trip_countries").select("id, status, arrive_date, depart_date, country_code"),
    supabase.from("expenses").select("date, kind, category, amount_base"),
    supabase.from("memories").select("id, date"),
    supabase.from("photos").select("id, taken_at").eq("source", "upload").neq("entity_type", "expense").not("taken_at", "is", null),
  ]);
  return recapYears({
    today,
    stays: (stays ?? []).map((s) => ({ id: s.id, code: s.country_code, name: "", flag: "", status: s.status, arrive: s.arrive_date, depart: s.depart_date })),
    stops: [],
    places: [],
    expenses: expenses ?? [],
    memories: (memories ?? []).map((m) => ({ ...m, title: null, body: null })),
    photos: (photos ?? []).map((p) => ({ id: p.id, url: null, thumbUrl: null, date: p.taken_at?.slice(0, 10) ?? null, caption: null, linked: "other" as const })),
  });
}

/** Past years across every trip, not only the active one: last year's Rome is a different trip. */
export async function loadOnThisDay(supabase: ServerSupabase, today: string) {
  const [{ data: memories }, { data: photos }, { data: cities }, { data: places }] = await Promise.all([
    supabase.from("memories").select("id, date, title, body, city_id, place_id"),
    supabase.from("photos").select("id, entity_type, entity_id, taken_at, caption, path, thumb_path, order_index").eq("source", "upload").neq("entity_type", "expense").order("order_index"),
    supabase.from("cities").select("id, name"),
    supabase.from("places").select("id, name, city_id"),
  ]);
  const cityName = new Map((cities ?? []).map((c) => [c.id, c.name]));
  const placeRow = new Map((places ?? []).map((p) => [p.id, p]));
  const list = photos ?? [];
  const firstPhoto = new Map<string, (typeof list)[number]>();
  for (const p of list) if (p.entity_type === "memory" && !firstPhoto.has(p.entity_id)) firstPhoto.set(p.entity_id, p);
  const placeOf = (entityType: string, entityId: string) => {
    if (entityType === "city") return cityName.get(entityId) ?? null;
    if (entityType === "place") {
      const place = placeRow.get(entityId);
      return place ? (cityName.get(place.city_id) ?? place.name) : null;
    }
    const memory = entityType === "memory" ? (memories ?? []).find((m) => m.id === entityId) : null;
    return memory?.city_id ? (cityName.get(memory.city_id) ?? null) : null;
  };

  // Match first and sign afterwards, so only what is shown gets a link.
  const matched = onThisDay(
    (memories ?? []).map((m) => ({ id: m.id, date: m.date, title: m.title, body: m.body, place: m.city_id ? (cityName.get(m.city_id) ?? null) : null, thumbUrl: firstPhoto.get(m.id)?.thumb_path ?? firstPhoto.get(m.id)?.path ?? null })),
    list.flatMap((p) => (p.taken_at ? [{ id: p.id, date: p.taken_at.slice(0, 10), caption: p.caption, place: placeOf(p.entity_type, p.entity_id), thumbUrl: p.thumb_path ?? p.path, url: p.path, memoryId: p.entity_type === "memory" ? p.entity_id : null }] : [])),
    today,
  );
  const urls = await signPhotoPaths(supabase, matched.flatMap((i) => [i.thumbUrl, i.kind === "photo" ? i.url : null]));
  return matched.map((i) => ({ ...i, thumbUrl: i.thumbUrl ? (urls[i.thumbUrl] ?? null) : null, ...(i.kind === "photo" ? { url: i.url ? (urls[i.url] ?? null) : null } : {}) }));
}
