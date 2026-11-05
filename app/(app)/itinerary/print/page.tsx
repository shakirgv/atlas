import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { parsePrint } from "@/lib/print-itinerary";
import { PrintItinerary } from "@/components/itinerary/print-itinerary";

export const metadata: Metadata = { title: "Printable itinerary" };

/** The whole trip is loaded, so switching between a country, a city, dates or the trip happens on the page without a reload. */
export default async function PrintPage({ searchParams }: PageProps<"/itinerary/print">) {
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const { selection, options } = parsePrint(sp);
  let tripId = typeof sp.trip === "string" ? sp.trip : null;
  let countryId = selection.countryId;
  if (!tripId && !countryId && selection.cityId) {
    const { data } = await supabase.from("cities").select("trip_country_id").eq("id", selection.cityId).maybeSingle();
    countryId = data?.trip_country_id ?? null;
  }
  if (!tripId && countryId) {
    const { data } = await supabase.from("trip_countries").select("trip_id").eq("id", countryId).maybeSingle();
    tripId = data?.trip_id ?? null;
  }
  tripId ??= scope.activeTrip?.id ?? null;
  if (!tripId) notFound();
  const g = await loadGraph(supabase, scope.trips, [tripId], { days: true, places: true, bookings: true });
  const trip = g.trips[0];
  if (!trip) notFound();
  const order = new Map(g.countries.map((c, i) => [c.id, i]));
  const days = g.days
    .filter((d) => order.has(d.trip_country_id))
    .sort((a, b) => order.get(a.trip_country_id)! - order.get(b.trip_country_id)! || a.day_number - b.day_number)
    .map((d) => ({
      day: d,
      city: g.cities.find((x) => x.id === d.city_id)?.name ?? null,
      stops: g.items
        .filter((i) => i.day_id === d.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((i) => ({ ...i, place: g.places.find((p) => p.id === i.place_id) ?? null })),
      bookings: g.bookings.filter((b) => d.date && b.start_at?.slice(0, 10) === d.date),
    }));
  return (
    <PrintItinerary
      trip={trip}
      countries={g.countries}
      cities={g.cities.map((c) => ({ id: c.id, name: c.name, trip_country_id: c.trip_country_id, arrive_date: c.arrive_date, depart_date: c.depart_date }))}
      days={days}
      initialSelection={{ ...selection, countryId: countryId ?? selection.countryId }}
      initialOptions={options}
    />
  );
}
