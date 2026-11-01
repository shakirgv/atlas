import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { CitiesView } from "@/components/cities/cities-view";

export const metadata: Metadata = { title: "Cities" };

export default async function CitiesPage() {
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.tripIds, { days: true, places: true });
  return (
    <CitiesView
      cities={g.cities}
      countries={g.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag }))}
      placeCounts={Object.fromEntries(g.cities.map((c) => [c.id, g.places.filter((p) => p.city_id === c.id).length]))}
      dayCounts={Object.fromEntries(g.cities.map((c) => [c.id, g.days.filter((d) => d.city_id === c.id).length]))}
    />
  );
}
