"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { transportMode, tripCountrySchema, type TripCountryInput } from "@/lib/validation";
import { getCountry } from "@/lib/countries";
import { collectCountryTree } from "@/lib/entities";
import { cleanupEntityPhotos } from "@/lib/storage";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

/** Bulk-add countries to a trip in route order. Already-added codes are skipped. */
export async function addCountries(tripId: string, codes: string[]): Promise<ActionResult<{ ids: string[] }>> {
  try {
    const { supabase } = await requireUser();
    const tid = z.uuid().parse(tripId);
    const list = z.array(z.string().length(2)).min(1, "Pick at least one country").max(250).parse(codes);
    const valid = list.map((c) => c.toUpperCase()).filter((c) => getCountry(c));
    const existing = must(await supabase.from("trip_countries").select("country_code, order_index").eq("trip_id", tid));
    const have = new Set(existing.map((e) => e.country_code.trim()));
    let next = existing.reduce((m, e) => Math.max(m, e.order_index), -1) + 1;
    const rows = valid.filter((c) => !have.has(c)).map((c) => ({ trip_id: tid, country_code: c, order_index: next++ }));
    if (!rows.length) return ok({ ids: [] });
    const inserted = must(await supabase.from("trip_countries").insert(rows).select("id"));
    refreshAll();
    return ok({ ids: inserted.map((r) => r.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function updateTripCountry(id: string, input: TripCountryInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = tripCountrySchema.parse(input);
    must(await supabase.from("trip_countries").update(data).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function setCountryStatus(id: string, status: "wishlist" | "planned" | "visited"): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("trip_countries").update({ status: z.enum(["wishlist", "planned", "visited"]).parse(status) }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function saveCountryNotes(id: string, notes: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("trip_countries").update({ notes: z.string().max(50000).parse(notes) || null }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function reorderCountries(ids: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const list = z.array(z.uuid()).parse(ids);
    await Promise.all(list.map((id, i) => supabase.from("trip_countries").update({ order_index: i }).eq("id", id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/**
 * The whole route in a new order, from "Reorder route". One statement, so it lands completely or not at all,
 * and only `order_index` changes: the other columns in the row are there because an upsert needs them.
 */
export async function applyRouteOrder(tripId: string, ids: string[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const tid = z.uuid().parse(tripId);
    const list = z.array(z.uuid()).min(1).max(500).parse(ids);
    const rows = must(await supabase.from("trip_countries").select("id, trip_id, country_code").eq("trip_id", tid));
    const given = new Set(list);
    // Every stop exactly once: a stale tab can't drop a country or pull in another trip's.
    if (given.size !== list.length || rows.length !== list.length || rows.some((r) => !given.has(r.id))) throw new Error("The route changed in the meantime. Close this and try again.");
    const byId = new Map(rows.map((r) => [r.id, r]));
    must(await supabase.from("trip_countries").upsert(list.map((id, order_index) => ({ ...byId.get(id)!, order_index })), { onConflict: "id" }));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTripCountry(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const cid = z.uuid().parse(id);
    const tree = await collectCountryTree(supabase, [cid]);
    await cleanupEntityPhotos(supabase, [cid, ...tree.cityIds, ...tree.placeIds]);
    must(await supabase.from("trip_countries").delete().eq("id", cid));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Quick inline edit from the route list: how do I get to this country? */
export async function setCountryTransport(id: string, mode: string | null, note?: string | null): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const patch: { transport_mode: string | null; transport_note?: string | null } = { transport_mode: transportMode.parse(mode) };
    if (note !== undefined) patch.transport_note = z.string().trim().max(160).nullable().parse(note) || null;
    must(await supabase.from("trip_countries").update(patch).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
