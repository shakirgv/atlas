import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { cleanupEntityPhotos } from "@/lib/storage";

/** Every entity id under the given trips (for photo cleanup before cascade deletes). */
export async function collectTripTree(supabase: ServerSupabase, tripIds: string[]) {
  if (!tripIds.length) return { countryIds: [], cityIds: [], placeIds: [], memoryIds: [], expenseIds: [] };
  const { data: tcs } = await supabase.from("trip_countries").select("id").in("trip_id", tripIds);
  const countryIds = (tcs ?? []).map((r) => r.id);
  const tree = await collectCountryTree(supabase, countryIds);
  const [{ data: mems }, { data: expenses }] = await Promise.all([supabase.from("memories").select("id").in("trip_id", tripIds), supabase.from("expenses").select("id").in("trip_id", tripIds)]);
  return { countryIds, ...tree, memoryIds: (mems ?? []).map((m) => m.id), expenseIds: (expenses ?? []).map((e) => e.id) };
}

export async function collectCountryTree(supabase: ServerSupabase, countryIds: string[]) {
  if (!countryIds.length) return { cityIds: [] as string[], placeIds: [] as string[] };
  const { data: cities } = await supabase.from("cities").select("id").in("trip_country_id", countryIds);
  const cityIds = (cities ?? []).map((c) => c.id);
  const placeIds = await collectCityPlaces(supabase, cityIds);
  return { cityIds, placeIds };
}

export async function collectCityPlaces(supabase: ServerSupabase, cityIds: string[]) {
  if (!cityIds.length) return [] as string[];
  const { data: places } = await supabase.from("places").select("id").in("city_id", cityIds);
  return (places ?? []).map((p) => p.id);
}

/** Remove photo rows + storage files for trips and everything below them. */
export async function cleanupTrips(supabase: ServerSupabase, tripIds: string[]) {
  const t = await collectTripTree(supabase, tripIds);
  await cleanupEntityPhotos(supabase, [...tripIds, ...t.countryIds, ...t.cityIds, ...t.placeIds, ...t.memoryIds, ...t.expenseIds]);
}
