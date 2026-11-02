import "server-only";
import { cache } from "react";
import { countryFlag, countryName } from "@/lib/countries";
import { loadGraph } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { computeRecap } from "@/lib/recap";
import { buildMemoryView, buildRecapView, buildTripView, isShareValid, parseShareConfig, shareablePhotoIds, type PublicView } from "@/lib/share";
import { loadRecapInput } from "@/lib/server/recap";
import { createAdminClient, isSharingEnabled } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Share } from "@/lib/types";

type Admin = ReturnType<typeof createAdminClient>;

async function loadMemory(admin: Admin, share: Share, config: ReturnType<typeof parseShareConfig>): Promise<PublicView | null> {
  const owner = share.user_id;
  const { data: memory } = await admin.from("memories").select("id, date, title, body, city_id, place_id, trip_country_id").eq("id", share.target_id!).eq("user_id", owner).maybeSingle();
  if (!memory) return null;
  const [{ data: city }, { data: place }, { data: tc }, { data: photos }] = await Promise.all([
    memory.city_id ? admin.from("cities").select("name, lat, lng").eq("id", memory.city_id).eq("user_id", owner).maybeSingle() : Promise.resolve({ data: null }),
    memory.place_id ? admin.from("places").select("name, lat, lng").eq("id", memory.place_id).eq("user_id", owner).maybeSingle() : Promise.resolve({ data: null }),
    memory.trip_country_id ? admin.from("trip_countries").select("country_code").eq("id", memory.trip_country_id).eq("user_id", owner).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("photos").select("id, entity_id, width, height, caption, lat, lng").eq("entity_type", "memory").eq("entity_id", memory.id).eq("user_id", owner).order("order_index"),
  ]);
  const code = tc?.country_code.trim();
  return buildMemoryView({ memory, city, place, country: code ? { code, name: countryName(code) } : null, photos: photos ?? [], config });
}

async function loadTrip(admin: Admin, share: Share, config: ReturnType<typeof parseShareConfig>): Promise<PublicView | null> {
  const owner = share.user_id;
  const { data: trip } = await admin.from("trips").select("id, title, description, start_date, end_date, cover_path").eq("id", share.target_id!).eq("user_id", owner).maybeSingle();
  if (!trip) return null;
  const { data: tcs } = await admin.from("trip_countries").select("id, country_code, arrive_date, depart_date, order_index").eq("trip_id", trip.id).eq("user_id", owner).order("order_index");
  const ids = (tcs ?? []).map((t) => t.id);
  const [{ data: cities }, { data: memories }, { data: days }, { data: cover }] = await Promise.all([
    ids.length ? admin.from("cities").select("id, trip_country_id, name, lat, lng").in("trip_country_id", ids).eq("user_id", owner).order("order_index") : Promise.resolve({ data: [] }),
    admin.from("memories").select("id, date, title, body, trip_country_id, city_id").eq("trip_id", trip.id).eq("user_id", owner).order("date"),
    config.include_itinerary && ids.length ? admin.from("itinerary_days").select("id, trip_country_id, title, day_number, date").in("trip_country_id", ids).eq("user_id", owner).order("day_number") : Promise.resolve({ data: [] }),
    trip.cover_path ? admin.from("photos").select("id, attribution").eq("path", trip.cover_path).eq("user_id", owner).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const memoryIds = (memories ?? []).map((m) => m.id);
  const dayIds = (days ?? []).map((d) => d.id);
  const [{ data: photos }, { data: items }] = await Promise.all([
    memoryIds.length ? admin.from("photos").select("id, entity_id, width, height, caption").eq("entity_type", "memory").in("entity_id", memoryIds).eq("user_id", owner).order("order_index") : Promise.resolve({ data: [] }),
    dayIds.length ? admin.from("itinerary_items").select("day_id, title, start_time, order_index").in("day_id", dayIds).eq("user_id", owner).order("order_index") : Promise.resolve({ data: [] }),
  ]);
  return buildTripView({
    trip,
    countries: (tcs ?? []).map((t) => {
      const code = t.country_code.trim();
      return { id: t.id, code, name: countryName(code), flag: countryFlag(code), arrive_date: t.arrive_date, depart_date: t.depart_date };
    }),
    cities: cities ?? [],
    memories: memories ?? [],
    photos: photos ?? [],
    days: days ?? [],
    items: items ?? [],
    cover: cover ? { id: cover.id, attribution: cover.attribution } : null,
    config,
  });
}

async function loadRecap(admin: Admin, share: Share, config: ReturnType<typeof parseShareConfig>): Promise<PublicView | null> {
  const { data: trips } = await admin.from("trips").select("*").eq("user_id", share.user_id);
  const list = trips ?? [];
  const client = admin as unknown as ServerSupabase;
  const g = await loadGraph(client, list, list.map((t) => t.id), { places: true, expenses: true, memories: true });
  const stats = computeRecap(await loadRecapInput(client, null, g, todayIso()), share.year ?? "all");
  const ids = stats.mosaic.map((p) => p.id);
  const { data: photos } = ids.length ? await admin.from("photos").select("id, entity_id, width, height, caption").in("id", ids).eq("user_id", share.user_id) : { data: [] };
  return buildRecapView(stats, photos ?? [], config);
}

/**
 * The share, if its token is good. Unknown, revoked and expired all do the same single query and give
 * the same null, so a visitor can't tell them apart, by the answer or by its timing.
 */
export const findShare = cache(async (token: string) => {
  if (!isSharingEnabled()) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("shares").select("*").eq("token", token).maybeSingle();
  return data && isShareValid(data) ? data : null;
});

export const loadPublicView = cache(async (share: Share): Promise<PublicView | null> => {
  const admin = createAdminClient();
  const config = parseShareConfig(share.config);
  if (share.kind === "memory") return share.target_id ? loadMemory(admin, share, config) : null;
  if (share.kind === "trip") return share.target_id ? loadTrip(admin, share, config) : null;
  if (share.kind === "recap") return loadRecap(admin, share, config);
  return null;
});

/** A page view. Not atomic, which is fine for a personal view counter. */
export async function countView(share: Share) {
  const admin = createAdminClient();
  await admin.from("shares").update({ view_count: share.view_count + 1, last_viewed_at: new Date().toISOString() }).eq("id", share.id).is("revoked_at", null);
}

/** The storage path of a photo, only if this share may show it. */
export async function shareablePhotoPath(share: Share, view: PublicView, photoId: string, size: "thumb" | "full") {
  if (!shareablePhotoIds(view).has(photoId)) return null;
  const { data } = await createAdminClient().from("photos").select("path, thumb_path, entity_type").eq("id", photoId).eq("user_id", share.user_id).maybeSingle();
  // A receipt can't be reached this way, whatever else goes wrong.
  if (!data || data.entity_type === "expense") return null;
  return size === "thumb" ? (data.thumb_path ?? data.path) : data.path;
}
