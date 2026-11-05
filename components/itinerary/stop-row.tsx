"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Link2, MapPin, MapPinPlus, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createPlaceFromStop, deleteStop, toggleStop, updateStop } from "@/actions/itinerary";
import { STOP_TYPES, type ItineraryItem, type StopType } from "@/lib/types";
import { STOP_TYPE_META } from "@/lib/icons";
import { fmtTime } from "@/lib/dates";
import type { PlaceVM } from "@/lib/data";
import { cn } from "@/lib/utils";
import { requestCover } from "@/hooks/use-auto-cover";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** A stop's marker on the day map: its number there and its colour. */
export type StopPin = { number: number; color: string };

const INTERACTIVE = "button, a, input, textarea, select, label, [role=checkbox], [role=menu], [data-radix-popper-content-wrapper]";

export function StopRow({
  item,
  places,
  highlighted,
  pin,
  onFocusPin,
  onChanged,
}: {
  item: ItineraryItem;
  places: PlaceVM[];
  highlighted?: boolean;
  pin?: StopPin | null;
  /** Shows this stop's marker on the day map. */
  onFocusPin?: () => void;
  onChanged?: (patch: Partial<ItineraryItem>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { type: "stop", dayId: item.day_id } });
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const [draft, setDraft] = useState({ title: item.title, type: item.type as StopType, start_time: fmtTime(item.start_time), end_time: fmtTime(item.end_time), place_id: item.place_id ?? "", notes: item.notes ?? "" });
  const meta = STOP_TYPE_META[item.type as StopType] ?? STOP_TYPE_META.activity;
  const place = places.find((p) => p.id === item.place_id);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Failed");
      if (success) toast.success(success);
    });

  if (editing) {
    return (
      <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="rounded-xl bg-surface-2 p-3 ring-1 ring-accent/40">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const res = await updateStop(item.id, draft);
              if (res.ok) setEditing(false);
              return res;
            }, "Stop updated");
          }}
        >
          <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Title" autoFocus />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} aria-label="Start time" />
            <Input type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} aria-label="End time" />
            <NativeSelect value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as StopType })} aria-label="Type">
              {STOP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {STOP_TYPE_META[t].label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={draft.place_id} onChange={(e) => setDraft({ ...draft, place_id: e.target.value })} aria-label="Linked place">
              <option value="">No place</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" rows={2} className="min-h-14" aria-label="Notes" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X /> Cancel
            </Button>
            <Button size="sm" type="submit" disabled={pending}>
              <Check /> Save
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      id={`stop-${item.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // Clicking the row anywhere but its controls finds the stop on the map.
      onClick={pin && onFocusPin ? (e) => !(e.target as HTMLElement).closest(INTERACTIVE) && onFocusPin() : undefined}
      className={cn(
        "group flex scroll-mt-28 scroll-mb-6 items-start gap-2 rounded-xl bg-surface px-1.5 py-1.5 ring-1 ring-transparent transition-shadow",
        !highlighted && "hover:ring-border",
        pin && onFocusPin && "cursor-pointer",
        isDragging && "z-20 shadow-lift ring-accent/40",
        highlighted && "ring-2 ring-accent",
      )}
    >
      <button type="button" className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted opacity-60 hover:bg-ink/5 group-hover:opacity-100 active:cursor-grabbing max-md:opacity-100" aria-label={`Drag ${item.title}`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <span className="pt-1.5">
        <Checkbox
          checked={item.done}
          aria-label={item.done ? "Mark not done" : "Mark done"}
          onCheckedChange={(v) => {
            onChanged?.({ done: Boolean(v) });
            run(() => toggleStop(item.id, Boolean(v)));
          }}
        />
      </span>
      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-baseline gap-2">
          {pin && (
            <button
              type="button"
              onClick={onFocusPin}
              aria-label={`Show ${item.title} on the map (marker ${pin.number})`}
              title="Show on the map"
              className="num grid size-5 shrink-0 translate-y-[3px] place-items-center self-start rounded-full text-[10px] font-semibold text-white ring-2 ring-surface transition-transform hover:scale-110"
              style={{ background: pin.color }}
            >
              {pin.number}
            </button>
          )}
          {item.start_time && (
            <span className="num shrink-0 text-xs font-semibold text-muted">
              {fmtTime(item.start_time)}
              {item.end_time ? `–${fmtTime(item.end_time)}` : ""}
            </span>
          )}
          <button type="button" onClick={() => setEditing(true)} className={cn("min-w-0 text-left text-sm font-medium leading-snug hover:text-accent", item.done && "text-muted line-through")}>
            {item.title}
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-2 px-2 text-[11px] font-medium text-muted ring-1 ring-border">
            <meta.icon className="size-3" style={{ color: meta.color }} /> {meta.label}
          </span>
          {place && (
            <Link href={`/places?open=${place.id}`} className="inline-flex h-6 items-center gap-1 rounded-full bg-accent-soft px-2 text-[11px] font-medium text-ink hover:underline">
              <MapPin className="size-3 text-accent" /> {place.name}
            </Link>
          )}
          {item.notes && <span className="truncate text-xs text-muted">{item.notes}</span>}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="grid size-8 shrink-0 place-items-center rounded-lg text-muted opacity-60 hover:bg-ink/5 group-hover:opacity-100 max-md:opacity-100" aria-label="Stop actions">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Edit stop
          </DropdownMenuItem>
          {!item.place_id ? (
            <DropdownMenuItem
              onSelect={() =>
                start(async () => {
                  const res = await createPlaceFromStop(item.id);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(`Saved “${item.title}” as a place in ${res.data.cityName}`);
                  void requestCover("place", res.data.placeId);
                })
              }
            >
              <MapPinPlus /> Create place from this stop
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => run(() => updateStop(item.id, { place_id: null }), "Unlinked")}>
              <Link2 /> Unlink place
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={async () => (await confirm({ title: `Delete “${item.title}”?`, confirmLabel: "Delete stop" })) && run(() => deleteStop(item.id), "Stop removed")}>
            <Trash2 /> Delete stop
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
