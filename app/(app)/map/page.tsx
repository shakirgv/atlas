import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { loadExportTrips, loadMapData } from "@/lib/map-data";
import { MapExplorer } from "@/components/map/map-explorer";
import { countryAnchor } from "@/lib/countries";
import { photoBadges } from "@/lib/photo-pins";
import { loadPhotoPins } from "@/lib/server/photo-pins";

export const metadata: Metadata = { title: "World Map" };

export default async function MapPage() {
  const { supabase, scope } = await getScope();
  const [map, g] = await Promise.all([loadMapData(supabase, scope), loadGraph(supabase, scope.trips, scope.tripIds, { memories: true, places: true })]);
  const { pins } = await loadPhotoPins(supabase, g);
  const badges = photoBadges(pins, g.cities, g.countries.map((c) => ({ id: c.id, name: c.name, anchor: countryAnchor(c.code) as [number, number] | null })));
  const { routeFor, ...mapProps } = map;
  const exportTrips = await loadExportTrips(supabase, scope, routeFor);
  return <MapExplorer {...mapProps} exportTrips={exportTrips} activeTripId={scope.activeTrip?.id ?? null} photoBadges={badges} countries={g.countries} cityCounts={Object.fromEntries(g.countries.map((c) => [c.id, g.cities.filter((x) => x.trip_country_id === c.id).length]))} />;
}
