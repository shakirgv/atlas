import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { loadMapData } from "@/lib/map-data";
import { buildAlerts } from "@/lib/alerts";
import { summarizeBudget } from "@/lib/budget";
import { daysOnTheRoad } from "@/lib/trip";
import { todayIso } from "@/lib/dates";
import { Dashboard } from "@/components/dashboard/dashboard";

export default async function DashboardPage() {
  const { supabase, scope } = await getScope();
  const [g, map] = await Promise.all([
    loadGraph(supabase, scope.trips, scope.tripIds, { days: true, places: true, expenses: true, memories: true, documents: true, photoCount: true, bookings: true }),
    loadMapData(supabase, scope),
  ]);
  const today = todayIso();
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
  const md = today.slice(5);
  const onThisDay = g.memories.filter((m) => m.date.slice(5) === md && m.date.slice(0, 4) < today.slice(0, 4));

  return (
    <Dashboard
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
      map={map}
      upcomingDays={upcomingDays}
      memories={g.memories.slice(0, 3)}
      onThisDay={onThisDay}
      alerts={buildAlerts({ documents: g.documents, trips: g.trips, countries: g.countries, expenses: g.expenses })}
    />
  );
}
