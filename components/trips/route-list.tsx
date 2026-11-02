"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { reorderCountries } from "@/actions/countries";
import { fmtRange, daysBetween } from "@/lib/dates";
import type { CountryVM } from "@/lib/data";
import { GeoStatusChip } from "@/components/common/status-chip";
import { cn } from "@/lib/utils";
import type { LegView } from "@/lib/server/route-data";
import { JetLagChip } from "@/components/route/jetlag-chip";
import { TransportChip } from "@/components/route/transport-chip";
import { VerdictChip } from "@/components/climate/verdict-chip";
import { useClimate } from "@/hooks/use-climate";
import { verdictReason, worstVerdict, type ClimateStop } from "@/lib/climate";

function Row({ c, index, leg, climate }: { c: CountryVM; index: number; leg: LegView | null; climate: ReturnType<typeof worstVerdict> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const nights = daysBetween(c.arrive_date, c.depart_date);
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative flex flex-col", isDragging && "z-10")}>
      {(leg || index === 0) && (
        <div className="flex flex-wrap items-center gap-1.5 py-1.5 pl-[52px]">
          <span className="text-[11px] text-muted">{leg?.fromHome ? `From ${leg.fromName}` : index === 0 ? "Start" : ""}</span>
          <TransportChip mode={leg?.mode ?? c.transport_mode ?? null} note={leg?.note ?? c.transport_note} owner={leg?.owner ?? { kind: "country", id: c.id }} toName={c.name} />
          <JetLagChip jetlag={leg?.jetlag} from={leg?.fromName} />
        </div>
      )}
      <div className={cn("flex items-center gap-2 rounded-xl bg-surface px-1.5 py-1.5 ring-1 ring-border", isDragging && "shadow-lift ring-accent/40")}>
      <button
        type="button"
        className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted hover:bg-ink/5 active:cursor-grabbing"
        aria-label={`Reorder ${c.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-bg">{index + 1}</span>
      <Link href={`/countries/${c.id}`} className="group flex min-w-0 flex-1 items-center gap-3 py-1 pr-2">
        <span className="text-2xl leading-none">{c.flag}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{c.name}</span>
          <span className="truncate text-xs text-muted">
            {fmtRange(c.arrive_date, c.depart_date)}
            {nights ? ` · ${nights} days` : ""}
          </span>
        </span>
        {climate && <VerdictChip verdict={climate.verdict} size="sm" title={`${climate.stop.name}. ${verdictReason(climate.month)}`} />}
        <GeoStatusChip status={c.display} size="sm" className="max-sm:hidden" />
        <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
      </div>
    </li>
  );
}

/** Drag to reorder the route. */
export function RouteList({ countries, legs = {}, climateStops = {} }: { countries: CountryVM[]; legs?: Record<string, LegView | null>; climateStops?: Record<string, ClimateStop[]> }) {
  const [items, setItems] = useState(countries);
  const allStops = useMemo(() => Object.values(climateStops).flat(), [climateStops]);
  const { data: climate } = useClimate(allStops);
  const [, start] = useTransition();
  useEffect(() => {
    const t = setTimeout(() => setItems(countries), 0);
    return () => clearTimeout(t);
  }, [countries]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, from, to);
    setItems(next);
    start(async () => {
      const res = await reorderCountries(next.map((i) => i.id));
      if (!res.ok) {
        toast.error(res.error);
        setItems(countries);
      }
    });
  };
  return (
    <DndContext id="route-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col">
          {items.map((c, i) => (
            <Row key={c.id} c={c} index={i} leg={legs[c.id] ?? null} climate={worstVerdict(climateStops[c.id] ?? [], climate)} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
