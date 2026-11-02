import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScope } from "@/lib/scope";
import { coverAttribution, loadGraph } from "@/lib/data";
import { CountryDetail } from "@/components/countries/country-detail";
import { climateStopsFor, tripRoute } from "@/lib/server/route-data";

export const metadata: Metadata = { title: "Country" };

export default async function CountryPage({ params, searchParams }: PageProps<"/countries/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const { data: tc } = await supabase.from("trip_countries").select("trip_id").eq("id", id).maybeSingle();
  if (!tc) notFound();
  const g = await loadGraph(supabase, scope.trips, [tc.trip_id], { days: true, places: true, expenses: true, memories: true, documents: true });
  const country = g.countries.find((c) => c.id === id);
  if (!country) notFound();
  const cities = g.cities.filter((c) => c.trip_country_id === id);
  const cityIds = new Set(cities.map((c) => c.id));
  const days = g.days.filter((d) => d.trip_country_id === id);
  const dayIds = new Set(days.map((d) => d.id));
  const route = tripRoute(tc.trip_id, g.countries, g.cities, scope.settings);
  return (
    <CountryDetail
      legs={route.legs.filter((l) => l.tripCountryId === id)}
      climateStops={climateStopsFor(route.stops, id)}
      country={country}
      attribution={await coverAttribution(supabase, country.cover_path)}
      cities={cities}
      places={g.places.filter((p) => cityIds.has(p.city_id))}
      days={days}
      items={g.items.filter((i) => dayIds.has(i.day_id))}
      expenses={g.expenses.filter((e) => e.trip_country_id === id)}
      memories={g.memories.filter((m) => m.trip_country_id === id)}
      documents={g.documents.filter((d) => d.trip_country_id === id || (d.trip_id === tc.trip_id && !d.trip_country_id))}
      baseCurrency={scope.baseCurrency}
      initialTab={typeof sp.tab === "string" ? sp.tab : "overview"}
      openEdit={sp.edit === "1"}
    />
  );
}
