"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { memorySchema, type MemoryInput } from "@/lib/validation";
import { cleanupEntityPhotos } from "@/lib/storage";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

export async function createMemory(input: MemoryInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const data = memorySchema.parse(input);
    const row = must(await supabase.from("memories").insert(data).select("id").single());
    refreshAll();
    return ok({ id: row.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateMemory(id: string, input: MemoryInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = memorySchema.parse(input);
    must(await supabase.from("memories").update(data).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
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
