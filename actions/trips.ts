"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { tripSchema, type TripInput } from "@/lib/validation";
import { cleanupTrips } from "@/lib/entities";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import { cookies } from "next/headers";
import { ACTIVE_TRIP_COOKIE } from "@/lib/config";
import type { ActionResult } from "@/lib/types";

export async function createTrip(input: TripInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const data = tripSchema.parse(input);
    const row = must(await supabase.from("trips").insert(data).select("id").single());
    // Focus the new trip everywhere.
    (await cookies()).set(ACTIVE_TRIP_COOKIE, row.id, { path: "/", maxAge: 31536000, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
    refreshAll();
    return ok({ id: row.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateTrip(id: string, input: TripInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = tripSchema.parse(input);
    must(await supabase.from("trips").update(data).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTrip(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const tripId = z.uuid().parse(id);
    await cleanupTrips(supabase, [tripId]);
    must(await supabase.from("trips").delete().eq("id", tripId));
    const store = await cookies();
    if (store.get(ACTIVE_TRIP_COOKIE)?.value === tripId) store.delete(ACTIVE_TRIP_COOKIE);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
