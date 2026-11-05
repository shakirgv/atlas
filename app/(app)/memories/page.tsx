import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { parseFilters } from "@/lib/memory-filters";
import { MemoriesView } from "@/components/memories/memories-view";

export const metadata: Metadata = { title: "Memories" };

export default async function MemoriesPage({ searchParams }: PageProps<"/memories">) {
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.tripIds, { memories: true, places: true, days: true });
  return (
    <MemoriesView
      memories={g.memories}
      countries={g.countries.map((c) => ({ id: c.id, code: c.code, name: c.name, flag: c.flag }))}
      cities={g.cities.map((c) => ({ id: c.id, name: c.name, trip_country_id: c.trip_country_id, lat: c.lat, lng: c.lng }))}
      places={g.places.map((p) => ({ id: p.id, name: p.name, city_id: p.city_id, lat: p.lat, lng: p.lng }))}
      days={g.days.map((d) => ({ id: d.id, trip_country_id: d.trip_country_id, day_number: d.day_number, date: d.date, city_id: d.city_id, title: d.title }))}
      focus={typeof sp.focus === "string" ? sp.focus : null}
      initialTab={typeof sp.tab === "string" ? sp.tab : "timeline"}
      initialFilters={parseFilters(sp)}
    />
  );
}
