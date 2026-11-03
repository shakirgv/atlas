"use client";
import { useEffect, useState, useTransition } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { reorderCities } from "@/actions/cities";
import type { CityVM } from "@/lib/data";
import { CityCard } from "@/components/cards/cards";
import { cn } from "@/lib/utils";

function Item({ c, index, showNumber, placeCount, dayCount }: { c: CityVM; index: number; showNumber: boolean; placeCount: number; dayCount: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative", isDragging && "z-10 opacity-90")}>
      <CityCard c={c} placeCount={placeCount} dayCount={dayCount} order={showNumber ? index + 1 : undefined} />
      {showNumber && (
        <button
          type="button"
          className="absolute right-3 top-3 grid size-8 cursor-grab touch-none place-items-center rounded-full bg-black/40 text-white opacity-80 backdrop-blur-md hover:opacity-100 active:cursor-grabbing"
          aria-label={`Reorder ${c.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
    </div>
  );
}

/** City cards for one country. Drag the handle to set the order the route follows. */
export function CitySortGrid({ cities, places, days }: { cities: CityVM[]; places: { city_id: string | null }[]; days: { city_id: string | null }[] }) {
  const [items, setItems] = useState(cities);
  const [, start] = useTransition();
  useEffect(() => {
    const t = setTimeout(() => setItems(cities), 0);
    return () => clearTimeout(t);
  }, [cities]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      items,
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id),
    );
    setItems(next);
    start(async () => {
      const res = await reorderCities(next.map((i) => i.id));
      if (!res.ok) {
        toast.error(res.error);
        setItems(cities);
      }
    });
  };
  const showNumber = items.length > 1;
  return (
    <DndContext id="cities-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, i) => (
            <Item key={c.id} c={c} index={i} showNumber={showNumber} placeCount={places.filter((p) => p.city_id === c.id).length} dayCount={days.filter((d) => d.city_id === c.id).length} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
