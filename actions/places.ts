"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { placeSchema, type PlaceInput } from "@/lib/validation";
import { mergedPlacePatch } from "@/lib/place-duplicates";
import { cleanupEntityPhotos } from "@/lib/storage";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult, PlaceStatus } from "@/lib/types";
import { PLACE_STATUSES } from "@/lib/types";

export async function createPlace(input: PlaceInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const data = placeSchema.parse(input);
    const row = must(await supabase.from("places").insert(data).select("id").single());
    refreshAll();
    return ok({ id: row.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updatePlace(id: string, input: PlaceInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = placeSchema.parse(input);
    must(await supabase.from("places").update(data).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function setPlaceStatus(id: string, status: PlaceStatus): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("places").update({ status: z.enum(PLACE_STATUSES).parse(status) }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function setPlaceRating(id: string, rating: number | null): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const r = z.number().int().min(1).max(5).nullable().parse(rating);
    must(await supabase.from("places").update({ rating: r }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/**
 * Folds duplicates into the place being kept. Links move before anything is deleted, so a failure part way
 * leaves every stop, memory and photo attached to a place, and running the merge again finishes it.
 * The photos move along with their files, so `deletePlace`'s cleanup must not run here.
 */
export async function mergePlaces(keepId: string, duplicateIds: string[]): Promise<ActionResult<{ stops: number; memories: number; photos: number }>> {
  try {
    const { supabase } = await requireUser();
    const keep = z.uuid().parse(keepId);
    const ids = Array.from(new Set(z.array(z.uuid()).min(1, "Pick a place to merge").max(50).parse(duplicateIds)));
    if (ids.includes(keep)) throw new Error("A place can't be merged into itself.");
    const rows = must(await supabase.from("places").select("*").in("id", [keep, ...ids]));
    const kept = rows.find((p) => p.id === keep);
    const duplicates = rows.filter((p) => p.id !== keep);
    if (!kept || duplicates.length !== ids.length) throw new Error("One of these places no longer exists. Refresh and try again.");
    if (duplicates.some((p) => p.city_id !== kept.city_id)) throw new Error("Only places in the same city can be merged.");

    const stops = must(await supabase.from("itinerary_items").update({ place_id: keep }).in("place_id", ids).select("id"));
    const memories = must(await supabase.from("memories").update({ place_id: keep }).in("place_id", ids).select("id"));
    const existing = must(await supabase.from("photos").select("order_index").eq("entity_type", "place").eq("entity_id", keep).order("order_index", { ascending: false }).limit(1));
    const photos = must(await supabase.from("photos").select("id").eq("entity_type", "place").in("entity_id", ids).order("order_index"));
    const next = (existing[0]?.order_index ?? -1) + 1;
    for (const [i, p] of photos.entries()) must(await supabase.from("photos").update({ entity_id: keep, order_index: next + i }).eq("id", p.id));

    must(await supabase.from("places").update(mergedPlacePatch(kept, duplicates)).eq("id", keep));
    must(await supabase.from("places").delete().in("id", ids));
    refreshAll();
    return ok({ stops: stops.length, memories: memories.length, photos: photos.length });
  } catch (e) {
    return fail(e);
  }
}

export async function deletePlace(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const pid = z.uuid().parse(id);
    await cleanupEntityPhotos(supabase, [pid]);
    must(await supabase.from("places").delete().eq("id", pid));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
