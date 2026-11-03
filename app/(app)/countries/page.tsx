import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { CountriesView } from "@/components/countries/countries-view";
import { itineraryStats } from "@/lib/country-list";

export const metadata: Metadata = { title: "Countries" };

export default async function CountriesPage() {
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.tripIds, { days: true });
  return (
    <CountriesView
      countries={g.countries}
      cityCounts={Object.fromEntries(g.countries.map((c) => [c.id, g.cities.filter((x) => x.trip_country_id === c.id).length]))}
      stats={itineraryStats(g.days, g.items)}
      trips={g.trips.map((t) => ({ id: t.id, title: t.title }))}
      singleTrip={!scope.isAll}
    />
  );
}
