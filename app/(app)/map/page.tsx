import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { loadMapData } from "@/lib/map-data";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = { title: "World Map" };

export default async function MapPage() {
  const { supabase, scope } = await getScope();
  const [map, g] = await Promise.all([loadMapData(supabase, scope), loadGraph(supabase, scope.trips, scope.tripIds)]);
  return <MapExplorer {...map} countries={g.countries} cityCounts={Object.fromEntries(g.countries.map((c) => [c.id, g.cities.filter((x) => x.trip_country_id === c.id).length]))} />;
}
