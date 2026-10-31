"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

const itemSchema = z.object({ label: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(40) });

export async function addPackingItems(tripId: string, items: z.input<typeof itemSchema>[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const tid = z.uuid().parse(tripId);
    const list = z.array(itemSchema).min(1).max(300).parse(items);
    const existing = must(await supabase.from("packing_items").select("label, order_index").eq("trip_id", tid));
    const have = new Set(existing.map((e) => e.label.toLowerCase()));
    let next = existing.reduce((m, e) => Math.max(m, e.order_index), -1) + 1;
    const rows = list.filter((i) => !have.has(i.label.toLowerCase())).map((i) => ({ ...i, trip_id: tid, order_index: next++ }));
    if (rows.length) must(await supabase.from("packing_items").insert(rows));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function togglePacked(id: string, packed: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("packing_items").update({ packed: z.boolean().parse(packed) }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deletePackingItem(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("packing_items").delete().eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function resetPacking(tripId: string, mode: "unpack" | "clear"): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const tid = z.uuid().parse(tripId);
    if (mode === "unpack") must(await supabase.from("packing_items").update({ packed: false }).eq("trip_id", tid));
    else must(await supabase.from("packing_items").delete().eq("trip_id", tid));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function saveAsTemplate(tripId: string, name: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const tid = z.uuid().parse(tripId);
    const n = z.string().trim().min(1, "Name your template").max(80).parse(name);
    const items = must(await supabase.from("packing_items").select("label, category").eq("trip_id", tid).order("order_index"));
    if (!items.length) throw new Error("Add some items first.");
    must(await supabase.from("packing_templates").insert({ name: n, items }));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("packing_templates").delete().eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
