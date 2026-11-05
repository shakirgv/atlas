"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, ChevronDown, Images, Map as MapIcon, Rows3, SearchX } from "lucide-react";
import type { MemoryVM } from "@/lib/data";
import { fmtDate, fmtMonth, monthKey } from "@/lib/dates";
import { filterMemories, filterOptions, NO_FILTERS, writeFilters, type MemoryFilters } from "@/lib/memory-filters";
import type { LinkDay, LinkPlace } from "@/lib/memory-links";
import { cn, pluralize } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/motion";
import { MemoryComposerCard, MemoryEditDialog } from "@/components/forms/memory-composer";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemoryCard } from "./memory-card";
import { MemoryFilterBar } from "./memory-filter-bar";
import { MemoryMap } from "./memory-map";
import { MemoryPhotoViewer, type ViewerItem } from "./memory-photo-viewer";

type CityLite = { id: string; name: string; trip_country_id: string; lat: number | null; lng: number | null };
type CountryLite = { id: string; code: string; name: string; flag: string };
const TABS = ["timeline", "gallery", "map"];

export function MemoriesView({
  memories,
  countries,
  cities,
  places,
  days,
  focus,
  initialTab,
  initialFilters,
}: {
  memories: MemoryVM[];
  countries: CountryLite[];
  cities: CityLite[];
  places: LinkPlace[];
  days: LinkDay[];
  focus: string | null;
  initialTab: string;
  initialFilters: MemoryFilters;
}) {
  const [tab, setTab] = useState(TABS.includes(initialTab) ? initialTab : "timeline");
  const [filters, setFilters] = useState<MemoryFilters>(initialFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(focus);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number; openable: boolean } | null>(null);

  const ctx = useMemo(() => ({ countries, cities, places }), [countries, cities, places]);
  const options = useMemo(() => filterOptions(memories, ctx), [memories, ctx]);
  const shown = useMemo(() => filterMemories(memories, filters, ctx), [memories, filters, ctx]);
  const editing = editingId ? memories.find((m) => m.id === editingId) : undefined;

  const byId = useMemo(
    () => ({
      country: new Map(countries.map((c) => [c.id, c])),
      city: new Map(cities.map((c) => [c.id, c])),
      place: new Map(places.map((p) => [p.id, p])),
      day: new Map(days.map((d) => [d.id, d])),
    }),
    [countries, cities, places, days],
  );
  const linksOf = useCallback(
    (m: MemoryVM) => {
      const place = m.place_id ? byId.place.get(m.place_id) : undefined;
      const city = byId.city.get(m.city_id ?? place?.city_id ?? "");
      const country = byId.country.get(m.trip_country_id ?? city?.trip_country_id ?? "");
      const day = m.itinerary_day_id ? byId.day.get(m.itinerary_day_id) : undefined;
      return { place, city, country, day };
    },
    [byId],
  );
  const whereOf = useCallback(
    (m: MemoryVM) => {
      const { place, city, country } = linksOf(m);
      return [place?.name, city?.name, country ? `${country.flag} ${country.name}` : null].filter(Boolean).join(" · ") || null;
    },
    [linksOf],
  );

  // Filters live in the URL, so a reload or a shared link keeps them.
  useEffect(() => {
    window.history.replaceState(null, "", writeFilters(new URL(window.location.href), filters));
  }, [filters]);

  const months = useMemo(() => {
    const groups = new Map<string, MemoryVM[]>();
    for (const m of shown) {
      const k = monthKey(m.date);
      groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    return Array.from(groups.entries());
  }, [shown]);

  const scrollTo = (id: string) => setTimeout(() => document.getElementById(`memory-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);

  useEffect(() => {
    if (focus) scrollTo(focus);
  }, [focus]);

  const onTab = (v: string) => {
    setTab(v);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", v);
    window.history.replaceState(null, "", url);
  };

  /** From the gallery or the map: show the memory in the timeline, its month unfolded. */
  const openMemory = (id: string) => {
    const m = memories.find((x) => x.id === id);
    if (!m) return;
    if (!shown.some((x) => x.id === id)) setFilters(NO_FILTERS);
    setCollapsed((s) => {
      const next = new Set(s);
      next.delete(monthKey(m.date));
      return next;
    });
    setHighlight(id);
    onTab("timeline");
    scrollTo(id);
  };

  const toggleMonth = (key: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const galleryItems = useMemo<ViewerItem[]>(() => shown.flatMap((m) => m.photos.map((photo) => ({ photo, memory: m, where: whereOf(m) }))), [shown, whereOf]);
  const photoTotal = memories.reduce((s, m) => s + m.photos.length, 0);
  const onTag = (t: string) => setFilters((f) => ({ ...f, tag: f.tag === t ? "" : t }));
  const allCollapsed = months.length > 0 && months.every(([k]) => collapsed.has(k));

  const noMatch = (
    <EmptyState
      compact
      icon={SearchX}
      title="No memories match"
      description="Try other words, or clear a filter."
      action={
        <Button size="sm" variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
          Clear filters
        </Button>
      }
    />
  );

  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader eyebrow="Track" title="Memories" description={memories.length ? `${pluralize(memories.length, "memory", "memories")} · ${pluralize(photoTotal, "photo")}` : "Notes and photos from before, during and after the trip."} />
      <MemoryComposerCard />
      {!memories.length ? (
        <EmptyState icon={Camera} title="Your journal is empty" description="Write the first memory above — a sentence, a mood, a handful of photos. Dates and GPS come from your photos." />
      ) : (
        <Tabs value={tab} onValueChange={onTab}>
          <div className="flex flex-col gap-4">
            <TabsList aria-label="Memory views">
              <TabsTrigger value="timeline">
                <Rows3 /> Timeline
              </TabsTrigger>
              <TabsTrigger value="gallery">
                <Images /> Gallery
              </TabsTrigger>
              <TabsTrigger value="map">
                <MapIcon /> Map
              </TabsTrigger>
            </TabsList>
            <MemoryFilterBar filters={filters} onChange={setFilters} options={options} shown={shown.length} total={memories.length} />
          </div>

          <TabsContent value="timeline">
            {!shown.length ? (
              noMatch
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col gap-6">
                {months.length > 1 && (
                  <div className="-mb-3 flex justify-end">
                    <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(months.map(([k]) => k)))} className="text-sm font-medium text-accent hover:underline">
                      {allCollapsed ? "Expand all months" : "Collapse all months"}
                    </button>
                  </div>
                )}
                {months.map(([key, list]) => {
                  const open = !collapsed.has(key);
                  const photos = list.reduce((n, m) => n + m.photos.length, 0);
                  return (
                    <section key={key} aria-label={fmtMonth(key)}>
                      <h2 className="sticky top-16 z-10 -mx-1 bg-bg/85 px-1 py-1.5 backdrop-blur md:top-[72px]">
                        <button type="button" onClick={() => toggleMonth(key)} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
                          <ChevronDown className={cn("size-5 shrink-0 text-muted transition-transform", !open && "-rotate-90")} />
                          <span className="text-[26px] font-semibold">{fmtMonth(key)}</span>
                          <span className="num text-sm font-normal text-muted">
                            {pluralize(list.length, "memory", "memories")}
                            {photos ? ` · ${pluralize(photos, "photo")}` : ""}
                          </span>
                        </button>
                      </h2>
                      {open && (
                        <div className="mt-3 flex flex-col gap-5">
                          {list.map((m) => {
                            const { country, city, place, day } = linksOf(m);
                            return (
                              <MemoryCard
                                key={m.id}
                                m={m}
                                country={country}
                                city={city}
                                place={place}
                                day={day}
                                dayCity={day?.city_id ? byId.city.get(day.city_id)?.name : null}
                                highlighted={highlight === m.id}
                                activeTag={filters.tag}
                                onEdit={() => setEditingId(m.id)}
                                onTag={onTag}
                                onPhotos={() => setViewer({ items: m.photos.map((photo) => ({ photo, memory: m, where: whereOf(m) })), index: 0, openable: false })}
                              />
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="gallery">
            {!shown.length ? (
              noMatch
            ) : galleryItems.length ? (
              <>
                <p className="num mb-3 text-sm text-muted">
                  {pluralize(galleryItems.length, "photo")} from {pluralize(new Set(galleryItems.map((i) => i.memory.id)).size, "memory", "memories")}
                </p>
                <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                  {galleryItems.map((item, i) => (
                    <li key={item.photo.id}>
                      <button
                        type="button"
                        onClick={() => setViewer({ items: galleryItems, index: i, openable: true })}
                        className="group relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface-2"
                        aria-label={`Open photo from ${item.memory.title ?? fmtDate(item.memory.date)}`}
                      >
                        {item.photo.thumb_url && <img src={item.photo.thumb_url} alt={item.photo.caption ?? item.memory.title ?? ""} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-8 text-left text-white">
                          <span className="block truncate text-[13px] font-medium">{item.memory.title ?? fmtDate(item.memory.date)}</span>
                          <span className="block truncate text-[11px] text-white/80">{[fmtDate(item.photo.taken_at ?? item.memory.date, "d MMM yyyy"), linksOf(item.memory).city?.name].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState compact icon={Images} title="No photos here yet" description="Add photos to a memory and they appear in this gallery." />
            )}
          </TabsContent>

          <TabsContent value="map">
            <MemoryMap memories={shown} places={places} cities={cities} onOpen={openMemory} />
          </TabsContent>
        </Tabs>
      )}
      {viewer && <MemoryPhotoViewer items={viewer.items} index={viewer.index} onClose={() => setViewer(null)} onOpenMemory={viewer.openable ? openMemory : undefined} />}
      {editing && <MemoryEditDialog memory={editing} onOpenChange={(o) => !o && setEditingId(null)} />}
    </PageTransition>
  );
}
