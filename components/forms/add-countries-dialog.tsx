"use client";
import { useMemo, useState, useTransition } from "react";
import { Check, Search, X } from "lucide-react";
import { toast } from "sonner";
import { addCountries } from "@/actions/countries";
import { COUNTRIES, getCountry, searchCountries } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { useAutoCover } from "@/hooks/use-auto-cover";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useDefaultTripId, useWorkspace } from "@/components/shell/workspace";
import { SubmitButton } from "./form-bits";

const REGIONS = ["All", "Africa", "Americas", "Asia", "Europe", "Oceania"] as const;

export function AddCountriesDialog({
  open,
  onOpenChange,
  tripId: initialTripId,
  preselect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tripId?: string | null;
  preselect?: string[];
}) {
  const ws = useWorkspace();
  const fallbackTrip = useDefaultTripId();
  const [tripId, setTripId] = useState<string | null>(initialTripId ?? fallbackTrip);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");
  const [selected, setSelected] = useState<string[]>(preselect ?? []);
  const [pending, start] = useTransition();
  const autoCover = useAutoCover();

  const activeTrip = tripId ?? fallbackTrip;
  const existing = useMemo(
    () => new Set(ws.countries.filter((c) => c.trip_id === activeTrip).map((c) => c.country_code)),
    [ws.countries, activeTrip],
  );
  const list = useMemo(() => {
    const base = query ? searchCountries(query) : COUNTRIES;
    return region === "All" ? base : base.filter((c) => c.region === region);
  }, [query, region]);

  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));

  // "Select all" acts on what is visible right now: everything, one continent, or the search results.
  const selectable = list.filter((c) => !existing.has(c.cca2));
  const allVisibleSelected = selectable.length > 0 && selectable.every((c) => selected.includes(c.cca2));
  const scopeLabel = query.trim() ? "results" : region === "All" ? "countries" : `in ${region}`;
  const toggleAllVisible = () => {
    const codes = selectable.map((c) => c.cca2);
    if (allVisibleSelected) setSelected((s) => s.filter((c) => !codes.includes(c)));
    else setSelected((s) => [...s, ...codes.filter((c) => !s.includes(c))]);
  };
  const SHOWN = 12;

  const submit = () =>
    start(async () => {
      if (!activeTrip) return void toast.error("Create a trip first");
      const res = await addCountries(activeTrip, selected);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Added ${res.data.ids.length} ${res.data.ids.length === 1 ? "country" : "countries"} to your route`);
      autoCover("country", res.data.ids);
      setSelected([]);
      setQuery("");
      onOpenChange(false);
    });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add countries"
      description="Tick as many as you like. They join the route in the order you pick them."
      className="max-w-xl"
      bodyClassName="flex flex-col gap-3 pt-1"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton pending={pending} disabled={!selected.length || !activeTrip} onClick={submit} type="button">
            {selected.length ? `Add ${selected.length} ${selected.length === 1 ? "country" : "countries"}` : "Add countries"}
          </SubmitButton>
        </>
      }
    >
      {ws.trips.length > 1 && (
        <NativeSelect value={activeTrip ?? ""} onChange={(e) => setTripId(e.target.value)} aria-label="Trip" className="shrink-0">
          {ws.trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </NativeSelect>
      )}
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search countries or capitals…" className="pl-9" aria-label="Search countries" />
      </div>
      <div className="scrollbar-none -mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 py-0.5" role="group" aria-label="Continent">
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={region === r}
            onClick={() => setRegion(r)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-[13px] font-medium",
              region === r ? "border-ink bg-ink text-bg" : "border-border text-ink/75 hover:border-ink/30",
            )}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {selected.length ? (
            <>
              <span className="num font-medium text-ink">{selected.length}</span> selected ·{" "}
              <button type="button" onClick={() => setSelected([])} className="font-medium text-accent hover:underline">
                Clear
              </button>
            </>
          ) : (
            <span className="num">{selectable.length} available</span>
          )}
        </span>
        <Button size="sm" variant="secondary" onClick={toggleAllVisible} disabled={!selectable.length}>
          {allVisibleSelected ? <X /> : <Check />}
          {allVisibleSelected ? `Unselect ${scopeLabel}` : `Select all ${scopeLabel}`}
          <span className="num text-muted">{selectable.length}</span>
        </Button>
      </div>
      {selected.length > 0 && (
        <div className="flex max-h-24 shrink-0 flex-wrap gap-1.5 overflow-y-auto rounded-xl bg-surface-2 p-2">
          {selected.slice(0, SHOWN).map((code, i) => {
            const c = getCountry(code)!;
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggle(code)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface pl-1.5 pr-2 text-xs font-medium"
                aria-label={`Remove ${c.name}`}
              >
                <span className="num grid size-4 place-items-center rounded-full bg-accent text-[10px] text-white">{i + 1}</span>
                {c.flag} {c.name}
                <X className="size-3 text-muted" />
              </button>
            );
          })}
          {selected.length > SHOWN && <span className="inline-flex h-7 items-center px-2 text-xs font-medium text-muted">+{selected.length - SHOWN} more</span>}
        </div>
      )}
      <ul className="-mx-1 flex min-h-40 flex-col overflow-y-auto max-md:max-h-[40vh] md:max-h-[340px]" role="listbox" aria-multiselectable aria-label="Countries">
        {list.map((c) => {
          const already = existing.has(c.cca2);
          const checked = selected.includes(c.cca2);
          return (
            <li key={c.cca2}>
              <button
                type="button"
                role="option"
                aria-selected={checked}
                disabled={already}
                onClick={() => toggle(c.cca2)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-white/[0.04] max-md:py-2.5",
                  checked && "bg-accent-soft hover:bg-accent-soft",
                )}
              >
                <span className="text-2xl leading-none">{c.flag}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  <span className="truncate text-xs text-muted">
                    {c.subregion || c.region}
                    {c.capital[0] ? ` · ${c.capital[0]}` : ""}
                  </span>
                </span>
                {already ? (
                  <span className="text-xs text-muted">In trip</span>
                ) : (
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-md border border-border",
                      checked && "border-visited bg-visited text-white",
                    )}
                  >
                    {checked && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {!list.length && <li className="py-10 text-center text-sm text-muted">No countries match “{query}”.</li>}
      </ul>
    </ResponsiveDialog>
  );
}
