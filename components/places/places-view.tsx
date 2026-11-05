"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarX2, ImageOff, Images, LayoutGrid, ListFilter, Map as MapIcon, MapPin, MapPinOff, Plus, Search, Star, Table2, X } from "lucide-react";
import type { PlaceVM } from "@/lib/data";
import { PLACE_STATUSES, type PhotoView, type PlaceCategory, type PlaceStatus } from "@/lib/types";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import { PLACE_STATUS_META } from "@/lib/status";
import { formatMoney } from "@/lib/money";
import { findDuplicatePlaces, type PlaceLinks } from "@/lib/place-duplicates";
import {
  citiesInCountry,
  DEFAULT_PLACE_FILTERS,
  filterPlaceList,
  hasPin,
  mergePlaceFilters,
  moreFilterCounts,
  parsePlaceFilters,
  withCountry,
  type PlaceListFilters,
} from "@/lib/place-list";
import { placeCategories } from "@/lib/city-pages";
import { pluralize } from "@/lib/utils";
import { Cover } from "@/components/common/cover";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { PlaceStatusChip } from "@/components/common/status-chip";
import { FlagChip } from "@/components/common/flag";
import { ManageCoversDialog } from "@/components/cover/manage-covers-dialog";
import { PlaceDialog } from "@/components/forms/place-dialog";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox, FilterChip, Segmented } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useWorkspace } from "@/components/shell/workspace";
import { DuplicateReview } from "./duplicate-review";
import { MarkVisitedButton, PlaceThumb } from "./place-row";
import { PlaceDrawerContent, type PlaceDayOption, type PlaceStop } from "./place-drawer";

type CityRef = { id: string; name: string; flag: string; trip_country_id: string };

const MORE_FILTERS = [
  { key: "notInItinerary", label: "Not in itinerary", icon: CalendarX2 },
  { key: "missingPin", label: "Missing pin", icon: MapPinOff },
  { key: "missingCover", label: "Missing cover", icon: ImageOff },
] as const;

export function PlacesView({
  places,
  countries,
  cities,
  scheduledIds,
  links,
  open,
  openPhotos,
  openAttribution,
  openStops,
  openDays,
  openCountry,
}: {
  places: PlaceVM[];
  countries: { id: string; name: string; flag: string }[];
  cities: CityRef[];
  scheduledIds: string[];
  links: Record<string, PlaceLinks>;
  open: PlaceVM | null;
  openPhotos: PhotoView[];
  openAttribution: string | null;
  openStops: PlaceStop[];
  openDays: PlaceDayOption[];
  openCountry: { id: string; name: string } | null;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const [filters, setFilters] = useState<PlaceListFilters>(() => parsePlaceFilters(params, { countryIds: countries.map((c) => c.id), cities }));
  const set = (patch: Partial<PlaceListFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const { query, country, city, category, status, view } = filters;
  const [editing, setEditing] = useState<PlaceVM | null>(null);
  const [coversOpen, setCoversOpen] = useState(false);

  // In the address, so switching between Cards, Table and Map, opening a place, or coming back keeps them.
  // Held back while typing: browsers limit how often the address can change.
  const filterQuery = mergePlaceFilters("", filters);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = mergePlaceFilters(window.location.search, filters);
      const href = `${window.location.pathname}${next ? `?${next}` : ""}`;
      if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterQuery]);

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(mergePlaceFilters(window.location.search, filters));
    if (id) next.set("open", id);
    else next.delete("open");
    router.push(`${window.location.pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const scheduled = useMemo(() => new Set(scheduledIds), [scheduledIds]);
  const ctx = useMemo(() => ({ cities, scheduled }), [cities, scheduled]);
  const filtered = useMemo(() => filterPlaceList(places, filters, ctx), [places, filters, ctx]);
  const counts = useMemo(() => moreFilterCounts(places, filters, ctx), [places, filters, ctx]);
  const cityOptions = citiesInCountry(cities, country);
  // Categories this scope has, so no chip leads to an empty list. A chosen one stays, so it can be cleared.
  const scoped = useMemo(() => filterPlaceList(places, { ...DEFAULT_PLACE_FILTERS, country, city }, ctx), [places, country, city, ctx]);
  const usedCategories = useMemo(() => {
    const present = placeCategories(scoped);
    return category !== "all" && !present.includes(category) ? [...present, category] : present;
  }, [scoped, category]);
  const duplicates = useMemo(() => findDuplicatePlaces(scoped), [scoped]);
  const moreActive = MORE_FILTERS.filter((m) => filters[m.key]);
  const anyFilter = mergePlaceFilters("", { ...filters, view: "grid" }) !== "";
  const pinnedCount = filtered.filter(hasPin).length;
  const unpinned = filtered.length - pinnedCount;
  const coverTripIds = ws.isAll ? ws.trips.map((t) => t.id) : ws.activeTripId ? [ws.activeTripId] : [];

  return (
    <PageTransition>
      <PageHeader
        eyebrow="Plan"
        title="Places"
        description={places.length ? `${places.length} sights and spots · ${places.filter((p) => p.status === "visited").length} visited` : "Sights, food spots, cafés — everything worth a detour."}
        actions={
          <>
            {places.length > 0 && (
              <Button variant="secondary" onClick={() => setCoversOpen(true)}>
                <Images /> Manage covers
              </Button>
            )}
            <Button onClick={() => ws.openQuickAdd({ kind: "place", cityId: city !== "all" ? city : undefined })}>
              <Plus /> Add place
            </Button>
          </>
        }
      />
      {coversOpen && <ManageCoversDialog tab="place" tripIds={coverTripIds} onOpenChange={setCoversOpen} />}
      {!places.length ? (
        <EmptyState
          icon={MapPin}
          title={cities.length ? "Save your first place" : "Add a city first"}
          description={cities.length ? "Search by name, drop a pin, or just type it. Photos are fetched automatically." : "Places belong to cities. Add a few cities, then come back."}
          action={
            <Button onClick={() => ws.openQuickAdd(cities.length ? "place" : "city")}>
              <Plus /> {cities.length ? "Add a place" : "Add cities"}
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(e) => set({ query: e.target.value })} placeholder="Search places" className="pl-9" aria-label="Search places" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {countries.length > 1 && (
                <NativeSelect value={country} onChange={(e) => setFilters((f) => withCountry(f, e.target.value, cities))} aria-label="Country" className="sm:w-44">
                  <option value="all">All countries</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              <NativeSelect value={city} onChange={(e) => set({ city: e.target.value })} aria-label="City" className="sm:w-44">
                <option value="all">{country === "all" ? "All cities" : `All cities in ${countries.find((c) => c.id === country)?.name ?? "this country"}`}</option>
                {cityOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={status} onChange={(e) => set({ status: e.target.value as PlaceStatus | "all" })} aria-label="Status" className="sm:w-36">
                <option value="all">Any status</option>
                {PLACE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PLACE_STATUS_META[s].label}
                  </option>
                ))}
              </NativeSelect>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" className="justify-start" data-testid="more-filters">
                    <ListFilter /> More filters
                    {moreActive.length > 0 && <span className="num rounded-full bg-accent-soft px-1.5 text-xs">{moreActive.length}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2">
                  <ul className="flex flex-col">
                    {MORE_FILTERS.map((m) => (
                      <li key={m.key}>
                        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-ink/5">
                          <Checkbox checked={filters[m.key]} onCheckedChange={(v) => set({ [m.key]: v === true })} />
                          <m.icon className="size-4 text-muted" />
                          <span className="flex-1">{m.label}</span>
                          <span className="num text-xs text-muted">{counts[m.key]}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
              <Segmented
                value={view}
                onChange={(v) => set({ view: v })}
                className="col-span-2 justify-self-start"
                options={[
                  { value: "grid", label: "Cards", icon: <LayoutGrid /> },
                  { value: "table", label: "Table", icon: <Table2 /> },
                  { value: "map", label: "Map", icon: <MapIcon /> },
                ]}
              />
            </div>
          </div>
          <div className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            <FilterChip active={category === "all"} onClick={() => set({ category: "all" })}>
              All
            </FilterChip>
            {usedCategories.map((c) => {
              const m = PLACE_CATEGORY_META[c];
              return (
                <FilterChip key={c} active={category === c} onClick={() => set({ category: c })}>
                  <m.icon style={{ color: category === c ? undefined : m.color }} /> {m.label}
                </FilterChip>
              );
            })}
          </div>
          {(moreActive.length > 0 || anyFilter) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm" data-testid="active-filters">
              <span className="num text-muted">
                {filtered.length} of {pluralize(places.length, "place")}
              </span>
              {moreActive.map((m) => (
                <FilterChip key={m.key} active onClick={() => set({ [m.key]: false })} aria-label={`Remove the ${m.label} filter`}>
                  <m.icon /> {m.label} <X />
                </FilterChip>
              ))}
              {anyFilter && (
                <button type="button" className="text-[13px] text-accent hover:underline" onClick={() => setFilters({ ...DEFAULT_PLACE_FILTERS, view })}>
                  Clear filters
                </button>
              )}
            </div>
          )}
          {duplicates.length > 0 && (
            <div className="mb-5">
              <DuplicateReview places={places} duplicates={duplicates} links={links} />
            </div>
          )}

          {!filtered.length ? (
            <EmptyState compact icon={Search} title="No matches" description="Try different filters." />
          ) : view === "grid" ? (
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => {
                const m = PLACE_CATEGORY_META[p.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
                return (
                  <StaggerItem key={p.id}>
                    <div role="button" tabIndex={0} onClick={() => setOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(p.id)} className="card card-hover block cursor-pointer overflow-hidden text-left">
                      <Cover src={p.cover_url} alt={p.name} seed={p.id} icon={m.icon} className="aspect-[4/3]">
                        <div className="photo-gradient absolute inset-0" />
                        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                          {p.country_code ? <FlagChip code={p.country_code} size="sm" onPhoto /> : <span />}
                          <PlaceStatusChip status={p.status as PlaceStatus} onPhoto size="sm" />
                        </div>
                        <div className="absolute inset-x-3.5 bottom-3 text-white">
                          <p className="flex items-center gap-1.5 text-xs text-white/85">
                            <m.icon className="size-3.5" /> {m.label} · {p.city_name}
                          </p>
                          <h3 className="line-clamp-2 text-lg font-semibold leading-tight">{p.name}</h3>
                        </div>
                      </Cover>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                        <span className="flex items-center gap-1 text-sm text-muted">
                          {p.rating ? (
                            <>
                              <Star className="size-3.5 fill-planned text-planned" /> {p.rating}
                            </>
                          ) : (
                            "Not rated"
                          )}
                          {p.cost_estimate != null && <span className="num ml-2">≈ {formatMoney(Number(p.cost_estimate), p.cost_currency ?? "USD")}</span>}
                        </span>
                        <MarkVisitedButton place={p} className="size-8" />
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          ) : view === "table" ? (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Place</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Visited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const m = PLACE_CATEGORY_META[p.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
                    return (
                      <tr key={p.id} onClick={() => setOpen(p.id)} className="cursor-pointer hover:bg-ink/[0.03]">
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-3">
                            <PlaceThumb place={p} className="size-9 rounded-lg" />
                            <span className="font-medium">{p.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted">{p.city_name}</td>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-1.5">
                            <m.icon className="size-4" style={{ color: m.color }} /> {m.label}
                          </span>
                        </td>
                        <td className="num px-4 py-2">{p.rating ? `★ ${p.rating}` : "—"}</td>
                        <td className="px-4 py-2">
                          <PlaceStatusChip status={p.status as PlaceStatus} size="sm" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <MarkVisitedButton place={p} className="ml-auto size-8" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {unpinned > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted" data-testid="unpinned-count">
                  <MapPinOff className="size-4 shrink-0" />
                  {unpinned === filtered.length ? `None of these ${pluralize(unpinned, "place")} has coordinates.` : `${pluralize(unpinned, "place")} of ${filtered.length} ${unpinned === 1 ? "has" : "have"} no coordinates and ${unpinned === 1 ? "isn't" : "aren't"} on the map.`}
                  <button type="button" className="text-accent hover:underline" onClick={() => set({ missingPin: true, view: "table" })}>
                    Show {unpinned === 1 ? "it" : "them"}
                  </button>
                </p>
              )}
              <MapView
                cluster
                className="h-[62vh] min-h-96 rounded-[16px] border border-border"
                markers={filtered.filter(hasPin).map((p) => {
                  const m = PLACE_CATEGORY_META[p.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
                  return { id: p.id, lat: p.lat!, lng: p.lng!, label: p.name, color: m.color, glyph: p.status === "visited" ? "✓" : "" };
                })}
                onMarkerClick={(id) => setOpen(id)}
                emptyLabel="No pins to show here"
              />
            </div>
          )}
        </>
      )}
      <ResponsiveSheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)} title={open?.name ?? "Place"}>
        {open && (
          <PlaceDrawerContent
            key={open.id}
            place={open}
            photos={openPhotos}
            attribution={openAttribution}
            stops={openStops}
            days={openDays}
            country={openCountry}
            onEdit={() => {
              setEditing(open);
              setOpen(null);
            }}
            onDeleted={() => setOpen(null)}
          />
        )}
      </ResponsiveSheet>
      {editing && <PlaceDialog open onOpenChange={(o) => !o && setEditing(null)} place={editing} />}
    </PageTransition>
  );
}
