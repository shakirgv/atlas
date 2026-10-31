"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { bookingSchema, type BookingInput } from "@/lib/validation";
import { getRates } from "@/lib/fx";
import { rateToBase, round2 } from "@/lib/money";
import { fail, must, mustMaybe, ok, refreshAll } from "@/actions/_util";
import type { ActionResult, BookingType, ExpenseCategory } from "@/lib/types";

const BOOKING_TO_EXPENSE: Record<BookingType, ExpenseCategory> = {
  flight: "flights",
  train: "transport",
  bus: "transport",
  ferry: "transport",
  car: "transport",
  hotel: "accommodation",
  hostel: "accommodation",
  apartment: "accommodation",
  tour: "activities",
  other: "other",
};

export async function saveBooking(id: string | null, input: BookingInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const { add_expense, ...data } = bookingSchema.parse(input);
    let bookingId = id;
    if (id) {
      must(await supabase.from("bookings").update(data).eq("id", z.uuid().parse(id)));
    } else {
      bookingId = must(await supabase.from("bookings").insert(data).select("id").single()).id;
    }
    if (add_expense && data.cost && data.cost > 0) {
      const settings = mustMaybe(await supabase.from("settings").select("base_currency").maybeSingle());
      const base = settings?.base_currency ?? "USD";
      const currency = data.currency ?? base;
      const rates = currency === base ? null : await getRates(base);
      const fx = currency === base ? 1 : (rateToBase(rates, currency) ?? 1);
      must(
        await supabase.from("expenses").insert({
          trip_id: data.trip_id,
          trip_country_id: data.trip_country_id,
          city_id: data.city_id,
          date: (data.start_at ?? new Date().toISOString()).slice(0, 10),
          title: data.title,
          category: BOOKING_TO_EXPENSE[data.type],
          kind: "planned",
          amount: round2(data.cost),
          currency,
          fx_rate: fx,
          amount_base: round2(data.cost * fx),
          notes: data.confirmation_no ? `Booking ${data.confirmation_no}` : null,
        }),
      );
    }
    refreshAll();
    return ok({ id: bookingId! });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteBooking(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("bookings").delete().eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
