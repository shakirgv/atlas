import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScope } from "@/lib/scope";
import { coverAttribution, loadGraph } from "@/lib/data";
import { nextSteps, tripProgress } from "@/lib/trip";
import { TripDetail } from "@/components/trips/trip-detail";
import { climateStopsFor, legIntoCountry, tripRoute } from "@/lib/server/route-data";

export const metadata: Metadata = { title: "Trip" };

export default async function TripPage({ params }: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const { supabase, scope } = await getScope();
  const trip = scope.trips.find((t) => t.id === id);
  if (!trip) notFound();
  const g = await loadGraph(supabase, scope.trips, [id], { days: true, places: true, expenses: true, memories: { limit: 3 }, documents: true });
  const t = g.trips[0]!;
  const steps = nextSteps({ trip: t, countries: g.countries, cities: g.cities, days: g.days, items: g.items, expenses: g.expenses, documents: g.documents });
  const spent = g.expenses.filter((e) => e.kind === "actual").reduce((s, e) => s + Number(e.amount_base), 0);
  const planned = g.expenses.filter((e) => e.kind === "planned").reduce((s, e) => s + Number(e.amount_base), 0);
  const route = tripRoute(id, g.countries, g.cities, scope.settings);
  const legs = Object.fromEntries(g.countries.map((c) => [c.id, legIntoCountry(route.legs, c.id)]));
  return (
    <TripDetail
      legs={legs}
      climateStops={Object.fromEntries(g.countries.map((c) => [c.id, climateStopsFor(route.stops, c.id)]))}
      trip={t}
      attribution={await coverAttribution(supabase, t.cover_path)}
      countries={g.countries}
      cityCounts={Object.fromEntries(g.countries.map((c) => [c.id, g.cities.filter((x) => x.trip_country_id === c.id).length]))}
      dayCounts={Object.fromEntries(g.countries.map((c) => [c.id, g.days.filter((x) => x.trip_country_id === c.id).length]))}
      steps={steps}
      progress={tripProgress(t, steps.filter((s) => s.done).length)}
      stats={{ cities: g.cities.length, days: g.days.length, places: g.places.length, placesVisited: g.places.filter((p) => p.status === "visited").length, spent, planned, budget: Number(t.total_budget ?? 0) || g.countries.reduce((s, c) => s + Number(c.budget ?? 0), 0) }}
      memories={g.memories}
      baseCurrency={scope.baseCurrency}
      isActive={scope.activeTrip?.id === id}
    />
  );
}
