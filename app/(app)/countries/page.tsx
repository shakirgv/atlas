import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { CountriesView } from "@/components/countries/countries-view";

export const metadata: Metadata = { title: "Countries" };

export default async function CountriesPage() {
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.tripIds, { days: true });
  return (
    <CountriesView
      countries={g.countries}
      cityCounts={Object.fromEntries(g.countries.map((c) => [c.id, g.cities.filter((x) => x.trip_country_id === c.id).length]))}
      dayCounts={Object.fromEntries(g.countries.map((c) => [c.id, g.days.filter((x) => x.trip_country_id === c.id).length]))}
      trips={g.trips.map((t) => ({ id: t.id, title: t.title }))}
      singleTrip={!scope.isAll}
    />
  );
}
