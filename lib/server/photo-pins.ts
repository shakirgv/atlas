import "server-only";
import type { Graph } from "@/lib/data";
import { buildPins } from "@/lib/photo-pins";
import { withPhotoUrls } from "@/lib/storage";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Photo } from "@/lib/types";

/**
 * Photo pins for everything in scope: memory photos plus my own uploads on places, cities,
 * countries and trips. Downloaded Wikimedia covers and receipts aren't my travel photos, so they stay out.
 */
export async function loadPhotoPins(supabase: ServerSupabase, g: Graph) {
  const inScope = new Set([...g.trips.map((t) => t.id), ...g.countries.map((c) => c.id), ...g.cities.map((c) => c.id), ...g.places.map((p) => p.id)]);
  const { data } = await supabase.from("photos").select("*").eq("source", "upload").in("entity_type", ["trip", "country", "city", "place"]);
  const own = await withPhotoUrls(supabase, ((data ?? []) as Photo[]).filter((p) => inScope.has(p.entity_id)));
  const memoryPhotos = g.memories.flatMap((m) => m.photos).filter((p) => p.source === "upload");
  return buildPins([...memoryPhotos, ...own], { memories: g.memories, places: g.places, cities: g.cities, countries: g.countries.map((c) => ({ id: c.id, trip_id: c.trip_id })) });
}
