"use client";
import { useMemo, useState, useTransition } from "react";
import { CalendarPlus, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateDays } from "@/actions/itinerary";
import { fmtDate, fmtRange } from "@/lib/dates";
import { MAX_GENERATED_DAYS, previewMissingDays } from "@/lib/itinerary-days";
import type { ItineraryDay } from "@/lib/types";
import { pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Stay = { id: string; arrive_date: string | null; depart_date: string | null };
type DayLite = Pick<ItineraryDay, "id" | "day_number" | "date" | "title" | "notes">;

/**
 * Creates a stay's days. With none yet it makes them straight away; once there are days it becomes "Generate missing days"
 * and shows the dates it would add first. It runs the same plan as `generateDays`, which never changes or deletes a day.
 */
export function GenerateDaysButton({
  country,
  days = [],
  dayIdsWithStops = [],
  variant = "primary",
}: {
  country: Stay;
  /** The stay's days. Given any, the button previews what it adds. */
  days?: DayLite[];
  dayIdsWithStops?: Iterable<string>;
  variant?: "primary" | "secondary";
}) {
  const [pending, start] = useTransition();
  const [count, setCount] = useState("3");
  const [open, setOpen] = useState(false);
  const hasDates = Boolean(country.arrive_date && country.depart_date);
  const withStops = useMemo(() => new Set(dayIdsWithStops), [dayIdsWithStops]);
  const preview = useMemo(
    () => (open && days.length ? previewMissingDays(country.arrive_date, country.depart_date, days, (d) => Boolean(d.title || d.notes || withStops.has(d.id))) : null),
    [open, days, country.arrive_date, country.depart_date, withStops],
  );

  const run = (blank?: number) =>
    start(async () => {
      const res = await generateDays(country.id, blank);
      if (!res.ok) return void toast.error(res.error);
      setOpen(false);
      if (res.data.created) toast.success(`Added ${pluralize(res.data.created, "day")}`, { description: days.length ? "Existing days and stops weren't changed." : undefined });
      else toast.success("No days are missing");
    });

  if (hasDates && !days.length) {
    return (
      <Button variant={variant} disabled={pending} onClick={() => run()}>
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate days
      </Button>
    );
  }

  const label = days.length ? "Generate missing days" : "Generate days";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant}>
          {days.length ? <CalendarPlus /> : <Sparkles />} {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
        {hasDates && preview ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-semibold">Generate missing days</p>
              <p className="mt-0.5 text-sm text-muted">
                One day for each date from {fmtRange(country.arrive_date, country.depart_date)} that has none. Your {pluralize(days.length, "day")} and their stops stay as they are.
              </p>
            </div>
            {preview.tooLong ? (
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">This stay is longer than {MAX_GENERATED_DAYS} days. Shorten its dates to generate days.</p>
            ) : preview.dates.length ? (
              <>
                <div>
                  <p className="eyebrow mb-1.5">
                    {pluralize(preview.dates.length, "date")} to add
                  </p>
                  <ul className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" aria-label="Dates to add">
                    {preview.dates.map((d) => (
                      <li key={d} className="num rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium">
                        {fmtDate(d, "EEE dd MMM")}
                      </li>
                    ))}
                  </ul>
                </div>
                {(preview.filled > 0 || preview.renumbered > 0) && (
                  <ul className="flex flex-col gap-1 text-xs text-muted">
                    {preview.filled > 0 && <li>{preview.filled === 1 ? "An empty day with no date takes the first of these dates." : `${preview.filled} empty days with no date take the first of these dates.`}</li>}
                    {preview.renumbered > 0 && <li>Day numbers shift so the days stay in date order.</li>}
                  </ul>
                )}
              </>
            ) : (
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">Every date already has a day. Nothing to add.</p>
            )}
            <div className="flex justify-end gap-2">
              <PopoverClose asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </PopoverClose>
              <Button size="sm" disabled={pending || preview.tooLong || !preview.dates.length} onClick={() => run()}>
                {pending && <Loader2 className="animate-spin" />} {preview.dates.length ? `Add ${pluralize(preview.dates.length, "day")}` : "Add days"}
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(Math.max(1, Math.min(60, Number(count) || 3)));
            }}
          >
            <p className="text-sm">{days.length ? "This stay has no dates, so no day is missing. Add blank days to the end?" : "No dates yet. How many blank days?"}</p>
            <Input type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} aria-label="Number of days" autoFocus />
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Create days
            </Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
