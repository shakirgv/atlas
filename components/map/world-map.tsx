"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { Minus, Plus, RotateCcw } from "lucide-react";
import world from "world-atlas/countries-110m.json";
import { getCountryByCcn3 } from "@/lib/countries";
import { fmtRange } from "@/lib/dates";
import { GEO_STATUS_META } from "@/lib/status";
import type { DisplayStatus, GeoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-media-query";

const W = 960;
const H = 500;
const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
// Ignore features without an id (e.g. Kosovo, N. Cyprus, Somaliland in 110m).
const FEATURES = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry>).features.filter((f) => f.id !== undefined && f.id !== null && f.id !== "");
const projection = geoNaturalEarth1().fitExtent(
  [
    [4, 4],
    [W - 4, H - 4],
  ],
  { type: "Sphere" },
);
const path = geoPath(projection);
const SPHERE = path({ type: "Sphere" }) ?? "";
const GRATICULE = path(geoGraticule10()) ?? "";
const SHAPES = FEATURES.map((f: Feature<Geometry>) => {
  const info = getCountryByCcn3(String(f.id));
  return { id: String(f.id), code: info?.cca2 ?? null, name: info?.name ?? "", flag: info?.flag ?? "", d: path(f) ?? "" };
});

/** Zoom transform that frames the given route points (with padding), capped so context stays visible. */
function fitTransform(routes: RoutePoint[][], maxK: number) {
  const pts = routes.flat().map((p) => projection([p.lng, p.lat])).filter((p): p is [number, number] => Boolean(p));
  if (pts.length < 2) return { k: 1, x: 0, y: 0 };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 70;
  const k = Math.max(1, Math.min(maxK, Math.min(W / (x1 - x0 + pad * 2), H / (y1 - y0 + pad * 2))));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const x = Math.min(0, Math.max(W - W * k, W / 2 - cx * k));
  const y = Math.min(0, Math.max(H - H * k, H / 2 - cy * k));
  return { k, x, y };
}

export type MapCountryState = {
  status: GeoStatus;
  display?: DisplayStatus;
  tripCountryId?: string;
  arrive?: string | null;
  depart?: string | null;
  tripTitle?: string;
};
export type RoutePoint = { id: string; code: string; lat: number; lng: number };
export type MapCity = { id: string; name: string; lat: number; lng: number };
export type Layers = { visited: boolean; planned: boolean; wishlist: boolean; route: boolean; cities: boolean };
export const DEFAULT_LAYERS: Layers = { visited: true, planned: true, wishlist: true, route: true, cities: true };

export function WorldMap({
  states,
  routes = [],
  cities = [],
  layers = DEFAULT_LAYERS,
  compact,
  onCountryClick,
  highlight,
  className,
  controlsClassName,
  fitRoute = true,
}: {
  states: Record<string, MapCountryState>;
  routes?: RoutePoint[][];
  cities?: MapCity[];
  layers?: Layers;
  compact?: boolean;
  onCountryClick?: (code: string, point: { x: number; y: number }) => void;
  highlight?: string | null;
  className?: string;
  controlsClassName?: string;
  /** Start zoomed to frame the route. */
  fitRoute?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const initial = useMemo(() => (fitRoute ? fitTransform(routes, compact ? 2.2 : 3) : { k: 1, x: 0, y: 0 }), [fitRoute, routes, compact]);
  const [t, setT] = useState(initial);
  const [hover, setHover] = useState<{ code: string; x: number; y: number; w?: number } | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const svg = svgRef.current;
    if (compact || !svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 14])
      .translateExtent([
        [0, 0],
        [W, H],
      ])
      .on("zoom", (e) => setT({ k: e.transform.k, x: e.transform.x, y: e.transform.y }));
    zoomRef.current = z;
    select(svg).call(z).on("dblclick.zoom", null);
    select(svg).call(z.transform, zoomIdentity.translate(initial.x, initial.y).scale(initial.k));
    return () => {
      select(svg).on(".zoom", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  const zoomBy = (f: number) => svgRef.current && zoomRef.current && select(svgRef.current).transition().duration(reduce ? 0 : 280).call(zoomRef.current.scaleBy, f);
  const reset = () =>
    svgRef.current && zoomRef.current && select(svgRef.current).transition().duration(reduce ? 0 : 320).call(zoomRef.current.transform, zoomIdentity.translate(initial.x, initial.y).scale(initial.k));

  const fillFor = (code: string | null) => {
    if (!code) return "var(--land)";
    const s = states[code];
    if (!s) return "var(--land)";
    if (!layers[s.status]) return "var(--land)";
    if (s.display === "ongoing") return "var(--accent)";
    return GEO_STATUS_META[s.status].color;
  };

  const arcs = useMemo(
    () =>
      routes.map((r) =>
        r.slice(1).map((p, i) => {
          const a = r[i]!;
          return { key: `${a.id}-${p.id}`, d: path({ type: "LineString", coordinates: [[a.lng, a.lat], [p.lng, p.lat]] }) ?? "" };
        }),
      ),
    [routes],
  );
  const stops = useMemo(
    () =>
      routes.flatMap((r) =>
        r.map((p, i) => {
          const xy = projection([p.lng, p.lat]) ?? [0, 0];
          return { ...p, n: i + 1, x: xy[0], y: xy[1] };
        }),
      ),
    [routes],
  );
  const cityDots = useMemo(() => cities.map((c) => ({ ...c, xy: projection([c.lng, c.lat]) ?? [0, 0] })), [cities]);
  const hoverState = hover ? states[hover.code] : undefined;
  const hoverShape = hover ? SHAPES.find((s) => s.code === hover.code) : undefined;
  const inv = 1 / t.k;

  const localPoint = (e: React.MouseEvent | React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };

  return (
    <div ref={wrapRef} className={cn("relative select-none overflow-hidden", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={cn("block size-full", !compact && "cursor-grab active:cursor-grabbing")}
        role="img"
        aria-label="World map of your countries"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover(null)}
      >
        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          <path d={SPHERE} fill="var(--ocean)" />
          <path d={GRATICULE} fill="none" stroke="var(--border)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" opacity={0.7} />
          {SHAPES.map((s) => {
            const st = s.code ? states[s.code] : undefined;
            return (
              <path
                key={s.id}
                d={s.d}
                fill={fillFor(s.code)}
                fillOpacity={st && st.status === "wishlist" ? 0.85 : 1}
                stroke={highlight && s.code === highlight ? "var(--ink)" : "var(--land-stroke)"}
                strokeWidth={highlight && s.code === highlight ? 1.5 : 0.6}
                vectorEffect="non-scaling-stroke"
                className={cn("transition-[fill] duration-200", s.code && onCountryClick && "cursor-pointer hover:brightness-[0.92] dark:hover:brightness-125")}
                onMouseMove={(e) => s.code && setHover({ code: s.code, ...localPoint(e) })}
                onClick={(e) => s.code && onCountryClick?.(s.code, localPoint(e))}
              >
                <title>{s.name}</title>
              </path>
            );
          })}
          {layers.route &&
            arcs.map((list, ri) =>
              list.map((a, i) => (
                <g key={`${ri}-${a.key}`}>
                  <path
                    d={a.d}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    strokeOpacity={0.9}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    pathLength={1}
                    className={reduce ? undefined : "arc-draw"}
                    style={reduce ? undefined : { animationDelay: `${i * 0.18}s` }}
                  />
                  {!reduce && <path d={a.d} fill="none" stroke="var(--surface)" strokeWidth={1.2} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" className="arc-flow" style={{ animationDelay: `${1.4 + i * 0.18}s` }} />}
                </g>
              )),
            )}
          {layers.cities &&
            t.k > 2.5 &&
            cityDots.map((c) => (
              <g key={c.id} transform={`translate(${c.xy[0]},${c.xy[1]}) scale(${inv})`}>
                <circle r={3.5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.2} />
                {t.k > 4 && (
                  <text x={6} y={3.5} fontSize={10} fontWeight={500} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2.5} paintOrder="stroke">
                    {c.name}
                  </text>
                )}
              </g>
            ))}
          {layers.route &&
            stops.map((s) => {
              const ongoing = states[s.code]?.display === "ongoing";
              return (
                <g key={`stop-${s.id}`} transform={`translate(${s.x},${s.y}) scale(${inv * (compact ? 0.9 : 1)})`}>
                  {ongoing && <circle r={9} fill="var(--accent)" className="pulse-ring" />}
                  <circle r={8} fill="var(--ink)" stroke="var(--surface)" strokeWidth={1.5} />
                  <text textAnchor="middle" dy="0.35em" fontSize={9} fontWeight={700} fill="var(--surface)" className="num">
                    {s.n}
                  </text>
                </g>
              );
            })}
        </g>
      </svg>

      {hover && hoverShape && !compact && (
        <div
          className="pointer-events-none absolute z-10 min-w-40 rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-lg"
          style={{ left: Math.min(hover.x + 14, (hover.w ?? 0) - 200), top: hover.y + 14 }}
        >
          <div className="flex items-center gap-2 font-medium">
            <span className="text-lg leading-none">{hoverShape.flag}</span> {hoverShape.name}
          </div>
          {hoverState ? (
            <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: GEO_STATUS_META[hoverState.display ?? hoverState.status].color }} />
                {GEO_STATUS_META[hoverState.display ?? hoverState.status].label}
                {hoverState.tripTitle ? ` · ${hoverState.tripTitle}` : ""}
              </span>
              {(hoverState.arrive || hoverState.depart) && <span>{fmtRange(hoverState.arrive, hoverState.depart)}</span>}
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-muted">Not in your trips · click to add</div>
          )}
        </div>
      )}

      {!compact && (
        <div className={cn("absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm", controlsClassName)}>
          <button type="button" onClick={() => zoomBy(1.6)} className="grid size-10 place-items-center hover:bg-ink/5" aria-label="Zoom in">
            <Plus className="size-4" />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.6)} className="grid size-10 place-items-center border-y border-border hover:bg-ink/5" aria-label="Zoom out">
            <Minus className="size-4" />
          </button>
          <button type="button" onClick={reset} className="grid size-10 place-items-center hover:bg-ink/5" aria-label="Reset zoom">
            <RotateCcw className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function MapLegend({ layers, onToggle, className }: { layers: Layers; onToggle?: (key: keyof Layers) => void; className?: string }) {
  const items: { key: keyof Layers; label: string; color: string }[] = [
    { key: "visited", label: "Visited", color: "var(--visited)" },
    { key: "planned", label: "Planned", color: "var(--planned)" },
    { key: "wishlist", label: "Wishlist", color: "var(--wishlist)" },
    { key: "route", label: "Route", color: "var(--accent)" },
    { key: "cities", label: "Cities", color: "var(--ink)" },
  ];
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="group" aria-label="Map layers">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          aria-pressed={layers[i.key]}
          disabled={!onToggle}
          onClick={() => onToggle?.(i.key)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface/90 px-2.5 text-xs font-medium backdrop-blur transition-opacity disabled:cursor-default",
            !layers[i.key] && "opacity-45",
          )}
        >
          {i.key === "route" ? (
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: i.color }} />
          ) : i.key === "cities" ? (
            <span className="size-2 rounded-full border-[1.5px] bg-surface" style={{ borderColor: i.color }} />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          )}
          {i.label}
        </button>
      ))}
    </div>
  );
}
