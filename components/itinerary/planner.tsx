"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, TouchSensor, closestCorners, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CalendarDays, Flag, GripVertical, List, MapPinned, Plus, Printer, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { reorderStops } from "@/actions/itinerary";
import type { CityVM, CountryVM, PlaceVM } from "@/lib/data";
import type { Booking, ItineraryDay, ItineraryItem, PlaceCategory } from "@/lib/types";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import { fmtDate, fmtRange, todayIso } from "@/lib/dates";
import { pluralize } from "@/lib/utils";
import { setUrlParam, useOpenSections, useViewParam } from "@/hooks/use-open-sections";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/motion";
import { GenerateDaysButton } from "@/components/itinerary/generate-days-button";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { useWorkspace } from "@/components/shell/workspace";
import { CompactDayRow, DayCard } from "./day-card";
import { CountryPicker, JumpToDay, type CountryLite } from "./planner-pickers";
import type { StopPin } from "./stop-row";

const VIEWS = ["detailed", "compact"] as const;
type Pin = StopPin & { lat: number; lng: number; title: string };

// A stop leaving an open day moves every day below it, so drop targets are measured throughout the drag.
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

function group(days: ItineraryDay[], items: ItineraryItem[]) {
  const out: Record<string, ItineraryItem[]> = {};
  for (const d of days) out[d.id] = [];
  for (const it of items) (out[it.day_id] ??= []).push(it);
  for (const k of Object.keys(out)) out[k]!.sort((a, b) => a.order_index - b.order_index);
  return out;
}

export function ItineraryPlanner({
  countries,
  country,
  days,
  items,
  cities,
  places,
  bookings,
  shiftDayIds,
  initialDayId,
  showTripName,
}: {
  countries: CountryLite[];
  country: CountryVM | null;
  days: ItineraryDay[];
  items: ItineraryItem[];
  cities: CityVM[];
  places: PlaceVM[];
  bookings: Booking[];
  shiftDayIds: string[];
  initialDayId: string | null;
  showTripName: boolean;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const [byDay, setByDay] = useState(() => group(days, items));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [originDay, setOriginDay] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "all");
  const activeCity = cities.some((c) => c.id === cityFilter) ? cityFilter : "all";
  const visibleDays = activeCity === "all" ? days : days.filter((d) => d.city_id === activeCity);
  const { open: openDays, toggle, show: showDay } = useOpenSections(initialDayId);
  const today = todayIso();
  const defaultDay = initialDayId ?? visibleDays.find((d) => d.date === today)?.id ?? visibleDays.find((d) => d.date && d.date >= today)?.id ?? visibleDays[0]?.id ?? null;
  const [selected, setSelected] = useState<string | null>(defaultDay);
  const [view, setView] = useViewParam(VIEWS);
  const compact = view === "compact";
  // The compact view opens only the selected day, until its header folds it.
  const [folded, setFolded] = useState(false);
  // The stop picked on the map or in the list: ringed in the list, enlarged on the map.
  const [activeStop, setActiveStop] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setByDay(group(days, items)), 0);
    return () => clearTimeout(t);
  }, [days, items]);

  useEffect(() => {
    if (!initialDayId) return;
    const t = setTimeout(() => document.getElementById(`day-${initialDayId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => clearTimeout(t);
  }, [initialDayId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const findDay = (id: string) => (id.startsWith("day:") ? id.slice(4) : Object.keys(byDay).find((k) => byDay[k]!.some((i) => i.id === id)));
  const activeItem = activeId ? Object.values(byDay).flat().find((i) => i.id === activeId) : null;

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOriginDay(findDay(String(e.active.id)) ?? null);
  };
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findDay(String(active.id));
    const to = findDay(String(over.id));
    if (!from || !to || from === to) return;
    setByDay((prev) => {
      const item = prev[from]!.find((i) => i.id === active.id);
      if (!item) return prev;
      const target = prev[to]!;
      const overIndex = target.findIndex((i) => i.id === over.id);
      const idx = overIndex >= 0 ? overIndex : target.length;
      return {
        ...prev,
        [from]: prev[from]!.filter((i) => i.id !== active.id),
        [to]: [...target.slice(0, idx), { ...item, day_id: to }, ...target.slice(idx)],
      };
    });
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const day = findDay(String(active.id));
    if (!day) return;
    if (day !== originDay) showDay(day);
    let next = byDay;
    if (over && !String(over.id).startsWith("day:")) {
      const list = byDay[day]!;
      const a = list.findIndex((i) => i.id === active.id);
      const b = list.findIndex((i) => i.id === over.id);
      if (a >= 0 && b >= 0 && a !== b) {
        next = { ...byDay, [day]: arrayMove(list, a, b) };
        setByDay(next);
      }
    }
    const affected = Array.from(new Set([day, originDay].filter(Boolean) as string[]));
    const updates = affected.flatMap((d) => next[d]!.map((i, idx) => ({ id: i.id, day_id: d, order_index: idx })));
    const changed = updates.filter((u) => {
      const orig = items.find((i) => i.id === u.id);
      return !orig || orig.day_id !== u.day_id || orig.order_index !== u.order_index;
    });
    if (!changed.length) return;
    start(async () => {
      const res = await reorderStops(changed);
      if (!res.ok) {
        toast.error(res.error);
        setByDay(group(days, items));
      }
    });
  };

  const selectedDay = days.find((d) => d.id === selected) ?? null;
  const cityName = useCallback((id: string | null) => cities.find((c) => c.id === id)?.name ?? null, [cities]);
  const dayIdsWithStops = useMemo(() => items.map((i) => i.day_id), [items]);

  // Every day's stops that have coordinates, numbered as they appear on that day's map.
  const pinsByDay = useMemo(() => {
    const placeById = new Map(places.map((p) => [p.id, p]));
    const out = new Map<string, Map<string, Pin>>();
    for (const [dayId, list] of Object.entries(byDay)) {
      const pins = new Map<string, Pin>();
      for (const it of list) {
        const place = it.place_id ? placeById.get(it.place_id) : undefined;
        if (place?.lat == null || place.lng == null) continue;
        const color = (PLACE_CATEGORY_META[place.category as PlaceCategory] ?? PLACE_CATEGORY_META.other).color;
        pins.set(it.id, { number: pins.size + 1, color, lat: place.lat, lng: place.lng, title: it.title });
      }
      out.set(dayId, pins);
    }
    return out;
  }, [byDay, places]);
  const markers = useMemo(
    () =>
      [...(pinsByDay.get(selected ?? "") ?? [])].map(([id, p]) => ({ id, lat: p.lat, lng: p.lng, label: `${p.number}. ${p.title}`, number: p.number, color: p.color, active: id === activeStop })),
    [pinsByDay, selected, activeStop],
  );
  const selectedCity = cities.find((c) => c.id === selectedDay?.city_id);

  const selectDay = (id: string) => {
    if (id !== selected) {
      setSelected(id);
      setActiveStop(null);
    }
    setFolded(false);
  };

  const onMarkerClick = (id: string) => {
    if (!selected) return;
    setActiveStop(id);
    if (compact) setFolded(false);
    else showDay(selected);
    // A closed day hasn't drawn its stops yet.
    setTimeout(() => document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };

  const focusStop = (dayId: string, itemId: string) => {
    selectDay(dayId);
    setActiveStop(itemId);
    setFocus((f) => ({ id: itemId, nonce: (f?.nonce ?? 0) + 1 }));
    // Below the wide layout the map sits under the list.
    if (!window.matchMedia("(min-width: 1024px)").matches) document.getElementById("day-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleDay = (id: string) => {
    if (!openDays.has(id)) selectDay(id);
    toggle(id);
  };

  const changeCity = (id: string) => {
    setCityFilter(id);
    setUrlParam("city", id === "all" ? null : id);
    const shown = id === "all" ? days : days.filter((d) => d.city_id === id);
    if (!shown.some((d) => d.id === selected)) {
      setSelected(shown[0]?.id ?? null);
      setActiveStop(null);
    }
  };

  const goToDay = (id: string) => {
    const day = days.find((d) => d.id === id);
    if (!day) return;
    if (activeCity !== "all" && day.city_id !== activeCity) changeCity("all");
    selectDay(id);
    showDay(id);
    setTimeout(() => document.getElementById(`day-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  if (!countries.length) {
    return (
      <PageTransition>
        <PageHeader eyebrow="Plan" title="Itinerary" />
        <EmptyState icon={Flag} title="Add a country to start planning" description="Each country gets its own day-by-day plan." action={<Button onClick={() => ws.openQuickAdd("country")}><Plus /> Add countries</Button>} />
      </PageTransition>
    );
  }

  const bookingsFor = (d: ItineraryDay) => bookings.filter((b) => d.date && b.start_at?.slice(0, 10) === d.date);

  return (
    <PageTransition>
      <PageHeader
        eyebrow="Plan"
        title="Itinerary"
        description={country ? `${country.flag} ${country.name} · ${fmtRange(country.arrive_date, country.depart_date)} · ${pluralize(visibleDays.length, "itinerary day")}` : undefined}
        actions={
          <>
            <CountryPicker countries={countries} value={country?.id ?? null} showTripName={showTripName} onChange={(id) => router.push(`/itinerary?country=${id}`)} />
            {country && days.length > 0 && (
              <Button variant="secondary" size="icon" asChild>
                <Link href={`/itinerary/print?country=${country.id}${activeCity !== "all" ? `&city=${activeCity}&scope=city` : ""}`} aria-label="Print or save as PDF" title="Print or save as PDF">
                  <Printer />
                </Link>
              </Button>
            )}
            {country && days.length > 0 && <GenerateDaysButton country={country} days={days} dayIdsWithStops={dayIdsWithStops} variant="secondary" />}
          </>
        }
      />
      {country && !days.length ? (
        <EmptyState
          icon={CalendarDays}
          title={`Plan ${country.name} day by day`}
          description={country.arrive_date && country.depart_date ? `Generate one day for each date from ${fmtDate(country.arrive_date)} to ${fmtDate(country.depart_date)}.` : "Set the country dates to get one day per date — or create a few blank days now."}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <GenerateDaysButton country={country} />
              {!country.arrive_date && (
                <Button variant="secondary" asChild>
                  <Link href={`/countries/${country.id}?edit=1`}>Set dates</Link>
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          {days.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <JumpToDay days={days} cityName={cityName} selected={selected} onJump={goToDay} />
              {cities.length > 0 && (
                <NativeSelect value={activeCity} onChange={(e) => changeCity(e.target.value)} aria-label="City" className="w-44">
                  <option value="all">All cities</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              <Segmented
                className="ml-auto"
                value={view}
                onChange={setView}
                options={[
                  { value: "detailed", label: "Detailed", icon: <Rows3 /> },
                  { value: "compact", label: "Compact", icon: <List /> },
                ]}
              />
            </div>
          )}
        <div className="grid gap-6 lg:grid-cols-12">
          <DndContext id="itinerary-dnd" sensors={sensors} measuring={MEASURING} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            {visibleDays.length ? (
              <ol className={`relative flex min-w-0 flex-col self-start before:absolute before:bottom-6 before:left-5 before:top-6 before:w-0.5 before:rounded-full before:bg-border sm:before:left-[22px] lg:col-span-7 ${compact ? "gap-2" : "gap-3"}`}>
                {visibleDays.map((d) => {
                  const expanded = compact ? selected === d.id && !folded : openDays.has(d.id);
                  return (
                    <li key={d.id}>
                      {compact && !expanded ? (
                        <CompactDayRow day={d} cityName={cityName(d.city_id)} stops={byDay[d.id]?.length ?? 0} selected={selected === d.id} onSelect={() => selectDay(d.id)} />
                      ) : (
                        <DayCard
                          day={d}
                          items={byDay[d.id] ?? []}
                          cities={cities}
                          places={places}
                          bookings={bookingsFor(d)}
                          allDays={days}
                          bigTimeShift={shiftDayIds.includes(d.id)}
                          selected={selected === d.id}
                          open={expanded}
                          highlightedStop={activeStop}
                          pins={pinsByDay.get(d.id)}
                          onSelect={() => selectDay(d.id)}
                          onToggle={compact ? () => setFolded(true) : () => toggleDay(d.id)}
                          onFocusStop={(itemId) => focusStop(d.id, itemId)}
                          onLocalChange={(itemId, patch) =>
                            setByDay((prev) => ({ ...prev, [d.id]: (prev[d.id] ?? []).map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }))
                          }
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="min-w-0 lg:col-span-7">
                <EmptyState
                  compact
                  icon={CalendarDays}
                  title={`No days in ${cities.find((c) => c.id === activeCity)?.name} yet`}
                  description="Open a day and choose this city to see it here."
                  action={<Button variant="secondary" onClick={() => changeCity("all")}>Show all days</Button>}
                />
              </div>
            )}
            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm font-medium shadow-lift ring-1 ring-accent/40">
                  <GripVertical className="size-4 text-muted" /> {activeItem.title}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
          <aside className="min-w-0 lg:col-span-5">
            {/* Pinned beside the days on wide screens, so the map stays in view as the list scrolls. */}
            <div id="day-map" className="card scroll-mt-20 overflow-hidden lg:sticky lg:top-20">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="eyebrow truncate">
                    Day map
                    {selectedDay ? ` · ${[selectedDay.date ? fmtDate(selectedDay.date, "EEE dd MMM") : null, selectedCity?.name, markers.length ? pluralize(markers.length, "pin") : null].filter(Boolean).join(" · ")}` : ""}
                  </p>
                  <p className="truncate font-display text-lg font-semibold">
                    {selectedDay ? `Day ${selectedDay.day_number}${selectedDay.title ? ` · ${selectedDay.title}` : ""}` : "Select a day"}
                  </p>
                </div>
                <MapPinned className="size-5 shrink-0 text-accent" />
              </div>
              <MapView
                className="h-[320px] lg:h-[calc(100dvh-11rem)] lg:max-h-[760px]"
                markers={markers}
                polyline
                onMarkerClick={onMarkerClick}
                focus={focus}
                fitKey={`${selected}-${markers.map((m) => m.id).join(",")}`}
                emptyLabel={selectedCity ? `Link stops to places in ${selectedCity.name} to map this day` : "Link stops to places with coordinates to see them here"}
              />
            </div>
          </aside>
        </div>
        </>
      )}
    </PageTransition>
  );
}
