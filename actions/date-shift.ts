"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { countryFlag, countryName } from "@/lib/countries";
import { MAX_SHIFT_DAYS, planDateShift, SHIFT_MODES, shiftChanges, type ShiftData, type ShiftInput } from "@/lib/date-shift";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { fail, isMissingSchema, MIGRATION_005, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

const inputSchema = z.object({
  mode: z.enum(SHIFT_MODES),
  countryId: z.uuid(),
  cityId: z.uuid().nullable(),
  days: z.number().int().min(-MAX_SHIFT_DAYS).max(MAX_SHIFT_DAYS),
  moveBookingIds: z.array(z.uuid()).max(500),
});

export type LastShift = { id: string; label: string; created_at: string };

async function readShiftData(supabase: ServerSupabase, tripId: string): Promise<ShiftData> {
  const trip = must(await supabase.from("trips").select("id, title, start_date, end_date").eq("id", tripId).single());
  const tcs = must(await supabase.from("trip_countries").select("id, country_code, order_index, status, arrive_date, depart_date").eq("trip_id", tripId).order("order_index"));
  const ids = tcs.map((c) => c.id);
  const [cities, days, bookings] = await Promise.all([
    ids.length ? supabase.from("cities").select("id, trip_country_id, name, order_index, arrive_date, depart_date").in("trip_country_id", ids).order("order_index").then(must) : [],
    ids.length ? supabase.from("itinerary_days").select("id, trip_country_id, city_id, day_number, date, title").in("trip_country_id", ids).order("day_number").then(must) : [],
    supabase.from("bookings").select("id, type, title, status, trip_country_id, city_id, start_at, end_at").eq("trip_id", tripId).order("start_at").then((r) => r.data ?? []),
  ]);
  const dayIds = days.map((d) => d.id);
  const items = dayIds.length ? must(await supabase.from("itinerary_items").select("day_id").in("day_id", dayIds)) : [];
  const stops = new Map<string, number>();
  for (const i of items) stops.set(i.day_id, (stops.get(i.day_id) ?? 0) + 1);
  return {
    trip,
    countries: tcs.map((c) => {
      const code = c.country_code.trim();
      return { id: c.id, name: countryName(code), flag: countryFlag(code), order_index: c.order_index, status: c.status, arrive_date: c.arrive_date, depart_date: c.depart_date };
    }),
    cities,
    days: days.map((d) => ({ ...d, stops: stops.get(d.id) ?? 0 })),
    bookings,
  };
}

/** The newest change that can still be undone. Null too when the SQL file hasn't been run. */
async function readLastShift(supabase: ServerSupabase, tripId: string): Promise<LastShift | null> {
  const { data } = await supabase.from("date_shifts").select("id, label, created_at").eq("trip_id", tripId).is("undone_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

/** Everything the dialog needs. It plans on the browser so the preview follows every change at once. */
export async function loadShiftData(tripId: string): Promise<ActionResult<{ data: ShiftData; last: LastShift | null }>> {
  try {
    const { supabase } = await requireUser();
    const tid = z.uuid().parse(tripId);
    const [data, last] = await Promise.all([readShiftData(supabase, tid), readLastShift(supabase, tid)]);
    return ok({ data, last });
  } catch (e) {
    return fail(e);
  }
}

/** Plans again on fresh rows, so a stale browser can't write old dates. All or nothing, in one database function. */
export async function applyDateShift(tripId: string, input: ShiftInput): Promise<ActionResult<{ id: string; label: string; newDays: number; countryId: string }>> {
  try {
    const { supabase } = await requireUser();
    const tid = z.uuid().parse(tripId);
    const parsed = inputSchema.parse(input);
    const plan = planDateShift(await readShiftData(supabase, tid), parsed);
    if (plan.error) throw new Error(plan.error);
    if (!plan.countries.length) throw new Error("Nothing to change.");
    const { data, error } = await supabase.rpc("atlas_apply_date_shift", { p_trip_id: tid, p_days: parsed.days, p_label: plan.label, p_changes: shiftChanges(plan, tid) as unknown as Json });
    if (isMissingSchema(error)) throw new Error(MIGRATION_005);
    if (error) throw new Error(error.message);
    refreshAll();
    return ok({ id: data as string, label: plan.label, newDays: plan.newDays, countryId: parsed.countryId });
  } catch (e) {
    return fail(e);
  }
}

export async function undoDateShift(id: string): Promise<ActionResult<{ restored: number; total: number }>> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("atlas_undo_date_shift", { p_id: z.uuid().parse(id) });
    if (isMissingSchema(error)) throw new Error(MIGRATION_005);
    if (error) throw new Error(error.message);
    refreshAll();
    return ok(data as { restored: number; total: number });
  } catch (e) {
    return fail(e);
  }
}
