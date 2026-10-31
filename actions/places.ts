"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { placeSchema, type PlaceInput } from "@/lib/validation";
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
