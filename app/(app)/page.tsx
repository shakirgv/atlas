import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { loadMapData } from "@/lib/map-data";
import { buildAlerts } from "@/lib/alerts";
import { entryOverview, latestPassportExpiry } from "@/lib/entry";
import { summarizeBudget } from "@/lib/budget";
import { daysOnTheRoad } from "@/lib/trip";
import { daysUntil, todayIso } from "@/lib/dates";
import { Dashboard } from "@/components/dashboard/dashboard";
import type { NextDestinationData } from "@/components/dashboard/next-destination-card";
import { isHomeCity, nextDestination } from "@/lib/next-destination";
import { routesForTrips } from "@/lib/server/route-data";
import { loadCash } from "@/lib/server/cash";
import { loadOnThisDay, loadRecapYears } from "@/lib/server/recap";
import { recapEntry } from "@/lib/recap";
import { closingPrompt, hotelNames } from "@/lib/closing-notes";

export default async function DashboardPage() {
  const { supabase, scope } = await getScope();
  const todayDate = todayIso();
  const [g, map, cash, onThisDay, recapYears, reviews] = await Promise.all([
    loadGraph(supabase, scope.trips, scope.tripIds, { days: true, places: true, expenses: true, memories: true, documents: true, photoCount: true, bookings: true, entries: true }),
    loadMapData(supabase, scope),
    loadCash(supabase, scope.baseCurrency),
    loadOnThisDay(supabase, todayDate),
    loadRecapYears(supabase, todayDate),
    supabase.from("country_reviews").select("trip_country_id, completed_at, dismissed_at"),
  ]);
  const today = todayDate;
  // No table means the SQL file hasn't been run yet, and asking would only end in an error.
  const left = reviews.error ? null : closingPrompt(g.countries, reviews.data ?? [], today);
  const leftPlaces = left ? g.places.filter((p) => g.cities.some((c) => c.id === p.city_id && c.trip_country_id === left.id)) : [];
  const ongoing = g.countries.find((c) => c.display === "ongoing");
  const upcoming = g.countries.filter((c) => c.arrive_date && c.arrive_date > today).sort((a, b) => a.arrive_date!.localeCompare(b.arrive_date!))[0];
  const nextStop = ongoing ?? upcoming ?? null;

  const upcomingDays = g.days
    .filter((d) => d.date && d.date >= today)
    .sort((a, b) => a.date!.localeCompare(b.date!))
    .slice(0, 3)
    .map((d) => ({
      day: d,
      country: g.countries.find((c) => c.id === d.trip_country_id) ?? null,
      city: g.cities.find((c) => c.id === d.city_id) ?? null,
      stops: g.items.filter((i) => i.day_id === d.id),
      bookings: g.bookings.filter((b) => b.start_at?.slice(0, 10) === d.date),
    }));

  const codes = (status: (s: string) => boolean) => new Set(g.countries.filter((c) => status(c.status)).map((c) => c.code)).size;

  const route = routesForTrips(scope.tripIds, g.countries, g.cities, scope.settings);
  const next = nextDestination(route.stops, g.days, today);
  const destination: NextDestinationData | null = next
    ? {
        name: next.stop.name,
        tz: next.stop.tz,
        arrive: next.arrive,
        isHome: isHomeCity(next.stop),
        weather:
          next.stop.lat != null && next.stop.lng != null
            ? {
                name: next.stop.name,
                lat: next.stop.lat,
                lng: next.stop.lng,
                arrive: next.arrive,
                depart: next.stop.depart,
                forecastDue: (daysUntil(next.arrive) ?? 99) <= 14,
                focusDate: next.arrive,
              }
            : null,
      }
    : null;
  return (
    <Dashboard
      destination={destination}
      displayName={scope.settings?.display_name ?? ""}
      baseCurrency={scope.baseCurrency}
      activeTrip={scope.activeTrip}
      hasTrips={scope.trips.length > 0}
      nextStop={nextStop}
      nextStopCityCount={nextStop ? g.cities.filter((c) => c.trip_country_id === nextStop.id).length : 0}
      stats={{
        visited: codes((s) => s === "visited"),
        planned: codes((s) => s !== "visited"),
        cities: g.cities.length,
        daysOnRoad: daysOnTheRoad(g.countries),
        placesVisited: g.places.filter((p) => p.status === "visited").length,
        places: g.places.length,
        photos: g.photoCount,
      }}
      budget={summarizeBudget(g.expenses, g.trips, g.countries)}
      cash={cash.wallets.length ? { onHand: cash.cashOnHand, fees: cash.feesPaid } : null}
      map={{ states: map.states, routes: map.routes, cities: map.cities }}
      upcomingDays={upcomingDays}
      memories={g.memories.slice(0, 3)}
      onThisDay={onThisDay}
      recap={recapEntry(today, recapYears)}
      setup={{ missingHome: !scope.settings?.home_city, missingPassport: !scope.settings?.passport_country }}
      closing={left ? { country: { id: left.id, name: left.name, flag: left.flag, arrive_date: left.arrive_date, depart_date: left.depart_date }, places: leftPlaces.map((p) => ({ name: p.name, status: p.status })), hotels: hotelNames(g.bookings.filter((b) => b.trip_country_id === left.id), leftPlaces) } : null}
      alerts={buildAlerts({
        documents: g.documents,
        trips: g.trips,
        countries: g.countries,
        expenses: g.expenses,
        entries: entryOverview(g.countries, g.entries, { today, passportExpiry: latestPassportExpiry(g.documents) }),
        legs: route.legs,
      })}
    />
  );
}
