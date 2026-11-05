"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowRightLeft, ChevronDown, Copy, CornerDownLeft, Loader2, MoonStar, MoreHorizontal, NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addStop, deleteDay, duplicateDay, moveDay, updateDay } from "@/actions/itinerary";
import { fmtDate, todayIso } from "@/lib/dates";
import { parseStop } from "@/lib/parse-stop";
import type { CityVM, PlaceVM } from "@/lib/data";
import type { Booking, ItineraryDay, ItineraryItem } from "@/lib/types";
import { BOOKING_TYPE_META } from "@/lib/icons";
import { cn, pluralize } from "@/lib/utils";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StopRow, type StopPin } from "./stop-row";

export function DayCard({
  day,
  items,
  cities,
  places,
  bookings,
  allDays,
  bigTimeShift,
  selected,
  open,
  highlightedStop,
  pins,
  onSelect,
  onToggle,
  onFocusStop,
  onLocalChange,
}: {
  day: ItineraryDay;
  items: ItineraryItem[];
  cities: CityVM[];
  places: PlaceVM[];
  bookings: Booking[];
  allDays: ItineraryDay[];
  bigTimeShift?: boolean;
  selected: boolean;
  open: boolean;
  highlightedStop: string | null;
  /** The day's stops that are on the map, by stop id. */
  pins?: Map<string, StopPin>;
  onSelect: () => void;
  onToggle: () => void;
  onFocusStop?: (itemId: string) => void;
  onLocalChange: (itemId: string, patch: Partial<ItineraryItem>) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.id}`, data: { type: "day", dayId: day.id } });
  const [quick, setQuick] = useState("");
  const [title, setTitle] = useState(day.title ?? "");
  const [notes, setNotes] = useState(day.notes ?? "");
  const [notesOpen, setNotesOpen] = useState(Boolean(day.notes));
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const isToday = day.date === todayIso();
  const done = items.filter((i) => i.done).length;
  const preview = quick.trim() ? parseStop(quick) : null;
  const cityName = cities.find((c) => c.id === day.city_id)?.name;
  const summary = [cityName, pluralize(items.length, "stop"), bookings.length ? pluralize(bookings.length, "booking") : null, done ? `${done} done` : null].filter(Boolean).join(" · ");

  useEffect(() => {
    const t = setTimeout(() => {
      setTitle(day.title ?? "");
      setNotes(day.notes ?? "");
    }, 0);
    return () => clearTimeout(t);
  }, [day.title, day.notes]);

  const save = (patch: Parameters<typeof updateDay>[1]) =>
    start(async () => {
      const res = await updateDay(day.id, patch);
      if (!res.ok) toast.error(res.error);
    });

  const submitQuick = (e: React.FormEvent) => {
    e.preventDefault();
    const text = quick.trim();
    if (!text) return;
    const parsed = parseStop(text);
    // Auto-link a place whose name appears in the stop.
    const lower = parsed.title.toLowerCase();
    const match = places.find((p) => lower.includes(p.name.toLowerCase()) || p.name.toLowerCase() === lower);
    setQuick("");
    start(async () => {
      const res = await addStop(day.id, { ...parsed, place_id: match?.id ?? null, notes: null });
      if (!res.ok) {
        toast.error(res.error);
        setQuick(text);
      }
      inputRef.current?.focus();
    });
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  return (
    <article
      id={`day-${day.id}`}
      onClick={onSelect}
      className={cn("relative pl-12 sm:pl-14", "scroll-mt-24")}
      aria-label={`Day ${day.day_number}`}
    >
      <button
        type="button"
        onClick={toggle}
        tabIndex={-1}
        aria-hidden
        className={cn(
          "absolute left-0 top-4 z-10 grid size-10 place-items-center rounded-full border-2 font-display text-base font-semibold transition-colors sm:size-11",
          selected ? "border-accent bg-accent text-white" : isToday ? "border-accent bg-surface text-accent" : "border-border bg-surface text-ink",
        )}
      >
        <span className="num">{day.day_number}</span>
      </button>
      {/* The whole card takes drops, so a stop can be dragged onto a closed day. */}
      <div ref={setNodeRef} className={cn("card p-4 transition-shadow sm:p-5", selected && "ring-2 ring-accent/50", isOver && "ring-2 ring-visited/60")}>
        <header className="flex items-start gap-1.5">
          <button type="button" onClick={toggle} aria-expanded={open} className="flex min-w-0 flex-1 items-start gap-2 text-left">
            <span className="min-w-0 flex-1">
              <span className="eyebrow flex flex-wrap items-center gap-2">
                {day.date ? fmtDate(day.date, "EEEE, dd MMM") : `Day ${day.day_number}`}
                {isToday && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">TODAY</span>}
              </span>
              {!open && title && <span className="mt-0.5 block truncate font-display text-[22px] font-semibold leading-tight">{title}</span>}
              {!open && <span className="mt-1 block truncate text-sm text-muted">{summary}</span>}
            </span>
            <ChevronDown className={cn("mt-1 size-5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger className="grid size-9 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label="Day actions">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={() => {
                    setNotesOpen(true);
                    if (!open) onToggle();
                  }}
                >
                  <NotebookPen /> Add notes
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => start(async () => { const r = await duplicateDay(day.id); if (!r.ok) toast.error(r.error); else toast.success("Day duplicated at the end"); })}>
                  <Copy /> Duplicate day
                </DropdownMenuItem>
                {allDays.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Move to…</DropdownMenuLabel>
                    <div className="max-h-48 overflow-y-auto">
                      {allDays
                        .filter((d) => d.id !== day.id)
                        .map((d) => (
                          <DropdownMenuItem key={d.id} onSelect={() => start(async () => { const r = await moveDay(day.id, d.day_number); if (!r.ok) toast.error(r.error); })}>
                            <ArrowRightLeft /> Day {d.day_number}
                            {d.date ? ` · ${fmtDate(d.date, "dd MMM")}` : ""}
                          </DropdownMenuItem>
                        ))}
                    </div>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  destructive
                  onSelect={async () => {
                    if (!(await confirm({ title: `Delete day ${day.day_number}?`, description: items.length ? `Its ${items.length} stop(s) will be deleted too.` : undefined, confirmLabel: "Delete day" }))) return;
                    start(async () => {
                      const r = await deleteDay(day.id);
                      if (!r.ok) toast.error(r.error);
                    });
                  }}
                >
                  <Trash2 /> Delete day
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {open && (
          <>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title !== (day.title ?? "") && save({ title })}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                placeholder="Name this day…"
                aria-label="Day title"
                className="w-full min-w-0 flex-1 bg-transparent font-display text-[22px] font-semibold leading-tight outline-none placeholder:text-muted/60 focus:underline focus:decoration-accent/50 focus:underline-offset-4"
              />
              <div onClick={(e) => e.stopPropagation()}>
                <NativeSelect value={day.city_id ?? ""} onChange={(e) => save({ city_id: e.target.value || null })} aria-label="City" className="sm:w-36 [&_select]:h-9">
                  <option value="">No city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            {bigTimeShift && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-planned-soft px-3 py-2 text-sm text-ink">
                <MoonStar className="size-4 shrink-0 text-[#b57a14] dark:text-planned" />
                Big time shift. Consider a light first day.
              </p>
            )}

            {notesOpen && (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== (day.notes ?? "") && save({ notes })}
                placeholder="Notes for the day"
                rows={2}
                className="mt-3 min-h-14 bg-surface-2"
                aria-label="Day notes"
              />
            )}

            {bookings.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {bookings.map((b) => {
                  const meta = BOOKING_TYPE_META[b.type as keyof typeof BOOKING_TYPE_META] ?? BOOKING_TYPE_META.other;
                  return (
                    <li key={b.id} className="flex items-center gap-2.5 rounded-xl bg-wishlist-soft px-3 py-2 text-sm">
                      <meta.icon className="size-4 shrink-0 text-wishlist" />
                      <span className="num shrink-0 text-xs font-semibold text-muted">{b.start_at?.slice(11, 16)}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{b.title}</span>
                      {b.confirmation_no && <span className="hidden shrink-0 font-mono text-xs text-muted sm:inline">{b.confirmation_no}</span>}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 min-h-2">
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-1">
                  {items.map((it) => (
                    <StopRow
                      key={it.id}
                      item={it}
                      places={places}
                      highlighted={highlightedStop === it.id}
                      pin={pins?.get(it.id)}
                      onFocusPin={onFocusStop && (() => onFocusStop(it.id))}
                      onChanged={(patch) => onLocalChange(it.id, patch)}
                    />
                  ))}
                </ul>
              </SortableContext>
              {!items.length && !bookings.length && <p className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted">No stops yet — type one below or drag one here.</p>}
            </div>

            <form onSubmit={submitQuick} className="mt-3" onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <Input
                  ref={inputRef}
                  value={quick}
                  onChange={(e) => setQuick(e.target.value)}
                  placeholder="Add a stop — e.g. “10:00 Senso-ji temple”"
                  aria-label={`Add a stop to day ${day.day_number}`}
                  className="h-11 bg-surface-2 pr-10"
                />
                <CornerDownLeft className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              </div>
              {preview && (preview.start_time || preview.type !== "activity") && (
                <p className="mt-1.5 text-xs text-muted">
                  {preview.start_time ? `${preview.start_time}${preview.end_time ? `–${preview.end_time}` : ""} · ` : ""}
                  {preview.type} · “{preview.title}”
                </p>
              )}
            </form>
            {items.length > 0 && (
              <p className="mt-2 text-right text-xs text-muted">
                <span className="num">{done}</span>/{items.length} done
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/** A day folded to one line in the compact view: date, title, city and stops. It still takes a dragged stop. */
export function CompactDayRow({ day, cityName, stops, selected, onSelect }: { day: ItineraryDay; cityName: string | null; stops: number; selected: boolean; onSelect: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.id}`, data: { type: "day", dayId: day.id } });
  const isToday = day.date === todayIso();
  return (
    <article id={`day-${day.id}`} className="relative scroll-mt-24 pl-12 sm:pl-14" aria-label={`Day ${day.day_number}`}>
      <span
        aria-hidden
        className={cn(
          "absolute left-1 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full border-2 font-display text-sm font-semibold sm:left-1.5",
          selected ? "border-accent bg-accent text-white" : isToday ? "border-accent bg-surface text-accent" : "border-border bg-surface text-ink",
        )}
      >
        <span className="num">{day.day_number}</span>
      </span>
      <button
        ref={setNodeRef}
        type="button"
        onClick={onSelect}
        aria-expanded={false}
        className={cn(
          "card flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left text-sm transition-shadow hover:ring-1 hover:ring-border sm:gap-3 sm:px-4",
          selected && "ring-2 ring-accent/50",
          isOver && "ring-2 ring-visited/60",
        )}
      >
        <span className="num w-[4.6rem] shrink-0 text-xs font-semibold uppercase text-muted sm:w-[5.5rem] sm:tracking-wide">
          {day.date ? fmtDate(day.date, "EEE dd MMM") : `Day ${day.day_number}`}
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span className={cn("font-medium", !day.title && "text-muted")}>{day.title || "Untitled day"}</span>
          {cityName && <span className="text-muted"> · {cityName}</span>}
        </span>
        {isToday && <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">TODAY</span>}
        <span className="num shrink-0 text-xs text-muted">{pluralize(stops, "stop")}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>
    </article>
  );
}
