"use client";
import { CalendarDays, Earth, Flag, Hourglass, MapPin, Plane, Trophy, Wallet, Building2, Globe2 } from "lucide-react";
import { countryFlag, countryName } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { TRIP_STATUS_META } from "@/lib/status";
import type { TripStatus } from "@/lib/types";
import { pluralize } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { CountUp, PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { StatTile } from "@/components/common/stat-tile";
import { WorldMap, type MapCountryState } from "@/components/map/world-map";
import { Ring } from "@/components/charts/charts";
import { Progress } from "@/components/ui/misc";

export function StatsView(p: {
  baseCurrency: string;
  states: Record<string, MapCountryState>;
  visited: number;
  planned: number;
  worldPct: number;
  worldTotal: number;
  continents: { name: string; visited: number; total: number }[];
  continentsCovered: number;
  citiesVisited: number;
  cities: number;
  placesVisited: number;
  daysOnRoad: number;
  longestTrip: { id: string; title: string; days: number } | null;
  mostVisited: { code: string; trips: number; days: number } | null;
  longestStay: { code: string; days: number } | null;
  spent: number;
  spendPerDay: number;
  trips: number;
  byStatus: { status: string; count: number }[];
  visitedList: string[];
}) {
  const money = (n: number) => formatMoney(n, p.baseCurrency);
  if (!p.trips) {
    return (
      <PageTransition>
        <PageHeader eyebrow="Overview" title="Travel Stats" />
        <EmptyState icon={Earth} title="Your stats start with the first trip" description="Mark countries, cities and places as visited and watch the numbers grow." />
      </PageTransition>
    );
  }
  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader eyebrow="Overview" title="Travel Stats" description="Lifetime numbers across all your trips." />
      <div className="grid gap-4 lg:grid-cols-12">
        <section className="card relative overflow-hidden lg:col-span-8" aria-label="Visited countries map">
          <div className="absolute left-5 top-5 z-10">
            <p className="eyebrow">Countries visited</p>
            <p className="font-display text-[48px] font-semibold leading-none">
              <CountUp value={p.visited} />
              <span className="text-2xl text-muted"> / {p.worldTotal}</span>
            </p>
          </div>
          <div className="bg-ocean pt-16">
            <WorldMap compact fitRoute={false} states={p.states} className="h-[300px] sm:h-[360px]" />
          </div>
        </section>
        <section className="card flex flex-col items-center justify-center gap-3 p-6 text-center lg:col-span-4" aria-label="Share of the world">
          <div className="relative">
            <Ring value={p.worldPct / 100} size={160} stroke={14} color="var(--accent)" />
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <CountUp value={p.worldPct} format={(n) => `${n.toFixed(1)}%`} className="num font-display text-[34px] font-semibold" />
                <p className="text-xs text-muted">of the world</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted">
            {pluralize(p.planned, "more country", "more countries")} planned · {p.continentsCovered} of 6 continents
          </p>
        </section>
      </div>
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem><StatTile icon={Globe2} label="Continents" value={p.continentsCovered} suffix="of 6" /></StaggerItem>
        <StaggerItem><StatTile icon={Building2} label="Cities visited" value={p.citiesVisited} suffix={`of ${p.cities}`} tone="var(--wishlist)" /></StaggerItem>
        <StaggerItem><StatTile icon={MapPin} label="Places visited" value={p.placesVisited} tone="var(--visited)" /></StaggerItem>
        <StaggerItem><StatTile icon={CalendarDays} label="Days on the road" value={p.daysOnRoad} tone="var(--planned)" /></StaggerItem>
        <StaggerItem><StatTile icon={Wallet} label="Total spent" value={p.spent} format={money} tone="var(--visited)" /></StaggerItem>
        <StaggerItem><StatTile icon={Hourglass} label="Spend per day" value={p.spendPerDay} format={money} tone="var(--accent)" /></StaggerItem>
        <StaggerItem><StatTile icon={Plane} label="Trips" value={p.trips} tone="var(--wishlist)" /></StaggerItem>
        <StaggerItem><StatTile icon={Flag} label="Countries planned" value={p.planned} tone="var(--planned)" /></StaggerItem>
      </Stagger>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5" aria-label="Records">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Trophy className="size-5 text-accent" /> Records
          </h2>
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="eyebrow">Longest trip</dt>
              <dd className="mt-1 font-display text-lg font-semibold">{p.longestTrip ? `${p.longestTrip.title} · ${p.longestTrip.days} days` : "Add trip dates"}</dd>
            </div>
            <div>
              <dt className="eyebrow">Most visited country</dt>
              <dd className="mt-1 font-display text-lg font-semibold">{p.mostVisited ? `${countryFlag(p.mostVisited.code)} ${countryName(p.mostVisited.code)} · ${pluralize(p.mostVisited.trips, "trip")}` : "—"}</dd>
            </div>
            <div>
              <dt className="eyebrow">Longest stay</dt>
              <dd className="mt-1 font-display text-lg font-semibold">{p.longestStay ? `${countryFlag(p.longestStay.code)} ${countryName(p.longestStay.code)} · ${p.longestStay.days} days` : "—"}</dd>
            </div>
          </dl>
        </section>
        <section className="card p-5" aria-label="Continents">
          <h2 className="mb-4 text-xl font-semibold">By continent</h2>
          <ul className="flex flex-col gap-3.5">
            {p.continents.filter((c) => c.total > 0).map((c) => (
              <li key={c.name}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="num text-muted">
                    {c.visited} / {c.total}
                  </span>
                </div>
                <Progress value={(c.visited / c.total) * 100} color="var(--visited)" />
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5" aria-label="Visited countries">
          <h2 className="mb-4 text-xl font-semibold">Visited</h2>
          {p.visitedList.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {p.visitedList.map((c) => (
                <li key={c} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-visited-soft px-3 text-sm">
                  {countryFlag(c)} {countryName(c)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Mark a country as visited to start the collection.</p>
          )}
          <h3 className="mb-2 mt-6 text-sm font-medium text-muted">Trips by status</h3>
          <ul className="flex flex-wrap gap-1.5">
            {p.byStatus.filter((s) => s.count).map((s) => (
              <li key={s.status} className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium" style={{ background: TRIP_STATUS_META[s.status as TripStatus].soft }}>
                {TRIP_STATUS_META[s.status as TripStatus].label} <span className="num">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageTransition>
  );
}
