import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScope } from "@/lib/scope";
import { coverAttribution, loadGraph } from "@/lib/data";
import { CountryDetail } from "@/components/countries/country-detail";
import { climateStopsFor, tripRoute } from "@/lib/server/route-data";
import { latestPassport } from "@/lib/entry";
import { placeLinks } from "@/lib/place-duplicates";
import { hotelNames } from "@/lib/closing-notes";

export const metadata: Metadata = { title: "Country" };

export default async function CountryPage({ params, searchParams }: PageProps<"/countries/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const { data: tc } = await supabase.from("trip_countries").select("trip_id").eq("id", id).maybeSingle();
  if (!tc) notFound();
  const g = await loadGraph(supabase, scope.trips, [tc.trip_id], { days: true, places: true, expenses: true, memories: true, documents: true, entries: true, bookings: true });
  const country = g.countries.find((c) => c.id === id);
  if (!country) notFound();
  const cities = g.cities.filter((c) => c.trip_country_id === id);
  const cityIds = new Set(cities.map((c) => c.id));
  const days = g.days.filter((d) => d.trip_country_id === id);
  const dayIds = new Set(days.map((d) => d.id));
  const passport = latestPassport(g.documents);
  const countryDocuments = g.documents.filter((d) => d.trip_country_id === id || (d.trip_id === tc.trip_id && !d.trip_country_id));
  const route = tripRoute(tc.trip_id, g.countries, g.cities, scope.settings);
  const [{ data: infoOverride }, attribution, review] = await Promise.all([supabase.from("country_info_overrides").select("*").eq("country_code", country.code).maybeSingle(), coverAttribution(supabase, country.cover_path), supabase.from("country_reviews").select("*").eq("trip_country_id", id).maybeSingle()]);
  return (
    <CountryDetail
      legs={route.legs.filter((l) => l.tripCountryId === id)}
      climateStops={climateStopsFor(route.stops, id)}
      infoOverride={infoOverride}
      entry={{
        requirement: g.entries.find((e) => e.trip_country_id === id) ?? null,
        passportCountry: scope.settings?.passport_country ?? null,
        passportExpiry: passport?.expiry_date ?? null,
        documents: g.documents.map((d) => ({ id: d.id, title: d.title, type: d.type })),
      }}
      country={country}
      attribution={attribution}
      cities={cities}
      places={g.places.filter((p) => cityIds.has(p.city_id))}
      days={days}
      items={g.items.filter((i) => dayIds.has(i.day_id))}
      expenses={g.expenses.filter((e) => e.trip_country_id === id)}
      memories={g.memories.filter((m) => m.trip_country_id === id)}
      // The passport usually belongs to no trip, but every stay depends on it.
      documents={passport && !countryDocuments.some((d) => d.id === passport.id) ? [passport, ...countryDocuments] : countryDocuments}
      passportId={passport?.id ?? null}
      placeLinks={placeLinks(g.items, g.memories)}
      baseCurrency={scope.baseCurrency}
      initialTab={typeof sp.tab === "string" ? sp.tab : "overview"}
      openEdit={sp.edit === "1"}
      closing={{ available: !review.error, review: review.data, hotels: hotelNames(g.bookings.filter((b) => b.trip_country_id === id), g.places.filter((p) => cityIds.has(p.city_id))) }}
    />
  );
}
