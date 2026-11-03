"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, CalendarClock, ChevronRight, Lock, Loader2, Minus, Plus, TriangleAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { applyDateShift, loadShiftData, undoDateShift, type LastShift } from "@/actions/date-shift";
import { MAX_SHIFT_DAYS, planDateShift, type ShiftData, type ShiftMode } from "@/lib/date-shift";
import { fmtDate, fmtRange, fmtShort } from "@/lib/dates";
import { BOOKING_TYPE_META } from "@/lib/icons";
import { pluralize } from "@/lib/utils";
import { ChoiceChips, FormError } from "@/components/forms/form-bits";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

const MODES = [
  { value: "extend" as const, label: "The stay got longer or shorter" },
  { value: "move" as const, label: "The whole stop moves" },
];

function Change({ before, after }: { before: string; after: string }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs">
      <span className="text-muted line-through decoration-muted/50">{before}</span>
      <ArrowRight className="size-3 shrink-0 text-accent" />
      <span className="num font-medium">{after}</span>
    </span>
  );
}

/** Undoes one shift and says plainly if a date edited by hand since then was left alone. */
export async function runUndo(id: string, undo = undoDateShift) {
  const res = await undo(id);
  if (!res.ok) {
    toast.error(res.error);
    return false;
  }
  const { restored, total } = res.data;
  if (restored < total) toast.success(`Restored ${restored} of ${total} dates`, { description: `${pluralize(total - restored, "date")} edited since then stayed as you left them.` });
  else toast.success("Dates restored");
  return true;
}

/**
 * "Shift dates": later countries, cities and itinerary days move together. Everything that would change
 * is listed before anything does, and booked flights and hotels are called out instead of being moved.
 */
export function DateShiftDialog({
  tripId: initialTripId,
  trips,
  initialCountryId,
  onOpenChange,
  initial,
  applyShift = applyDateShift,
  undoShift = undoDateShift,
}: {
  tripId: string;
  /** Offered when the page shows several trips. */
  trips?: { id: string; title: string }[];
  initialCountryId?: string | null;
  onOpenChange: (open: boolean) => void;
  /** Fixtures for the preview gallery, with the two actions below. */
  initial?: { data: ShiftData; last: LastShift | null };
  applyShift?: typeof applyDateShift;
  undoShift?: typeof undoDateShift;
}) {
  const [tripId, setTripId] = useState(initialTripId);
  const [loaded, setLoaded] = useState<{ tripId: string; data: ShiftData; last: LastShift | null } | null>(initial ? { tripId: initialTripId, ...initial } : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<ShiftMode>("extend");
  const [countryId, setCountryId] = useState(initialCountryId ?? "");
  const [cityId, setCityId] = useState("");
  const [daysText, setDaysText] = useState("3");
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [undoing, startUndo] = useTransition();

  useEffect(() => {
    if (initial) return;
    let alive = true;
    void loadShiftData(tripId).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setLoadError(null);
        setLoaded({ tripId, ...res.data });
      } else setLoadError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [tripId, initial]);

  const data = loaded?.tripId === tripId ? loaded.data : null;
  const last = loaded?.tripId === tripId ? loaded.last : null;
  const route = useMemo(() => [...(data?.countries ?? [])].sort((a, b) => a.order_index - b.order_index), [data]);
  // The stop to start from: the one I came from, else the first with dates.
  const anchorId = countryId && route.some((c) => c.id === countryId) ? countryId : (route.find((c) => c.depart_date)?.id ?? route[0]?.id ?? "");
  const anchor = route.find((c) => c.id === anchorId);
  const cities = useMemo(() => (data?.cities ?? []).filter((c) => c.trip_country_id === anchorId).sort((a, b) => a.order_index - b.order_index), [data, anchorId]);
  const days = Number(daysText);
  const plan = useMemo(() => (data && anchorId ? planDateShift(data, { mode, countryId: anchorId, cityId: cityId || null, days: daysText.trim() ? days : 0, moveBookingIds: moveIds }) : null), [data, mode, anchorId, cityId, days, daysText, moveIds]);
  const stopName = (cityId && cities.find((c) => c.id === cityId)?.name) || anchor?.name || "";
  const hasChanges = Boolean(plan && !plan.error && plan.countries.length);
  const when = days > 0 ? "later" : "earlier";
  const howMany = pluralize(Math.abs(days), "day");

  const step = (by: number) => setDaysText(String(Math.max(-MAX_SHIFT_DAYS, Math.min(MAX_SHIFT_DAYS, (Number(daysText) || 0) + by))));
  const toggleBooking = (id: string, on: boolean) => setMoveIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));

  const apply = () =>
    start(async () => {
      const res = await applyShift(tripId, { mode, countryId: anchorId, cityId: cityId || null, days, moveBookingIds: moveIds });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Dates moved: ${res.data.label}`, {
        description: res.data.newDays ? `${anchor?.name} has ${pluralize(res.data.newDays, "more day")} now. Use Generate days in its itinerary to add them.` : undefined,
        duration: 15000,
        action: { label: "Undo", onClick: () => void runUndo(res.data.id, undoShift) },
      });
      onOpenChange(false);
    });

  const undoLast = () =>
    startUndo(async () => {
      if (!last) return;
      if (!(await runUndo(last.id, undoShift))) return;
      if (initial) return void setLoaded({ tripId, data: initial.data, last: null });
      const res = await loadShiftData(tripId);
      if (res.ok) setLoaded({ tripId, ...res.data });
    });

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="Shift dates"
      description="Later stops and their days move together. Nothing changes until you apply."
      className="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!hasChanges || pending} data-testid="apply-shift">
            {pending && <Loader2 className="animate-spin" />} Apply changes
          </Button>
        </>
      }
    >
      {loadError ? (
        <FormError message={loadError} />
      ) : !data ? (
        <div className="flex flex-col gap-3 pb-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-40" />
        </div>
      ) : !route.length ? (
        <p className="pb-4 text-sm text-muted">This trip has no countries yet.</p>
      ) : (
        <div className="flex flex-col gap-4 pb-2" data-testid="date-shift">
          {last && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm ring-1 ring-border">
              <span className="min-w-0">
                Last change: <span className="font-medium">{last.label}</span> <span className="text-muted">· {fmtDate(last.created_at)}</span>
              </span>
              <Button variant="secondary" size="sm" onClick={undoLast} disabled={undoing} data-testid="undo-shift">
                {undoing ? <Loader2 className="animate-spin" /> : <Undo2 />} Undo
              </Button>
            </div>
          )}
          <ChoiceChips name="What changed" value={mode} onChange={setMode} options={MODES} />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            {trips && trips.length > 1 && (
              <Field label="Trip" htmlFor="shift-trip" className="sm:col-span-3">
                <NativeSelect
                  id="shift-trip"
                  value={tripId}
                  onChange={(e) => {
                    setTripId(e.target.value);
                    setCountryId("");
                    setCityId("");
                    setMoveIds([]);
                  }}
                >
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Country" htmlFor="shift-country">
              <NativeSelect
                id="shift-country"
                value={anchorId}
                onChange={(e) => {
                  setCountryId(e.target.value);
                  setCityId("");
                }}
              >
                {route.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {i + 1}. {c.flag} {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="City" htmlFor="shift-city">
              <NativeSelect id="shift-city" value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={!cities.length}>
                <option value="">{cities.length ? "The whole country" : "No cities"}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Days" htmlFor="shift-days">
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="icon" aria-label="One day less" onClick={() => step(-1)}>
                  <Minus />
                </Button>
                <Input id="shift-days" type="number" inputMode="numeric" className="num w-20 text-center" min={-MAX_SHIFT_DAYS} max={MAX_SHIFT_DAYS} value={daysText} onChange={(e) => setDaysText(e.target.value)} />
                <Button variant="secondary" size="icon" aria-label="One day more" onClick={() => step(1)}>
                  <Plus />
                </Button>
              </div>
            </Field>
          </div>

          {plan?.error ? (
            <FormError message={plan.error} />
          ) : !hasChanges ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted">Set a number of days to see what changes. Use a minus for earlier.</p>
          ) : (
            plan && (
              <>
                <p className="flex items-start gap-2 text-sm">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>
                    {mode === "extend" ? `${stopName} ends ${howMany} ${when}, and everything after it follows.` : `${stopName} and everything after it move ${howMany} ${when}.`} This changes {pluralize(plan.counts.countries, "country", "countries")}, {pluralize(plan.counts.cities, "city", "cities")} and {pluralize(plan.counts.days, "itinerary day")} with {pluralize(plan.counts.stops, "stop")}.
                  </span>
                </p>

                {plan.bookings.length > 0 && (
                  <section className="rounded-xl border border-planned/50 bg-planned-soft p-3" aria-label="Fixed bookings" data-testid="fixed-bookings">
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      <Lock className="size-4 shrink-0" /> Fixed bookings stay on their dates
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">Flights and hotels are real reservations, so check these yourself. Tick one only if you have rebooked it.</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {plan.bookings.map(({ booking: b, move, start_after, conflict }) => {
                        const meta = BOOKING_TYPE_META[b.type as keyof typeof BOOKING_TYPE_META];
                        const Icon = meta?.icon ?? Lock;
                        return (
                          <li key={b.id} className="flex items-start gap-2.5 rounded-lg bg-surface p-2.5 text-sm">
                            <Icon className="mt-0.5 size-4 shrink-0 text-muted" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{b.title}</p>
                              {move ? <Change before={fmtDate(b.start_at)} after={fmtDate(start_after)} /> : <p className="num text-xs text-muted">{b.end_at ? fmtRange(b.start_at?.slice(0, 10), b.end_at.slice(0, 10)) : fmtDate(b.start_at)}</p>}
                              {conflict && (
                                <p className="mt-1 flex items-start gap-1.5 text-xs text-danger">
                                  <TriangleAlert className="mt-px size-3.5 shrink-0" /> {conflict}
                                </p>
                              )}
                            </div>
                            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs">
                              <Checkbox checked={move} onCheckedChange={(v) => toggleBooking(b.id, v === true)} aria-label={`Move ${b.title} too`} /> Move
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {plan.stranded.length > 0 && (
                  <div className="rounded-xl bg-planned-soft p-3 text-sm" role="alert">
                    <p className="font-medium">
                      {pluralize(plan.stranded.length, "day")} now {plan.stranded.length === 1 ? "falls" : "fall"} after {stopName} ends
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{plan.stranded.map((d) => `${d.name} (${fmtShort(d.date)})`).join(", ")}. They keep their dates and stops, so move or delete them in the itinerary.</p>
                  </div>
                )}

                <section aria-label="Dates that change" data-testid="shift-preview">
                  <h3 className="mb-1.5 text-sm font-medium">Dates that change</h3>
                  <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
                    {plan.trip && (
                      <li className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-medium">Trip: {data.trip.title}</span>
                        <Change before={fmtRange(plan.trip.start_before, plan.trip.end_before)} after={fmtRange(plan.trip.start_after, plan.trip.end_after)} />
                      </li>
                    )}
                    {plan.countries.map((c) => (
                      <li key={c.id} className="flex flex-col gap-1.5 p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {c.flag} {c.name}
                          </span>
                          <Change before={fmtRange(c.start_before, c.end_before)} after={fmtRange(c.start_after, c.end_after)} />
                        </div>
                        {c.cities.map((x) => (
                          <div key={x.id} className="flex flex-col gap-0.5 pl-6 sm:flex-row sm:items-center sm:justify-between">
                            <span className="min-w-0 truncate text-[13px] text-muted">{x.name}</span>
                            <Change before={fmtRange(x.start_before, x.end_before)} after={fmtRange(x.start_after, x.end_after)} />
                          </div>
                        ))}
                        {c.days.length > 0 && (
                          <details className="group pl-6">
                            <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                              <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" /> {pluralize(c.days.length, "itinerary day")} with {pluralize(c.days.reduce((s, d) => s + d.stops, 0), "stop")}
                            </summary>
                            <ul className="mt-1 flex flex-col gap-0.5 pl-5">
                              {c.days.map((d) => (
                                <li key={d.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="min-w-0 truncate text-[13px]">
                                    {d.name}
                                    {d.stops ? <span className="text-muted"> · {pluralize(d.stops, "stop")}</span> : null}
                                  </span>
                                  <Change before={fmtShort(d.before)} after={fmtShort(d.after)} />
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>

                {plan.newDays > 0 && <p className="text-xs text-muted">The extra {pluralize(plan.newDays, "day")} in {anchor?.name} {plan.newDays === 1 ? "isn't" : "aren't"} added to the itinerary by itself. Use Generate days afterwards.</p>}
                {(plan.skipped.visited.length > 0 || plan.skipped.undated.length > 0) && (
                  <p className="text-xs text-muted">
                    Staying as they are:{" "}
                    {[plan.skipped.visited.length ? `already visited (${plan.skipped.visited.join(", ")})` : "", plan.skipped.undated.length ? `no dates yet (${plan.skipped.undated.join(", ")})` : ""].filter(Boolean).join("; ")}.
                  </p>
                )}
              </>
            )
          )}
        </div>
      )}
    </ResponsiveDialog>
  );
}
