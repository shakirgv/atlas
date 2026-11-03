"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { ServerSupabase } from "@/lib/supabase/server";
import { daySchema, stopSchema, type StopInput } from "@/lib/validation";
import { datesInRange, shiftIso } from "@/lib/dates";
import { planMissingDays } from "@/lib/itinerary-days";
import { fail, must, mustMaybe, ok, refreshAll } from "@/actions/_util";
import type { ActionResult, City, ItineraryDay, PlaceCategory, StopType } from "@/lib/types";

function cityForDate(cities: City[], date: string | null): string | null {
  if (!cities.length) return null;
  if (date) {
    const hit = cities.find((c) => c.arrive_date && c.depart_date && c.arrive_date <= date && date <= c.depart_date);
    if (hit) return hit.id;
  }
  return cities.length === 1 ? cities[0]!.id : null;
}

/** Assign final day numbers without tripping the (trip_country_id, day_number) unique constraint. */
async function renumber(supabase: ServerSupabase, days: { id: string; day_number: number; date?: string | null }[]) {
  await Promise.all(days.map((d, i) => supabase.from("itinerary_days").update({ day_number: -1000 - i }).eq("id", d.id)));
  for (const d of days) {
    const patch: { day_number: number; date?: string | null } = { day_number: d.day_number };
    if (d.date !== undefined) patch.date = d.date;
    must(await supabase.from("itinerary_days").update(patch).eq("id", d.id));
  }
}

/**
 * Create the days a stay is missing (or `blankCount` blank days without dates).
 * Days that already exist keep their date, title, notes and stops, and none is ever deleted. See `planMissingDays`.
 */
export async function generateDays(tripCountryId: string, blankCount?: number): Promise<ActionResult<{ created: number }>> {
  try {
    const { supabase } = await requireUser();
    const tcid = z.uuid().parse(tripCountryId);
    const tc = must(await supabase.from("trip_countries").select("*").eq("id", tcid).single());
    const cities = must(await supabase.from("cities").select("*").eq("trip_country_id", tcid).order("order_index"));
    const days = must(await supabase.from("itinerary_days").select("*").eq("trip_country_id", tcid).order("day_number"));
    const dayIds = days.map((d) => d.id);
    const items = dayIds.length ? must(await supabase.from("itinerary_items").select("day_id").in("day_id", dayIds)) : [];
    const withItems = new Set(items.map((i) => i.day_id));
    const hasContent = (d: ItineraryDay) => Boolean(d.title || d.notes || withItems.has(d.id));

    if (!tc.arrive_date || !tc.depart_date) {
      const n = z.number().int().min(1).max(60).parse(blankCount ?? 3);
      const start = days.reduce((m, d) => Math.max(m, d.day_number), 0) + 1;
      const rows = Array.from({ length: n }, (_, i) => ({
        trip_country_id: tcid,
        day_number: start + i,
        date: null,
        city_id: cities.length === 1 ? cities[0]!.id : null,
      }));
      must(await supabase.from("itinerary_days").insert(rows));
      refreshAll();
      return ok({ created: n });
    }

    const dates = datesInRange(tc.arrive_date, tc.depart_date);
    if (dates.length > 120) throw new Error("That date range is too long (max 120 days).");
    const plan = planMissingDays(dates, days, hasContent);
    if (plan.renumber.length) await renumber(supabase, plan.renumber);
    if (plan.insert.length) {
      must(
        await supabase.from("itinerary_days").insert(
          plan.insert.map((r) => ({ trip_country_id: tcid, day_number: r.day_number, date: r.date, city_id: cityForDate(cities, r.date) })),
        ),
      );
    }
    // A city added since the days were generated reaches the empty ones. A day with a plan keeps what it has.
    const dated = new Map(plan.renumber.map((r) => [r.id, r.date]));
    for (const d of days) {
      const date = dated.get(d.id) ?? d.date;
      if (d.city_id || !date || hasContent(d)) continue;
      const cid = cityForDate(cities, date);
      if (cid) must(await supabase.from("itinerary_days").update({ city_id: cid }).eq("id", d.id));
    }
    refreshAll();
    return ok({ created: plan.created });
  } catch (e) {
    return fail(e);
  }
}

export async function updateDay(id: string, input: z.input<typeof daySchema>): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = daySchema.partial().parse(input);
    must(await supabase.from("itinerary_days").update(data).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function addStop(dayId: string, input: StopInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const did = z.uuid().parse(dayId);
    const data = stopSchema.parse(input);
    const last = must(await supabase.from("itinerary_items").select("order_index").eq("day_id", did).order("order_index", { ascending: false }).limit(1));
    const row = must(
      await supabase
        .from("itinerary_items")
        .insert({ ...data, day_id: did, order_index: (last[0]?.order_index ?? -1) + 1 })
        .select("id")
        .single(),
    );
    refreshAll();
    return ok({ id: row.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateStop(id: string, input: Partial<StopInput>): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = stopSchema.partial().parse(input);
    must(await supabase.from("itinerary_items").update(data).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function toggleStop(id: string, done: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("itinerary_items").update({ done: z.boolean().parse(done) }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteStop(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("itinerary_items").delete().eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Persist drag-and-drop: new day + order for each moved stop. */
export async function reorderStops(updates: { id: string; day_id: string; order_index: number }[]): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const list = z.array(z.object({ id: z.uuid(), day_id: z.uuid(), order_index: z.number().int().min(0) })).max(500).parse(updates);
    await Promise.all(list.map((u) => supabase.from("itinerary_items").update({ day_id: u.day_id, order_index: u.order_index }).eq("id", u.id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function duplicateDay(dayId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const did = z.uuid().parse(dayId);
    const day = must(await supabase.from("itinerary_days").select("*").eq("id", did).single());
    const siblings = must(await supabase.from("itinerary_days").select("day_number, date").eq("trip_country_id", day.trip_country_id));
    const maxNumber = siblings.reduce((m, d) => Math.max(m, d.day_number), 0);
    const lastDate = siblings.map((s) => s.date).filter(Boolean).sort().pop() ?? null;
    const copy = must(
      await supabase
        .from("itinerary_days")
        .insert({
          trip_country_id: day.trip_country_id,
          day_number: maxNumber + 1,
          date: lastDate ? shiftIso(lastDate, 1) : null,
          city_id: day.city_id,
          title: day.title ? `${day.title} (copy)` : null,
          notes: day.notes,
        })
        .select("id")
        .single(),
    );
    const items = must(await supabase.from("itinerary_items").select("*").eq("day_id", did).order("order_index"));
    if (items.length) {
      must(
        await supabase.from("itinerary_items").insert(
          items.map((it) => ({
            day_id: copy.id,
            place_id: it.place_id,
            title: it.title,
            type: it.type,
            start_time: it.start_time,
            end_time: it.end_time,
            notes: it.notes,
            done: false,
            order_index: it.order_index,
          })),
        ),
      );
    }
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Move a day to another position: the two days swap their number and date. */
export async function moveDay(dayId: string, targetNumber: number): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const did = z.uuid().parse(dayId);
    const target = z.number().int().min(1).parse(targetNumber);
    const day = must(await supabase.from("itinerary_days").select("*").eq("id", did).single());
    if (day.day_number === target) return ok();
    const other = mustMaybe(
      await supabase.from("itinerary_days").select("*").eq("trip_country_id", day.trip_country_id).eq("day_number", target).maybeSingle(),
    );
    if (!other) {
      must(await supabase.from("itinerary_days").update({ day_number: target }).eq("id", did));
    } else {
      await renumber(supabase, [
        { id: day.id, day_number: other.day_number, date: other.date },
        { id: other.id, day_number: day.day_number, date: day.date },
      ]);
    }
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDay(dayId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const did = z.uuid().parse(dayId);
    const day = must(await supabase.from("itinerary_days").select("trip_country_id").eq("id", did).single());
    must(await supabase.from("itinerary_days").delete().eq("id", did));
    const rest = must(await supabase.from("itinerary_days").select("id, day_number").eq("trip_country_id", day.trip_country_id).order("day_number"));
    if (rest.some((d, i) => d.day_number !== i + 1)) await renumber(supabase, rest.map((d, i) => ({ id: d.id, day_number: i + 1 })));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

const STOP_TO_CATEGORY: Record<StopType, PlaceCategory> = {
  activity: "sight",
  food: "food",
  transport: "transport",
  stay: "stay",
  free: "other",
};

/** One click: turn a stop into a Place in the day's city and link it. */
export async function createPlaceFromStop(stopId: string): Promise<ActionResult<{ placeId: string; cityName: string }>> {
  try {
    const { supabase } = await requireUser();
    const sid = z.uuid().parse(stopId);
    const stop = must(await supabase.from("itinerary_items").select("*").eq("id", sid).single());
    if (stop.place_id) throw new Error("This stop is already linked to a place.");
    const day = must(await supabase.from("itinerary_days").select("*").eq("id", stop.day_id).single());
    let cityId = day.city_id;
    if (!cityId) {
      const first = must(await supabase.from("cities").select("id").eq("trip_country_id", day.trip_country_id).order("order_index").limit(1));
      cityId = first[0]?.id ?? null;
    }
    if (!cityId) throw new Error("Add a city to this country first, then try again.");
    const city = must(await supabase.from("cities").select("name, lat, lng").eq("id", cityId).single());
    const place = must(
      await supabase
        .from("places")
        .insert({
          city_id: cityId,
          name: stop.title,
          category: STOP_TO_CATEGORY[(stop.type as StopType) ?? "activity"] ?? "sight",
          status: "planned",
          notes: stop.notes,
        })
        .select("id")
        .single(),
    );
    must(await supabase.from("itinerary_items").update({ place_id: place.id }).eq("id", sid));
    refreshAll();
    return ok({ placeId: place.id, cityName: city.name });
  } catch (e) {
    return fail(e);
  }
}
