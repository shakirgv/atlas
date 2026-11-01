import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { coverAttribution, loadEntityPhotos, loadGraph } from "@/lib/data";
import { PlacesView } from "@/components/places/places-view";

export const metadata: Metadata = { title: "Places" };

export default async function PlacesPage({ searchParams }: PageProps<"/places">) {
  const sp = await searchParams;
  const openId = typeof sp.open === "string" ? sp.open : null;
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.tripIds, { places: true, days: true });
  let open = openId ? (g.places.find((p) => p.id === openId) ?? null) : null;
  // A place from another trip (e.g. via search) still opens.
  if (openId && !open) {
    const { data } = await supabase.from("places").select("*").eq("id", openId).maybeSingle();
    if (data) open = { ...data, cover_url: null, city_name: "", country_code: "" };
  }
  const [photos, attribution] = open ? await Promise.all([loadEntityPhotos(supabase, open.id), coverAttribution(supabase, open.cover_path)]) : [[], null];
  const stops = open
    ? g.items.filter((i) => i.place_id === open!.id).map((i) => {
        const day = g.days.find((d) => d.id === i.day_id);
        return { id: i.id, title: i.title, day_number: day?.day_number ?? 0, date: day?.date ?? null, trip_country_id: day?.trip_country_id ?? "", day_id: i.day_id };
      })
    : [];
  return (
    <PlacesView
      places={g.places}
      cities={g.cities.map((c) => ({ id: c.id, name: c.name, flag: c.flag }))}
      open={open}
      openPhotos={photos}
      openAttribution={attribution}
      openStops={stops}
      baseCurrency={scope.baseCurrency}
    />
  );
}
