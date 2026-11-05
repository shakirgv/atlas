import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { coverAttribution, loadEntityPhotos, loadGraph } from "@/lib/data";
import { placeLinks } from "@/lib/place-duplicates";
import type { ItineraryDay, ItineraryItem } from "@/lib/types";
import { PlacesView } from "@/components/places/places-view";
import type { PlaceDayOption, PlaceStop } from "@/components/places/place-drawer";

export const metadata: Metadata = { title: "Places" };

export default async function PlacesPage({ searchParams }: PageProps<"/places">) {
  const sp = await searchParams;
  const openId = typeof sp.open === "string" ? sp.open : null;
  const { supabase, scope } = await getScope();
  const [g, memoryLinks] = await Promise.all([
    loadGraph(supabase, scope.trips, scope.tripIds, { places: true, days: true }),
    // Only which place each memory hangs off, for what a merge would move. The memories themselves aren't shown here.
    scope.tripIds.length
      ? supabase
          .from("memories")
          .select("place_id")
          .in("trip_id", scope.tripIds)
          .not("place_id", "is", null)
          .then((r) => r.data ?? [])
      : Promise.resolve([] as { place_id: string | null }[]),
  ]);
  let open = openId ? (g.places.find((p) => p.id === openId) ?? null) : null;
  // A place from another trip (e.g. via search) still opens.
  if (openId && !open) {
    const { data } = await supabase.from("places").select("*").eq("id", openId).maybeSingle();
    if (data) open = { ...data, cover_url: null, city_name: "", country_code: "" };
  }

  // The open place's country, and its days, so the drawer can schedule it. A place outside this view loads its own.
  let openCountry: { id: string; name: string } | null = null;
  let days: ItineraryDay[] = g.days;
  let items: ItineraryItem[] = g.items;
  let cityNames = new Map(g.cities.map((c) => [c.id, c.name]));
  if (open) {
    const city = g.cities.find((c) => c.id === open!.city_id);
    if (city) {
      openCountry = { id: city.trip_country_id, name: city.country_name };
    } else {
      const { data: row } = await supabase.from("cities").select("trip_country_id").eq("id", open.city_id).maybeSingle();
      if (row) {
        const [{ data: ownDays }, { data: ownCities }] = await Promise.all([
          supabase.from("itinerary_days").select("*").eq("trip_country_id", row.trip_country_id).order("day_number"),
          supabase.from("cities").select("id, name").eq("trip_country_id", row.trip_country_id),
        ]);
        days = ownDays ?? [];
        const { data: ownItems } = days.length ? await supabase.from("itinerary_items").select("*").in("day_id", days.map((d) => d.id)).eq("place_id", open.id) : { data: [] };
        items = ownItems ?? [];
        cityNames = new Map((ownCities ?? []).map((c) => [c.id, c.name]));
        openCountry = { id: row.trip_country_id, name: "" };
      }
    }
  }

  const [photos, attribution] = open ? await Promise.all([loadEntityPhotos(supabase, open.id), coverAttribution(supabase, open.cover_path)]) : [[], null];
  const dayById = new Map(days.map((d) => [d.id, d]));
  const stops: PlaceStop[] = open
    ? items
        .filter((i) => i.place_id === open!.id && dayById.has(i.day_id))
        .map((i) => {
          const day = dayById.get(i.day_id)!;
          return { id: i.id, title: i.title, day_number: day.day_number, date: day.date, start_time: i.start_time, end_time: i.end_time, trip_country_id: day.trip_country_id, day_id: i.day_id };
        })
        .sort((a, b) => a.day_number - b.day_number || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    : [];
  const dayOptions: PlaceDayOption[] = openCountry
    ? days
        .filter((d) => d.trip_country_id === openCountry!.id)
        .map((d) => ({ id: d.id, day_number: d.day_number, date: d.date, city_id: d.city_id, city_name: d.city_id ? (cityNames.get(d.city_id) ?? "") : "", title: d.title }))
    : [];

  return (
    <PlacesView
      places={g.places}
      countries={g.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag }))}
      cities={g.cities.map((c) => ({ id: c.id, name: c.name, flag: c.flag, trip_country_id: c.trip_country_id }))}
      scheduledIds={Array.from(new Set(g.items.flatMap((i) => (i.place_id ? [i.place_id] : []))))}
      links={placeLinks(g.items, memoryLinks)}
      open={open}
      openPhotos={photos}
      openAttribution={attribution}
      openStops={stops}
      openDays={dayOptions}
      openCountry={openCountry}
    />
  );
}
