import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { tripRoute } from "@/lib/server/route-data";
import { JETLAG_STRONG_HOURS } from "@/lib/jetlag";
import { ItineraryPlanner } from "@/components/itinerary/planner";

export const metadata: Metadata = { title: "Itinerary" };

export default async function ItineraryPage({ searchParams }: PageProps<"/itinerary">) {
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.tripIds, { days: true, places: true, bookings: true });
  const requested = typeof sp.country === "string" ? sp.country : null;
  const selected =
    g.countries.find((c) => c.id === requested) ??
    g.countries.find((c) => c.display === "ongoing") ??
    g.countries.find((c) => g.days.some((d) => d.trip_country_id === c.id)) ??
    g.countries[0] ??
    null;
  const days = selected ? g.days.filter((d) => d.trip_country_id === selected.id) : [];
  const dayIds = new Set(days.map((d) => d.id));
  const cities = selected ? g.cities.filter((c) => c.trip_country_id === selected.id) : [];
  const cityIds = new Set(cities.map((c) => c.id));
  // Days on which I arrive at a stop with a big time shift get a soft "light first day" banner.
  const shiftDayIds = selected
    ? tripRoute(selected.trip_id, g.countries, g.cities, scope.settings)
        .legs.filter((l) => l.tripCountryId === selected.id && l.jetlag && Math.abs(l.jetlag.shift) >= JETLAG_STRONG_HOURS)
        .map((l) => days.find((d) => l.arrive && d.date === l.arrive) ?? (l.toKind === "city" ? days.find((d) => d.city_id === l.toId) : days[0]))
        .flatMap((d) => (d ? [d.id] : []))
    : [];
  const bookings = selected ? g.bookings.filter((b) => b.trip_country_id === selected.id || (b.trip_id === selected.trip_id && !b.trip_country_id)) : [];
  const initialDayId = typeof sp.day === "string" ? sp.day : null;
  return (
    <ItineraryPlanner
      // Another country or a link to a day starts the view over: open days and the city filter belong to what was on screen.
      key={`${selected?.id}:${initialDayId}`}
      countries={g.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag, trip_id: c.trip_id, trip_title: c.trip_title, hasDays: g.days.some((d) => d.trip_country_id === c.id) }))}
      country={selected}
      days={days}
      items={g.items.filter((i) => dayIds.has(i.day_id))}
      cities={cities}
      places={g.places.filter((p) => cityIds.has(p.city_id))}
      bookings={bookings}
      shiftDayIds={shiftDayIds}
      initialDayId={initialDayId}
      showTripName={scope.isAll}
    />
  );
}
