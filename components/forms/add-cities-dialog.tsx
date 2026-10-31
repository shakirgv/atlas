"use client";
import { useMemo, useState, useTransition } from "react";
import { Check, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { addCities } from "@/actions/cities";
import { getCountry } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { useAutoCover } from "@/hooks/use-auto-cover";
import { useGeocode } from "@/hooks/use-geocode";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useWorkspace } from "@/components/shell/workspace";
import { SubmitButton } from "./form-bits";

type Picked = { key: string; name: string; lat: number | null; lng: number | null; label: string };

export function AddCitiesDialog({
  open,
  onOpenChange,
  tripCountryId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tripCountryId?: string | null;
}) {
  const ws = useWorkspace();
  const options = ws.countries;
  const [countryId, setCountryId] = useState<string>(tripCountryId ?? options[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [pending, start] = useTransition();
  const autoCover = useAutoCover();

  const current = options.find((o) => o.id === (tripCountryId ?? countryId)) ?? options.find((o) => o.id === countryId);
  const info = getCountry(current?.country_code);
  const existing = useMemo(
    () => new Set(ws.cities.filter((c) => c.trip_country_id === current?.id).map((c) => c.name.toLowerCase())),
    [ws.cities, current?.id],
  );
  const { results, loading, error } = useGeocode(query, {
    layer: "city",
    country: current?.country_code ?? null,
    near: info ? { lat: info.latlng[0], lng: info.latlng[1] } : null,
    enabled: Boolean(current),
  });

  const toggle = (p: Picked) =>
    setPicked((list) => (list.some((x) => x.key === p.key) ? list.filter((x) => x.key !== p.key) : [...list, p]));

  const submit = () =>
    start(async () => {
      if (!current) return;
      const res = await addCities(
        current.id,
        picked.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng })),
      );
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Added ${res.data.ids.length} ${res.data.ids.length === 1 ? "city" : "cities"}`);
      autoCover("city", res.data.ids);
      setPicked([]);
      setQuery("");
      onOpenChange(false);
    });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add cities"
      description={current ? `Search cities in ${info?.name ?? "this country"}. Each one is pinned on the map.` : undefined}
      bodyClassName="flex flex-col gap-3 pt-1"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton type="button" onClick={submit} pending={pending} disabled={!picked.length || !current}>
            {picked.length ? `Add ${picked.length} ${picked.length === 1 ? "city" : "cities"}` : "Add cities"}
          </SubmitButton>
        </>
      }
    >
      {!options.length ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Add a country to your trip first, then come back to add its cities.</p>
      ) : (
        <>
          {!tripCountryId && (
            <NativeSelect value={countryId} onChange={(e) => setCountryId(e.target.value)} aria-label="Country">
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.flag} {o.name}
                  {ws.isAll ? ` — ${ws.trips.find((t) => t.id === o.trip_id)?.title ?? ""}` : ""}
                </option>
              ))}
            </NativeSelect>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`e.g. ${info?.capital[0] ?? "Kyoto"}`}
              className="pl-9"
              aria-label="Search cities"
            />
            {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
          </div>
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5 rounded-xl bg-surface-2 p-2">
              {picked.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => toggle(p)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 text-xs font-medium"
                >
                  <MapPin className="size-3 text-accent" /> {p.name} <X className="size-3 text-muted" />
                </button>
              ))}
            </div>
          )}
          <ul className="-mx-1 flex min-h-32 flex-col" aria-label="Results">
            {results.map((r) => {
              const key = r.id;
              const checked = picked.some((p) => p.key === key);
              const already = existing.has(r.name.toLowerCase());
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => toggle({ key, name: r.name, lat: r.lat, lng: r.lng, label: r.label })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left hover:bg-ink/[0.04] disabled:opacity-45 dark:hover:bg-white/[0.04]",
                      checked && "bg-accent-soft hover:bg-accent-soft",
                    )}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-surface-2 ring-1 ring-border">
                      <MapPin className="size-4 text-accent" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      <span className="truncate text-xs text-muted">{r.label}</span>
                    </span>
                    {already ? (
                      <span className="text-xs text-muted">Added</span>
                    ) : (
                      <span className={cn("grid size-5 place-items-center rounded-md border border-border", checked && "border-visited bg-visited text-white")}>
                        {checked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {query.trim().length >= 2 && !loading && (
              <li>
                <button
                  type="button"
                  onClick={() => toggle({ key: `manual:${query.trim().toLowerCase()}`, name: query.trim(), lat: null, lng: null, label: "No coordinates" })}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]"
                >
                  <span className="grid size-8 place-items-center rounded-lg border border-dashed border-border">
                    <Plus className="size-4 text-muted" />
                  </span>
                  <span>
                    Add “{query.trim()}” without a map pin
                    {error ? <span className="block text-xs text-muted">{error}</span> : null}
                  </span>
                </button>
              </li>
            )}
            {query.trim().length < 2 && <li className="py-8 text-center text-sm text-muted">Start typing a city name…</li>}
          </ul>
        </>
      )}
    </ResponsiveDialog>
  );
}
