import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { PrintItinerary } from "@/components/itinerary/print-itinerary";

export const metadata: Metadata = { title: "Printable itinerary" };

export default async function PrintPage({ searchParams }: PageProps<"/itinerary/print">) {
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const countryId = typeof sp.country === "string" ? sp.country : null;
  let tripId = typeof sp.trip === "string" ? sp.trip : null;
  if (countryId && !tripId) {
    const { data } = await supabase.from("trip_countries").select("trip_id").eq("id", countryId).maybeSingle();
    tripId = data?.trip_id ?? null;
  }
  tripId ??= scope.activeTrip?.id ?? null;
  if (!tripId) notFound();
  const g = await loadGraph(supabase, scope.trips, [tripId], { days: true, places: true, bookings: true });
  const trip = g.trips[0];
  if (!trip) notFound();
  const countries = countryId ? g.countries.filter((c) => c.id === countryId) : g.countries;
  return (
    <PrintItinerary
      trip={trip}
      sections={countries.map((c) => ({
        country: c,
        days: g.days
          .filter((d) => d.trip_country_id === c.id)
          .map((d) => ({
            day: d,
            city: g.cities.find((x) => x.id === d.city_id)?.name ?? null,
            stops: g.items
              .filter((i) => i.day_id === d.id)
              .map((i) => ({ ...i, place: g.places.find((p) => p.id === i.place_id) ?? null })),
            bookings: g.bookings.filter((b) => d.date && b.start_at?.slice(0, 10) === d.date),
          })),
      }))}
      allTripHref={`/itinerary/print?trip=${tripId}`}
      singleCountry={Boolean(countryId)}
    />
  );
}
