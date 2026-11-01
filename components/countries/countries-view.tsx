"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Flag, GripVertical, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { reorderCountries } from "@/actions/countries";
import type { CountryVM } from "@/lib/data";
import type { DisplayStatus } from "@/lib/types";
import { GEO_STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { CountryCard } from "@/components/cards/cards";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/motion";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { FilterChip } from "@/components/ui/misc";
import { useWorkspace } from "@/components/shell/workspace";

type Sort = "route" | "date" | "name";
const STATUSES: (DisplayStatus | "all")[] = ["all", "ongoing", "planned", "visited", "wishlist"];

function SortableCard({ c, cityCount, dayCount, showTrip, draggable }: { c: CountryVM; cityCount: number; dayCount: number; showTrip: boolean; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id, disabled: !draggable });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative", isDragging && "z-20 opacity-90")}>
      <CountryCard c={c} cityCount={cityCount} dayCount={dayCount} showTrip={showTrip} />
      {draggable && (
        <button
          type="button"
          aria-label={`Drag to reorder ${c.name}`}
          className="absolute left-1/2 top-3 grid h-8 w-10 -translate-x-1/2 cursor-grab touch-none place-items-center rounded-full bg-black/40 text-white opacity-80 backdrop-blur-md hover:opacity-100 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
    </div>
  );
}

export function CountriesView({
  countries,
  cityCounts,
  dayCounts,
  trips,
  singleTrip,
}: {
  countries: CountryVM[];
  cityCounts: Record<string, number>;
  dayCounts: Record<string, number>;
  trips: { id: string; title: string }[];
  singleTrip: boolean;
}) {
  const ws = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DisplayStatus | "all">("all");
  const [continent, setContinent] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  const [sort, setSort] = useState<Sort>("route");
  const [order, setOrder] = useState(countries);
  const [, start] = useTransition();
  useEffect(() => {
    const t = setTimeout(() => setOrder(countries), 0);
    return () => clearTimeout(t);
  }, [countries]);

  const continents = useMemo(() => Array.from(new Set(countries.map((c) => c.region).filter(Boolean))).sort(), [countries]);
  const filtered = useMemo(() => {
    let list = order.filter(
      (c) =>
        (status === "all" || c.display === status) &&
        (continent === "all" || c.region === continent) &&
        (tripFilter === "all" || c.trip_id === tripFilter) &&
        (!query || c.name.toLowerCase().includes(query.toLowerCase())),
    );
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "date") list = [...list].sort((a, b) => (a.arrive_date ?? "9999").localeCompare(b.arrive_date ?? "9999"));
    return list;
  }, [order, status, continent, tripFilter, query, sort]);

  const draggable = singleTrip && sort === "route" && status === "all" && continent === "all" && !query;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(order, order.findIndex((c) => c.id === e.active.id), order.findIndex((c) => c.id === e.over!.id));
    setOrder(next);
    start(async () => {
      const res = await reorderCountries(next.map((c) => c.id));
      if (!res.ok) toast.error(res.error);
    });
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: countries.length };
    countries.forEach((c) => (m[c.display] = (m[c.display] ?? 0) + 1));
    return m;
  }, [countries]);

  return (
    <PageTransition>
      <PageHeader
        eyebrow="Plan"
        title="Countries"
        description={countries.length ? `${countries.length} on your route${singleTrip ? "" : " across all trips"}.` : "Build the route one flag at a time."}
        actions={
          <Button onClick={() => ws.openQuickAdd("country")}>
            <Plus /> Add countries
          </Button>
        }
      />
      {!countries.length ? (
        <EmptyState
          icon={Flag}
          title="Add your first country"
          description="Search the full list, tick as many as you like, then drag them into route order."
          action={
            <Button onClick={() => ws.openQuickAdd("country")}>
              <Plus /> Add countries
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search countries" className="pl-9" aria-label="Search countries" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <NativeSelect value={continent} onChange={(e) => setContinent(e.target.value)} aria-label="Continent" className="sm:w-40">
                  <option value="all">All continents</option>
                  {continents.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
                {!singleTrip && trips.length > 1 && (
                  <NativeSelect value={tripFilter} onChange={(e) => setTripFilter(e.target.value)} aria-label="Trip" className="sm:w-44">
                    <option value="all">All trips</option>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="sm:w-40">
                  <option value="route">Route order</option>
                  <option value="date">Arrival date</option>
                  <option value="name">Name</option>
                </NativeSelect>
              </div>
            </div>
            <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
              {STATUSES.map((s) => (
                <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                  {s !== "all" && <span className="size-2 rounded-full" style={{ background: GEO_STATUS_META[s].color }} />}
                  {s === "all" ? "All" : GEO_STATUS_META[s].label}
                  <span className="num text-xs opacity-60">{counts[s] ?? 0}</span>
                </FilterChip>
              ))}
            </div>
          </div>
          {filtered.length ? (
            <DndContext id="route-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={filtered.map((c) => c.id)} strategy={rectSortingStrategy}>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((c) => (
                    <SortableCard key={c.id} c={c} cityCount={cityCounts[c.id] ?? 0} dayCount={dayCounts[c.id] ?? 0} showTrip={!singleTrip} draggable={draggable} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <EmptyState compact icon={Search} title="No matches" description="Try another filter or search term." />
          )}
          {draggable && filtered.length > 1 && <p className="mt-4 text-center text-xs text-muted">Drag the handle on a card to change the route order.</p>}
        </>
      )}
    </PageTransition>
  );
}
