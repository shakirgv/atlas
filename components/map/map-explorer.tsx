"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronUp, Earth, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addCountries } from "@/actions/countries";
import { getCountry } from "@/lib/countries";
import { fmtRange } from "@/lib/dates";
import type { CountryVM } from "@/lib/data";
import { cn, pluralize } from "@/lib/utils";
import { useAutoCover } from "@/hooks/use-auto-cover";
import { GeoStatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { useDefaultTripId, useWorkspace } from "@/components/shell/workspace";
import { DEFAULT_LAYERS, MapLegend, WorldMap, type Layers, type MapCity, type MapCountryState, type RoutePoint } from "./world-map";

export function MapExplorer({
  states,
  routes,
  cities,
  inScopeIds,
  countries,
  cityCounts,
}: {
  states: Record<string, MapCountryState>;
  routes: RoutePoint[][];
  cities: MapCity[];
  inScopeIds: Record<string, string>;
  countries: CountryVM[];
  cityCounts: Record<string, number>;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const tripId = useDefaultTripId();
  const autoCover = useAutoCover();
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [popover, setPopover] = useState<{ code: string; x: number; y: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hl, setHl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const counts = useMemo(() => {
    const v = Object.values(states);
    return { visited: v.filter((s) => s.status === "visited").length, planned: v.filter((s) => s.status === "planned").length, wishlist: v.filter((s) => s.status === "wishlist").length };
  }, [states]);

  const onClick = (code: string, p: { x: number; y: number }) => {
    const id = inScopeIds[code];
    if (id) return router.push(`/countries/${id}`);
    setPopover({ code, ...p });
  };

  const add = (code: string) =>
    start(async () => {
      if (!tripId) return void ws.openQuickAdd("trip");
      const res = await addCountries(tripId, [code]);
      if (!res.ok) return void toast.error(res.error);
      autoCover("country", res.data.ids);
      toast.success(`${getCountry(code)?.name} added to ${ws.trips.find((t) => t.id === tripId)?.title ?? "your trip"}`);
      setPopover(null);
    });

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <div>
          <h2 className="text-xl font-semibold">Route</h2>
          <p className="text-xs text-muted">{pluralize(countries.length, "country", "countries")} in route order</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => ws.openQuickAdd("country")}>
          <Plus /> Add
        </Button>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {countries.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/countries/${c.id}`}
              onMouseEnter={() => setHl(c.code)}
              onMouseLeave={() => setHl(null)}
              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]"
            >
              <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-bg">{i + 1}</span>
              <span className="text-xl leading-none">{c.flag}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="truncate text-xs text-muted">
                  {fmtRange(c.arrive_date, c.depart_date)} · {pluralize(cityCounts[c.id] ?? 0, "city", "cities")}
                </span>
              </span>
              <GeoStatusChip status={c.display} size="sm" />
            </Link>
          </li>
        ))}
        {!countries.length && (
          <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
            <Earth className="size-6 text-accent" />
            Click any country on the map to add it to your trip.
          </li>
        )}
      </ol>
    </div>
  );

  const info = popover ? getCountry(popover.code) : null;
  const st = popover ? states[popover.code] : null;

  return (
    <div className="-mx-4 -mb-32 -mt-6 grid h-[calc(100dvh-3.5rem-64px-env(safe-area-inset-bottom))] md:-mx-8 md:-mb-16 md:-mt-8 md:h-[calc(100dvh-4rem)] lg:grid-cols-[1fr_340px]">
      <div className="relative min-h-0 overflow-hidden bg-ocean">
        <WorldMap states={states} routes={routes} cities={cities} layers={layers} onCountryClick={onClick} highlight={hl ?? popover?.code} className="size-full" controlsClassName="max-lg:bottom-[84px]" />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2 md:inset-x-5 md:top-5">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 self-start rounded-2xl border border-border bg-surface/85 px-3 py-2 text-xs backdrop-blur">
            <span>
              <b className="num font-display text-base">{counts.visited}</b> visited
            </span>
            <span>
              <b className="num font-display text-base">{counts.planned}</b> planned
            </span>
            <span>
              <b className="num font-display text-base">{counts.wishlist}</b> wishlist
            </span>
          </div>
          <MapLegend className="pointer-events-auto" layers={layers} onToggle={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))} />
        </div>
        {popover && info && (
          <div className="absolute z-20 w-64 rounded-2xl border border-border bg-surface p-4 shadow-xl" style={{ left: `clamp(12px, ${popover.x - 128}px, calc(100% - 268px))`, top: `clamp(12px, ${popover.y + 12}px, calc(100% - 180px))` }} role="dialog" aria-label={`${info.name}`}>
            <button type="button" onClick={() => setPopover(null)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Close">
              <X className="size-4" />
            </button>
            <div className="flex items-center gap-2.5">
              <span className="text-3xl leading-none">{info.flag}</span>
              <div>
                <p className="font-display text-lg font-semibold leading-tight">{info.name}</p>
                <p className="text-xs text-muted">{info.capital[0] ?? info.region}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">{st ? `In ${st.tripTitle ?? "another trip"} · ${st.status}` : "Not in any trip yet."}</p>
            <Button className="mt-3 w-full" size="sm" onClick={() => add(popover.code)} disabled={pending}>
              <Plus /> Add to {ws.isAll ? "trip" : (ws.trips.find((t) => t.id === tripId)?.title ?? "trip")}
            </Button>
          </div>
        )}
        {/* Mobile bottom sheet */}
        <div className={cn("absolute inset-x-0 bottom-0 z-10 rounded-t-[22px] border-t border-border bg-surface shadow-[0_-8px_30px_rgb(0_0_0/0.12)] transition-[height] duration-300 lg:hidden", sheetOpen ? "h-[60%]" : "h-[68px]")}>
          <button type="button" onClick={() => setSheetOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-3" aria-expanded={sheetOpen}>
            <span className="flex flex-col items-start">
              <span className="font-display text-lg font-semibold">Route</span>
              <span className="text-xs text-muted">{pluralize(countries.length, "country", "countries")}</span>
            </span>
            <ChevronUp className={cn("size-5 text-muted transition-transform", sheetOpen && "rotate-180")} />
          </button>
          {sheetOpen && <div className="h-[calc(100%-68px)] [&>div>div:first-child]:hidden">{panel}</div>}
        </div>
      </div>
      <aside className="hidden min-h-0 border-l border-border bg-surface lg:block" aria-label="Countries in route order">
        {panel}
      </aside>
    </div>
  );
}
