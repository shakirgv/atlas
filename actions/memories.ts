"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { memorySchema, type MemoryInput } from "@/lib/validation";
import { cleanupEntityPhotos } from "@/lib/storage";
import { fail, isMissingSchema, MIGRATION_007, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";
import type { MemoryLinkOptions } from "@/lib/memory-links";

type MemoryRow = z.output<typeof memorySchema>;
type Client = Awaited<ReturnType<typeof requireUser>>["supabase"];

/**
 * Insert or update one memory. Before migration 007 there is no itinerary_day_id column:
 * the write goes through without it, unless a day was actually picked.
 */
async function writeMemory(supabase: Client, data: MemoryRow, id?: string): Promise<string> {
  const run = (row: Partial<MemoryRow>) =>
    id ? supabase.from("memories").update(row).eq("id", id).select("id").single() : supabase.from("memories").insert(row as MemoryRow).select("id").single();
  const first = await run(data);
  if (!first.error) return first.data.id;
  if (!isMissingSchema(first.error)) throw new Error(first.error.message);
  if (data.itinerary_day_id) throw new Error(MIGRATION_007);
  const { itinerary_day_id: _day, ...rest } = data;
  return must(await run(rest)).id;
}

export async function createMemory(input: MemoryInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const id = await writeMemory(supabase, memorySchema.parse(input));
    refreshAll();
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateMemory(id: string, input: MemoryInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    await writeMemory(supabase, memorySchema.parse(input), z.uuid().parse(id));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** The places and itinerary days of one trip, for the memory form's optional links. */
export async function memoryLinkOptions(tripId: string): Promise<ActionResult<MemoryLinkOptions>> {
  try {
    const { supabase } = await requireUser();
    const tcs = must(await supabase.from("trip_countries").select("id").eq("trip_id", z.uuid().parse(tripId)));
    const countryIds = tcs.map((t) => t.id);
    if (!countryIds.length) return ok({ places: [], days: [] });
    const [cities, days] = await Promise.all([
      supabase.from("cities").select("id").in("trip_country_id", countryIds),
      supabase.from("itinerary_days").select("id, trip_country_id, day_number, date, city_id, title").in("trip_country_id", countryIds).order("day_number"),
    ]);
    const cityIds = must(cities).map((c) => c.id);
    const places = cityIds.length ? must(await supabase.from("places").select("id, name, city_id, lat, lng").in("city_id", cityIds).order("name")) : [];
    return ok({ places, days: must(days) });
  } catch (e) {
    return fail(e);
  }
}

export async function linkMemory(id: string, link: { city_id?: string | null; place_id?: string | null; trip_country_id?: string | null }): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = z.object({ city_id: z.uuid().nullish(), place_id: z.uuid().nullish(), trip_country_id: z.uuid().nullish() }).parse(link);
    must(await supabase.from("memories").update(data).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMemory(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const mid = z.uuid().parse(id);
    await cleanupEntityPhotos(supabase, [mid]);
    must(await supabase.from("memories").delete().eq("id", mid));
    must(await supabase.from("shares").delete().eq("target_id", mid));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
