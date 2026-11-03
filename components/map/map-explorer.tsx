"use client";
import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronUp, Earth, ImageDown, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { addCountries } from "@/actions/countries";
import { getCountry } from "@/lib/countries";
import { fmtRange } from "@/lib/dates";
import { searchRoute } from "@/lib/map-view";
import type { CountryVM } from "@/lib/data";
import { cn, pluralize } from "@/lib/utils";
import { useAutoCover } from "@/hooks/use-auto-cover";
import { GeoStatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDefaultTripId, useWorkspace } from "@/components/shell/workspace";
import { transportMeta } from "@/lib/transport";
import type { PhotoBadge } from "@/lib/photo-pins";
import type { ExportTrip } from "./export-dialog";
import { DEFAULT_LAYERS, MapLegend, modesInUse, WorldMap, type Layers, type MapCity, type MapCountryState, type RoutePoint } from "./world-map";

// The export code only loads when the dialog opens.
const ExportDialog = dynamic(() => import("./export-dialog").then((m) => m.ExportDialog), { ssr: false });

export function MapExplorer({
  states,
  routes,
  cities,
  inScopeIds,
  countries,
  cityCounts,
  photoBadges,
  exportTrips,
  activeTripId,
}: {
  states: Record<string, MapCountryState>;
  routes: RoutePoint[][];
  cities: MapCity[];
  inScopeIds: Record<string, string>;
  countries: CountryVM[];
  cityCounts: Record<string, number>;
  photoBadges: { cities: PhotoBadge[]; countries: PhotoBadge[] };
  exportTrips: ExportTrip[];
  activeTripId: string | null;
}) {
  const [exporting, setExporting] = useState(false);
  const ws = useWorkspace();
  const router = useRouter();
  const tripId = useDefaultTripId();
  const autoCover = useAutoCover();
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [popover, setPopover] = useState<{ code: string; x: number; y: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hl, setHl] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const rows = useMemo(() => searchRoute(countries, query), [countries, query]);
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

  const panel = (titled: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex shrink-0 flex-col gap-3 px-5 pb-3", titled && "pt-5")}>
        {titled && (
          <div>
            <h2 className="text-xl font-semibold">Route</h2>
            <p className="text-xs text-muted">{pluralize(countries.length, "country", "countries")} in route order</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search countries" aria-label="Search countries in the route" className="pl-9 pr-9" />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-ink/5" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button variant="secondary" className="shrink-0" onClick={() => ws.openQuickAdd("country")}>
            <Plus /> Add
          </Button>
        </div>
      </div>
      {/* Relative so the list's screen-reader labels stay inside its scroll area instead of stretching the page. */}
      <ol className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {rows.map(({ country: c, n }) => (
          <li key={c.id}>
            <Link
              href={`/countries/${c.id}`}
              onMouseEnter={() => setHl(c.code)}
              onMouseLeave={() => setHl(null)}
              className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]"
            >
              <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-bg">{n}</span>
              {(() => {
                const m = transportMeta(c.transport_mode);
                return (
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft" title={c.transport_mode ? m.label : "Transport not set"}>
                    <m.icon className={cn("size-3.5", c.transport_mode ? "text-accent" : "text-muted")} />
                    <span className="sr-only">{c.transport_mode ? m.label : "Transport not set"}</span>
                  </span>
                );
              })()}
              <span className="text-xl leading-none">{c.flag}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium [overflow-wrap:anywhere]">{c.name}</span>
                <span className="text-xs text-muted">{fmtRange(c.arrive_date, c.depart_date)}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <GeoStatusChip status={c.display} size="sm" />
                  {pluralize(cityCounts[c.id] ?? 0, "city", "cities")}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {countries.length > 0 && !rows.length && <li className="px-4 py-10 text-center text-sm text-muted">No countries in your route match “{query.trim()}”.</li>}
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
    <div data-full-bleed className="-mx-4 -mb-32 -mt-6 grid h-[calc(100dvh-3.5rem-1px-64px-env(safe-area-inset-bottom))] grid-rows-[minmax(0,1fr)] md:-mx-8 md:-mb-16 md:-mt-8 md:h-[calc(100dvh-4rem-1px)] lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="relative min-h-0 overflow-hidden bg-ocean">
        <WorldMap states={states} routes={routes} cities={cities} photoBadges={photoBadges} layers={layers} onCountryClick={onClick} highlight={hl ?? popover?.code} className="size-full" controlsClassName="max-lg:bottom-[84px]" />
        <Button variant="secondary" size="sm" onClick={() => setExporting(true)} className="absolute right-3 top-3 z-10 md:right-5 md:top-5">
          <ImageDown /> Export
        </Button>
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
          <MapLegend className="pointer-events-auto" modes={modesInUse(routes)} hasPhotos={photoBadges.cities.length > 0 || photoBadges.countries.length > 0} layers={layers} onToggle={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))} />
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
          {sheetOpen && <div className="h-[calc(100%-68px)]">{panel(false)}</div>}
        </div>
      </div>
      <aside className="hidden min-h-0 border-l border-border bg-surface lg:block" aria-label="Countries in route order">
        {panel(true)}
      </aside>
      {exporting && <ExportDialog trips={exportTrips} activeTripId={activeTripId} onOpenChange={setExporting} />}
    </div>
  );
}
