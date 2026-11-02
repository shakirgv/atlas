import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { loadMapData } from "@/lib/map-data";
import { COUNTRIES, WORLD_COUNTRY_COUNT, getCountry } from "@/lib/countries";
import { worldShare } from "@/lib/map-export";
import { daysBetween } from "@/lib/dates";
import { daysOnTheRoad } from "@/lib/trip";
import { StatsView } from "@/components/stats/stats-view";

export const metadata: Metadata = { title: "Travel Stats" };

export default async function StatsPage() {
  const { supabase, scope } = await getScope();
  const allIds = scope.trips.map((t) => t.id);
  const [g, map] = await Promise.all([loadGraph(supabase, scope.trips, allIds, { places: true, expenses: true }), loadMapData(supabase, { ...scope, tripIds: [], isAll: true, activeTrip: null })]);

  const visitedCodes = Array.from(new Set(g.countries.filter((c) => c.status === "visited").map((c) => c.code)));
  const plannedCodes = Array.from(new Set(g.countries.filter((c) => c.status !== "visited").map((c) => c.code))).filter((c) => !visitedCodes.includes(c));
  const regions = ["Europe", "Asia", "Africa", "Americas", "Oceania", "Antarctic"];
  const continents = regions.map((r) => ({
    name: r,
    visited: visitedCodes.filter((c) => getCountry(c)?.region === r).length,
    total: COUNTRIES.filter((c) => c.region === r && (c.unMember || c.independent)).length,
  }));
  const tripsWithLength = scope.trips.map((t) => ({ id: t.id, title: t.title, days: daysBetween(t.start_date, t.end_date) })).sort((a, b) => b.days - a.days);
  const counts = new Map<string, number>();
  g.countries.forEach((c) => counts.set(c.code, (counts.get(c.code) ?? 0) + 1));
  const daysIn = new Map<string, number>();
  g.countries.forEach((c) => daysIn.set(c.code, (daysIn.get(c.code) ?? 0) + daysBetween(c.arrive_date, c.depart_date)));
  const mostVisited = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || (daysIn.get(b[0]) ?? 0) - (daysIn.get(a[0]) ?? 0))[0] ?? null;
  const longestStay = Array.from(daysIn.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  const spent = g.expenses.filter((e) => e.kind === "actual").reduce((s, e) => s + Number(e.amount_base), 0);
  const road = daysOnTheRoad(g.countries);
  const byStatus = ["dreaming", "planning", "ongoing", "completed"].map((s) => ({ status: s, count: scope.trips.filter((t) => t.status === s).length }));

  return (
    <StatsView
      baseCurrency={scope.baseCurrency}
      states={map.states}
      visited={visitedCodes.length}
      planned={plannedCodes.length}
      worldPct={worldShare(visitedCodes)}
      worldTotal={WORLD_COUNTRY_COUNT}
      continents={continents}
      continentsCovered={continents.filter((c) => c.visited > 0).length}
      citiesVisited={g.cities.filter((c) => c.status === "visited").length}
      cities={g.cities.length}
      placesVisited={g.places.filter((p) => p.status === "visited").length}
      daysOnRoad={road}
      longestTrip={tripsWithLength[0]?.days ? tripsWithLength[0] : null}
      mostVisited={mostVisited ? { code: mostVisited[0], trips: mostVisited[1], days: daysIn.get(mostVisited[0]) ?? 0 } : null}
      longestStay={longestStay && longestStay[1] ? { code: longestStay[0], days: longestStay[1] } : null}
      spent={spent}
      spendPerDay={road ? spent / road : 0}
      trips={scope.trips.length}
      byStatus={byStatus}
      visitedList={visitedCodes}
    />
  );
}
