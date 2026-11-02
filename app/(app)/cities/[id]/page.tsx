import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScope } from "@/lib/scope";
import { coverAttribution, loadGraph } from "@/lib/data";
import { CityDetail } from "@/components/cities/city-detail";

export const metadata: Metadata = { title: "City" };

export default async function CityPage({ params }: PageProps<"/cities/[id]">) {
  const { id } = await params;
  const { supabase, scope } = await getScope();
  const { data: row } = await supabase.from("cities").select("trip_country_id, trip_countries(trip_id)").eq("id", id).maybeSingle();
  const tripId = (row?.trip_countries as unknown as { trip_id: string } | null)?.trip_id;
  if (!row || !tripId) notFound();
  const g = await loadGraph(supabase, scope.trips, [tripId], { days: true, places: true, memories: true });
  const city = g.cities.find((c) => c.id === id);
  if (!city) notFound();
  const days = g.days.filter((d) => d.city_id === id);
  const dayIds = new Set(days.map((d) => d.id));
  const country = g.countries.find((c) => c.id === city.trip_country_id);
  return (
    <CityDetail
      city={city}
      stay={{ arrive: city.arrive_date ?? country?.arrive_date ?? null, depart: city.depart_date ?? country?.depart_date ?? null }}
      attribution={await coverAttribution(supabase, city.cover_path)}
      places={g.places.filter((p) => p.city_id === id)}
      days={days}
      items={g.items.filter((i) => dayIds.has(i.day_id))}
      memories={g.memories.filter((m) => m.city_id === id)}
    />
  );
}
