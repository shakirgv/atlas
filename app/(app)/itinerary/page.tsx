import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
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
  const bookings = selected ? g.bookings.filter((b) => b.trip_country_id === selected.id || (b.trip_id === selected.trip_id && !b.trip_country_id)) : [];
  return (
    <ItineraryPlanner
      countries={g.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag, trip_title: c.trip_title, hasDays: g.days.some((d) => d.trip_country_id === c.id) }))}
      country={selected}
      days={days}
      items={g.items.filter((i) => dayIds.has(i.day_id))}
      cities={cities}
      places={g.places.filter((p) => cityIds.has(p.city_id))}
      bookings={bookings}
      initialDayId={typeof sp.day === "string" ? sp.day : null}
      showTripName={scope.isAll}
    />
  );
}
