import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { ACTIVE_TRIP_COOKIE, ALL_TRIPS } from "@/lib/config";
import { requirePageUser } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import type { Settings, Trip } from "@/lib/types";

/** Default trip: ongoing → next upcoming → newest. */
export function pickDefaultTrip(trips: Trip[]): Trip | null {
  if (!trips.length) return null;
  const today = todayIso();
  const ongoing = trips.find(
    (t) => t.status === "ongoing" || (t.start_date && t.end_date && t.start_date <= today && today <= t.end_date),
  );
  if (ongoing) return ongoing;
  const upcoming = trips
    .filter((t) => t.start_date && t.start_date > today)
    .sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0];
  if (upcoming) return upcoming;
  return [...trips].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
}

export type Scope = {
  userId: string;
  email: string | null;
  settings: Settings | null;
  baseCurrency: string;
  trips: Trip[];
  /** null = "All trips" */
  activeTrip: Trip | null;
  /** Trip ids every page should filter by. */
  tripIds: string[];
  isAll: boolean;
};

/** Loads user, settings, trips and the active-trip filter. Cached per request. */
export const getScope = cache(async () => {
  const { supabase, user } = await requirePageUser();
  const cookieStore = await cookies();
  const [{ data: settings }, { data: trips }] = await Promise.all([
    supabase.from("settings").select("*").maybeSingle(),
    supabase.from("trips").select("*").order("start_date", { ascending: true, nullsFirst: false }),
  ]);
  const allTrips = trips ?? [];
  const raw = cookieStore.get(ACTIVE_TRIP_COOKIE)?.value;
  let activeTrip: Trip | null = null;
  let isAll = false;
  if (raw === ALL_TRIPS) {
    isAll = true;
  } else if (raw) {
    activeTrip = allTrips.find((t) => t.id === raw) ?? pickDefaultTrip(allTrips);
  } else {
    activeTrip = pickDefaultTrip(allTrips);
  }
  if (!activeTrip) isAll = true;
  const scope: Scope = {
    userId: user.id,
    email: user.email ?? null,
    settings: settings ?? null,
    baseCurrency: settings?.base_currency ?? "USD",
    trips: allTrips,
    activeTrip,
    tripIds: isAll ? allTrips.map((t) => t.id) : activeTrip ? [activeTrip.id] : [],
    isAll,
  };
  return { supabase, user, scope };
});
