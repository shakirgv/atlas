"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LayoutGrid, Map as MapIcon, Plus, Search } from "lucide-react";
import type { CityVM } from "@/lib/data";
import type { DisplayStatus } from "@/lib/types";
import { GEO_STATUS_META } from "@/lib/status";
import { CityCard } from "@/components/cards/cards";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/motion";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { FilterChip, Segmented } from "@/components/ui/misc";
import { useWorkspace } from "@/components/shell/workspace";

export function CitiesView({
  cities,
  countries,
  placeCounts,
  dayCounts,
}: {
  cities: CityVM[];
  countries: { id: string; name: string; flag: string }[];
  placeCounts: Record<string, number>;
  dayCounts: Record<string, number>;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState<DisplayStatus | "all">("all");
  const [view, setView] = useState<"grid" | "map">("grid");
  const filtered = useMemo(
    () =>
      cities.filter(
        (c) => (country === "all" || c.trip_country_id === country) && (status === "all" || c.display === status) && (!query || c.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [cities, country, status, query],
  );
  const grouped = useMemo(() => countries.map((c) => ({ ...c, cities: filtered.filter((x) => x.trip_country_id === c.id) })).filter((g) => g.cities.length), [countries, filtered]);

  return (
    <PageTransition>
      <PageHeader
        eyebrow="Plan"
        title="Cities"
        description={cities.length ? `${cities.length} cities pinned across ${countries.length} countries.` : "Search cities and pin them on the map."}
        actions={
          <Button onClick={() => ws.openQuickAdd("city")}>
            <Plus /> Add cities
          </Button>
        }
      />
      {!cities.length ? (
        <EmptyState
          icon={Building2}
          title={countries.length ? "Add your first city" : "Add a country first"}
          description={countries.length ? "Open a country and search as you type. Each city gets a pin and a photo." : "Cities live inside countries. Start by adding the countries on your route."}
          action={
            <Button onClick={() => ws.openQuickAdd(countries.length ? "city" : "country")}>
              <Plus /> {countries.length ? "Add cities" : "Add countries"}
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cities" className="pl-9" aria-label="Search cities" />
            </div>
            <div className="flex gap-2">
              <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className="flex-1 sm:w-48">
                <option value="all">All countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </NativeSelect>
              <Segmented value={view} onChange={setView} options={[{ value: "grid", label: "Grid", icon: <LayoutGrid /> }, { value: "map", label: "Map", icon: <MapIcon /> }]} />
            </div>
          </div>
          <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {(["all", "ongoing", "planned", "visited", "wishlist"] as const).map((s) => (
              <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s !== "all" && <span className="size-2 rounded-full" style={{ background: GEO_STATUS_META[s].color }} />}
                {s === "all" ? "All" : GEO_STATUS_META[s].label}
              </FilterChip>
            ))}
          </div>
          {view === "map" ? (
            <MapView
              className="h-[60vh] min-h-96 rounded-[16px] border border-border"
              markers={filtered.filter((c) => c.lat != null && c.lng != null).map((c) => ({ id: c.id, lat: c.lat!, lng: c.lng!, label: `${c.flag} ${c.name}`, color: GEO_STATUS_META[c.display].color, glyph: "" }))}
              onMarkerClick={(id) => router.push(`/cities/${id}`)}
              emptyLabel="None of these cities has coordinates yet"
            />
          ) : grouped.length ? (
            <div className="flex flex-col gap-10">
              {grouped.map((g) => (
                <section key={g.id} aria-label={g.name}>
                  <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
                    <span className="text-2xl">{g.flag}</span> {g.name}
                    <span className="num text-sm font-normal text-muted">{g.cities.length}</span>
                  </h2>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {g.cities.map((c) => (
                      <CityCard key={c.id} c={c} placeCount={placeCounts[c.id] ?? 0} dayCount={dayCounts[c.id] ?? 0} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState compact icon={Search} title="No matches" description="Try a different filter." />
          )}
        </>
      )}
    </PageTransition>
  );
}
