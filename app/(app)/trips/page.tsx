import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { nextSteps, tripProgress } from "@/lib/trip";
import { TripsView } from "@/components/trips/trips-view";

export const metadata: Metadata = { title: "Trips" };

export default async function TripsPage() {
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.trips.map((t) => t.id), { days: true, expenses: true, documents: true });
  const cards = g.trips.map((trip) => {
    const countries = g.countries.filter((c) => c.trip_id === trip.id);
    const ids = new Set(countries.map((c) => c.id));
    const days = g.days.filter((d) => ids.has(d.trip_country_id));
    const dayIds = new Set(days.map((d) => d.id));
    const steps = nextSteps({
      trip,
      countries,
      cities: g.cities.filter((c) => ids.has(c.trip_country_id)),
      days,
      items: g.items.filter((i) => dayIds.has(i.day_id)),
      expenses: g.expenses.filter((e) => e.trip_id === trip.id),
      documents: g.documents,
    });
    return {
      trip,
      coverUrl: trip.cover_url,
      flags: countries.map((c) => c.flag),
      countryCount: countries.length,
      progress: tripProgress(trip, steps.filter((s) => s.done).length),
    };
  });
  return <TripsView cards={cards} activeTripId={scope.activeTrip?.id ?? null} />;
}
