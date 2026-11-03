"use client";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Copy, ListPlus, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { applyRouteOrder } from "@/actions/countries";
import { buildRoutePreview, type RouteStop, type UnresolvedEntry } from "@/lib/route-paste";
import type { ActionResult } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type RouteCountry = RouteStop & { trip_id: string; order_index: number };
type Apply = (tripId: string, ids: string[]) => Promise<ActionResult>;

const REASON: Record<UnresolvedEntry["reason"], string> = {
  unknown: "Not recognised",
  ambiguous: "Could be more than one country",
  not_on_route: "A real country, but not on this route",
};
const SKIP = "__skip";

function Group({ icon: Icon, tone, title, children }: { icon: typeof CheckCircle2; tone: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 shrink-0" style={{ color: tone }} /> {title}
      </h3>
      {children ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}

function Names({ stops }: { stops: { key: string; label: string }[] }) {
  return (
    <p className="text-[13px] leading-relaxed text-muted">
      {stops.map((s, i) => (
        <span key={s.key}>
          {s.label}
          {i < stops.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}

/** "Reorder route": paste the order you want as text, check what it matched, then apply. Only the order changes. */
export function RoutePasteDialog({ countries, trips, initialTripId, onOpenChange, apply = applyRouteOrder }: { countries: RouteCountry[]; trips: { id: string; title: string }[]; initialTripId: string | null; onOpenChange: (open: boolean) => void; apply?: Apply }) {
  const [tripId, setTripId] = useState(initialTripId ?? trips[0]?.id ?? "");
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<Record<number, string | null>>({});
  const [pending, start] = useTransition();
  const deferred = useDeferredValue(text);

  const route = useMemo(() => countries.filter((c) => c.trip_id === tripId).sort((a, b) => a.order_index - b.order_index), [countries, tripId]);
  const preview = useMemo(() => buildRoutePreview(deferred, route, picks), [deferred, route, picks]);
  const used = useMemo(() => new Set(preview.matched.map((r) => r.id)), [preview.matched]);
  const named = new Set(preview.matched.map((r) => r.id));
  const handled = Object.entries(picks).filter(([i]) => Number(i) < preview.entries.length);
  const open = preview.unresolved.length;

  const edit = (value: string) => {
    setText(value);
    // A choice belongs to a line of the old text.
    setPicks({});
  };
  const pick = (index: number, value: string) => setPicks((p) => ({ ...p, [index]: value === SKIP ? null : value }));
  const unpick = (index: number) =>
    setPicks((p) => {
      const next = { ...p };
      delete next[index];
      return next;
    });

  const run = () =>
    start(async () => {
      const before = route.map((r) => r.id);
      const res = await apply(tripId, preview.order.map((r) => r.id));
      if (!res.ok) return void toast.error(res.error);
      toast.success("Route order updated", {
        description: "Only the order changed. Dates and everything else stayed as they were.",
        duration: 10000,
        action: {
          label: "Undo",
          onClick: async () => {
            const back = await apply(tripId, before);
            if (back.ok) toast.success("Previous order restored");
            else toast.error(back.error);
          },
        },
      });
      onOpenChange(false);
    });

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="Reorder route"
      description="Paste your countries in the order you want. Names, codes like AZ, GE, TR and numbered lists all work."
      className="max-w-4xl"
      footer={
        <>
          {open > 0 && <p className="mr-auto self-center text-xs text-muted">{pluralize(open, "name")} left out unless you pick a country.</p>}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={run} disabled={pending || !preview.matched.length || preview.unchanged} data-testid="apply-order">
            {pending && <Loader2 className="animate-spin" />} Apply order
          </Button>
        </>
      }
    >
      <div className="grid gap-4 pb-2 lg:grid-cols-2" data-testid="route-paste">
        <div className="flex flex-col gap-3">
          {trips.length > 1 && (
            <Field label="Trip" htmlFor="paste-trip">
              <NativeSelect
                id="paste-trip"
                value={tripId}
                onChange={(e) => {
                  setTripId(e.target.value);
                  setPicks({});
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
          <Field label="Your route" htmlFor="paste-route" hint={`${pluralize(route.length, "country", "countries")} on this route.`}>
            <Textarea
              id="paste-route"
              autoFocus
              value={text}
              onChange={(e) => edit(e.target.value)}
              spellCheck={false}
              className="min-h-64 font-mono text-[13px] lg:min-h-[22rem]"
              placeholder={"1. Azerbaijan\n2. Georgia\n3. Türkiye\n4. Greece\n5. Albania\n\nor\n\nAZ, GE, TR, GR, AL"}
            />
          </Field>
        </div>

        {!deferred.trim() ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            <span className="flex flex-col items-center gap-2">
              <ListPlus className="size-6 text-accent" />
              The check appears here as you paste. Nothing changes until you apply it.
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-2.5" aria-live="polite">
            <Group icon={CheckCircle2} tone="var(--visited)" title={`Matched: ${pluralize(preview.matched.length, "country", "countries")}`} />

            {open > 0 && (
              <Group icon={CircleHelp} tone="var(--danger)" title={`Not recognised: ${pluralize(open, "name")}. Pick the right country.`}>
                <ul className="flex flex-col gap-2.5">
                  {preview.unresolved.map((u) => {
                    const suggested = u.suggestions.map((id) => route.find((r) => r.id === id)).filter((r): r is RouteCountry => Boolean(r));
                    return (
                      <li key={u.index} className="flex flex-col gap-1.5">
                        <p className="min-w-0 text-[13px]">
                          <span className="break-words font-medium">{u.text}</span> <span className="text-muted">· {REASON[u.reason]}</span>
                        </p>
                        <NativeSelect aria-label={`Country for ${u.text}`} value="" onChange={(e) => e.target.value && pick(u.index, e.target.value)}>
                          <option value="">Choose a country…</option>
                          {suggested.length > 0 && (
                            <optgroup label="Closest">
                              {suggested.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.flag} {r.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="On this route">
                            {route
                              .filter((r) => !used.has(r.id) && !u.suggestions.includes(r.id))
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.flag} {r.name}
                                </option>
                              ))}
                          </optgroup>
                          <option value={SKIP}>Leave this line out</option>
                        </NativeSelect>
                      </li>
                    );
                  })}
                </ul>
              </Group>
            )}

            {handled.length > 0 && (
              <Group icon={CheckCircle2} tone="var(--visited)" title={`Decided by you: ${handled.length}`}>
                <ul className="flex flex-col gap-1">
                  {handled.map(([i, id]) => {
                    const stop = id ? route.find((r) => r.id === id) : null;
                    return (
                      <li key={i} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="min-w-0 break-words">
                          {preview.entries[Number(i)]} <span className="text-muted">→ {stop ? `${stop.flag} ${stop.name}` : "left out"}</span>
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={() => unpick(Number(i))}>
                          <Undo2 /> Change
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Group>
            )}

            {preview.duplicates.length > 0 && (
              <Group icon={Copy} tone="var(--planned)" title={`Repeated: ${preview.duplicates.length}. The first mention counts.`}>
                <Names stops={preview.duplicates.map((d, i) => ({ key: `${d.stop.id}-${i}`, label: `${d.text} (${d.stop.name})` }))} />
              </Group>
            )}

            {preview.missing.length > 0 && (
              <Group icon={AlertTriangle} tone="var(--muted)" title={`Not in your list: ${pluralize(preview.missing.length, "country", "countries")}. They stay, at the end, in their current order.`}>
                <Names stops={preview.missing.map((r) => ({ key: r.id, label: r.name }))} />
              </Group>
            )}

            <section className="rounded-xl border border-border bg-surface-2 p-3">
              <h3 className="text-sm font-medium">{preview.unchanged ? "This is already your route order" : "New order"}</h3>
              <ol className="mt-2 flex max-h-56 flex-col gap-0.5 overflow-y-auto text-[13px]" data-testid="new-order">
                {preview.order.map((r, i) => (
                  <li key={r.id} className={cn("flex items-center gap-2 rounded-md py-0.5", !named.has(r.id) && "text-muted")}>
                    <span className="num w-7 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                    <span>{r.flag}</span>
                    <span className="min-w-0 truncate">{r.name}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
