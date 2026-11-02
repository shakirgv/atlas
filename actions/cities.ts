"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { citySchema, newCitySchema, transportMode, type CityInput } from "@/lib/validation";
import { collectCityPlaces } from "@/lib/entities";
import { cleanupEntityPhotos } from "@/lib/storage";
import { tzForCoords } from "@/lib/server/tz-lookup";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

export async function addCities(
  tripCountryId: string,
  cities: z.input<typeof newCitySchema>[],
): Promise<ActionResult<{ ids: string[] }>> {
  try {
    const { supabase } = await requireUser();
    const tcid = z.uuid().parse(tripCountryId);
    const list = z.array(newCitySchema).min(1, "Pick at least one city").max(50).parse(cities);
    const existing = must(await supabase.from("cities").select("name, order_index").eq("trip_country_id", tcid));
    const have = new Set(existing.map((c) => c.name.toLowerCase()));
    let next = existing.reduce((m, c) => Math.max(m, c.order_index), -1) + 1;
    const rows = list
      .filter((c) => !have.has(c.name.toLowerCase()))
      .map((c) => ({ trip_country_id: tcid, name: c.name, lat: c.lat, lng: c.lng, timezone: tzForCoords(c.lat, c.lng), order_index: next++ }));
    if (!rows.length) return ok({ ids: [] });
    const inserted = must(await supabase.from("cities").insert(rows).select("id"));
    refreshAll();
    return ok({ ids: inserted.map((r) => r.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function updateCity(id: string, input: CityInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = citySchema.parse(input);
    const cid = z.uuid().parse(id);
    // Coordinates changed and no zone typed in → look it up again.
    if (!data.timezone && data.lat != null && data.lng != null) data.timezone = tzForCoords(data.lat, data.lng);
    must(await supabase.from("cities").update(data).eq("id", cid));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function saveCityNotes(id: string, notes: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("cities").update({ notes: z.string().max(50000).parse(notes) || null }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function reorderCities(ids: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const list = z.array(z.uuid()).parse(ids);
    await Promise.all(list.map((id, i) => supabase.from("cities").update({ order_index: i }).eq("id", id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteCity(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const cid = z.uuid().parse(id);
    const placeIds = await collectCityPlaces(supabase, [cid]);
    await cleanupEntityPhotos(supabase, [cid, ...placeIds]);
    must(await supabase.from("cities").delete().eq("id", cid));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Quick inline edit from the route list: how do I get to this city? */
export async function setCityTransport(id: string, mode: string | null, note?: string | null): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const patch: { transport_mode: string | null; transport_note?: string | null } = { transport_mode: transportMode.parse(mode) };
    if (note !== undefined) patch.transport_note = z.string().trim().max(160).nullable().parse(note) || null;
    must(await supabase.from("cities").update(patch).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
