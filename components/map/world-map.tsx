"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { Camera, House, Minus, Plane, Plus, RotateCcw } from "lucide-react";
import world from "world-atlas/countries-110m.json";
import { getCountryByCcn3 } from "@/lib/countries";
import { fmtRange } from "@/lib/dates";
import { GEO_STATUS_META } from "@/lib/status";
import { arcMidpoint } from "@/lib/geo";
import { transportMeta, TRANSPORT_META } from "@/lib/transport";
import { TRANSPORT_MODES, type TransportMode } from "@/lib/types";
import type { DisplayStatus, GeoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-media-query";
import type { PhotoBadge } from "@/lib/photo-pins";

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
export const SHAPES = FEATURES.map((f: Feature<Geometry>) => {
  const info = getCountryByCcn3(String(f.id));
  return { id: String(f.id), code: info?.cca2 ?? null, name: info?.name ?? "", flag: info?.flag ?? "", d: path(f) ?? "", feature: f };
});

/**
 * Screen positions get rounded: Node and the browser can differ in the last digits of the same
 * calculation, and React reports that as a hydration mismatch. A hundredth of a unit can't be seen.
 */
const r2 = (n: number) => Math.round(n * 100) / 100;

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
  return { k: Math.round(k * 10000) / 10000, x: r2(x), y: r2(y) };
}

export type MapCountryState = {
  status: GeoStatus;
  display?: DisplayStatus;
  tripCountryId?: string;
  arrive?: string | null;
  depart?: string | null;
  tripTitle?: string;
};
export type RoutePoint = {
  id: string;
  code: string;
  lat: number;
  lng: number;
  name?: string;
  /** How I get HERE from the previous point (first point: from home). */
  mode?: string | null;
  note?: string | null;
  /** The home point that starts a route (not numbered). */
  home?: boolean;
  /** A later stop inside the same country (small dot instead of a number). */
  minor?: boolean;
};

export type RouteLeg = { key: string; from: RoutePoint; to: RoutePoint; d: string; mid: [number, number]; mode: string | null; greatCircle: boolean; length: number };

/** A leg shorter than this on screen hides its badge, so short hops do not pile up until I zoom in. */
const MIN_BADGE_LENGTH = 34;

/** Build drawable legs: flights follow the great circle, ground modes a straight projected line. */
export function buildRouteLegs(route: RoutePoint[], proj = projection): RouteLeg[] {
  const p = geoPath(proj);
  return route.slice(1).map((to, i) => {
    const from = route[i]!;
    const meta = transportMeta(to.mode);
    const a = proj([from.lng, from.lat]) ?? [0, 0];
    const b = proj([to.lng, to.lat]) ?? [0, 0];
    const gc = meta.arc.greatCircle || !to.mode;
    const d = gc ? (p({ type: "LineString", coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }) ?? "") : `M${a[0]},${a[1]}L${b[0]},${b[1]}`;
    const m = gc ? arcMidpoint(from, to) : null;
    const mid = (m ? proj([m.lng, m.lat]) : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) ?? [0, 0];
    return { key: `${from.id}-${to.id}`, from, to, d, mid: [r2(mid[0]), r2(mid[1])] as [number, number], mode: to.mode ?? null, greatCircle: gc, length: Math.hypot(a[0] - b[0], a[1] - b[1]) };
  });
}

/** Transport modes used in the given routes (for the legend). */
export function modesInUse(routes: RoutePoint[][]): TransportMode[] {
  const set = new Set(routes.flatMap((r) => r.slice(1).map((p) => p.mode)).filter(Boolean));
  return TRANSPORT_MODES.filter((m) => set.has(m));
}
export type MapCity = { id: string; name: string; lat: number; lng: number };
export type Layers = { visited: boolean; planned: boolean; wishlist: boolean; route: boolean; cities: boolean; photos: boolean };
export const DEFAULT_LAYERS: Layers = { visited: true, planned: true, wishlist: true, route: true, cities: true, photos: false };
/** From this zoom on, badges and dots switch from per country to per city. */
const CITY_ZOOM = 2.5;

export function WorldMap({
  states,
  routes = [],
  cities = [],
  photoBadges,
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
  photoBadges?: { cities: PhotoBadge[]; countries: PhotoBadge[] };
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

  const arcs = useMemo(() => routes.map((r) => buildRouteLegs(r)), [routes]);
  const stops = useMemo(
    () =>
      routes.flatMap((r) => {
        let n = 0;
        return r.map((p) => {
          const xy = projection([p.lng, p.lat]) ?? [0, 0];
          return { ...p, n: p.home || p.minor ? 0 : ++n, x: r2(xy[0]), y: r2(xy[1]) };
        });
      }),
    [routes],
  );
  const [hoverLeg, setHoverLeg] = useState<{ leg: RouteLeg; x: number; y: number; w: number } | null>(null);
  const cityDots = useMemo(
    () =>
      cities.map((c) => {
        const xy = projection([c.lng, c.lat]) ?? [0, 0];
        return { ...c, xy: [r2(xy[0]), r2(xy[1])] };
      }),
    [cities],
  );
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
              list.map((a, i) => {
                const meta = transportMeta(a.mode);
                const solid = !meta.arc.dash;
                return (
                  <g key={`${ri}-${a.key}`}>
                    <path
                      d={a.d}
                      fill="none"
                      stroke={a.mode ? "var(--accent)" : "var(--muted)"}
                      strokeWidth={meta.arc.width}
                      strokeOpacity={a.mode ? 0.9 : 0.7}
                      strokeLinecap="round"
                      strokeDasharray={solid ? undefined : meta.arc.dash!}
                      vectorEffect="non-scaling-stroke"
                      pathLength={solid ? 1 : undefined}
                      className={reduce ? undefined : solid ? "arc-draw" : "arc-fade"}
                      style={reduce ? undefined : { animationDelay: `${i * 0.18}s` }}
                    />
                    {!reduce && solid && a.mode && meta.arc.width > 2 && (
                      <path d={a.d} fill="none" stroke="var(--surface)" strokeWidth={1.2} strokeOpacity={0.9} vectorEffect="non-scaling-stroke" className="arc-flow" style={{ animationDelay: `${1.4 + i * 0.18}s` }} />
                    )}
                    {!reduce && a.mode === "flight" && (
                      <g className="pointer-events-none">
                        <animateMotion dur={`${9 + i * 1.3}s`} repeatCount="indefinite" path={a.d} rotate="auto" begin={`${1.2 + i * 0.4}s`} />
                        <g transform={`scale(${inv * (compact ? 0.8 : 1)}) rotate(45)`}>
                          <Plane x={-6} y={-6} width={12} height={12} color="var(--ink)" fill="var(--surface)" strokeWidth={1.6} />
                        </g>
                      </g>
                    )}
                  </g>
                );
              }),
            )}
          {layers.cities &&
            t.k > CITY_ZOOM &&
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
            arcs.flat().filter((a) => a.length * t.k >= MIN_BADGE_LENGTH).map((a) => {
              const meta = transportMeta(a.mode);
              const Icon = meta.icon;
              return (
                <g
                  key={`badge-${a.key}`}
                  transform={`translate(${a.mid[0]},${a.mid[1]}) scale(${inv * (compact ? 0.75 : 1)})`}
                  className={compact ? undefined : "cursor-help"}
                  onMouseEnter={(e) => !compact && setHoverLeg({ leg: a, ...localPoint(e) } as { leg: RouteLeg; x: number; y: number; w: number })}
                  onMouseLeave={() => setHoverLeg(null)}
                  role="img"
                  aria-label={`${a.from.name ?? ""} to ${a.to.name ?? ""} by ${a.mode ? meta.label.toLowerCase() : "unknown transport"}`}
                >
                  <circle r={10} fill="var(--surface)" stroke={a.mode ? "var(--accent)" : "var(--border)"} strokeWidth={1.5} strokeDasharray={a.mode ? undefined : "2 2"} />
                  <Icon x={-6} y={-6} width={12} height={12} color={a.mode ? "var(--accent)" : "var(--muted)"} strokeWidth={2} />
                </g>
              );
            })}
          {layers.route &&
            stops.map((s) => {
              if (s.home) {
                return (
                  <g key={`home-${s.id}`} transform={`translate(${s.x},${s.y}) scale(${inv * (compact ? 0.9 : 1)})`} role="img" aria-label={`Home: ${s.name ?? ""}`}>
                    <circle r={8} fill="var(--surface)" stroke="var(--ink)" strokeWidth={1.5} />
                    <House x={-5} y={-5} width={10} height={10} color="var(--ink)" strokeWidth={2.2} />
                  </g>
                );
              }
              if (s.minor) {
                return (
                  <g key={`stop-${s.id}`} transform={`translate(${s.x},${s.y}) scale(${inv * (compact ? 0.9 : 1)})`} role="img" aria-label={s.name ?? "Stop"}>
                    <circle r={4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={1.5} />
                  </g>
                );
              }
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
          {layers.photos &&
            (t.k > CITY_ZOOM ? photoBadges?.cities : photoBadges?.countries)?.map((b) => {
              const xy = projection([b.lng, b.lat]);
              if (!xy) return null;
              const label = String(b.count);
              const width = 24 + label.length * 7;
              return (
                <g key={b.key} data-testid="photo-badge" transform={`translate(${r2(xy[0])},${r2(xy[1])}) scale(${inv})`} role="img" aria-label={`${b.count} photos in ${b.name}`}>
                  <title>{`${b.count} photos in ${b.name}`}</title>
                  <g transform="translate(14,-22)">
                    <rect x={0} y={0} width={width} height={20} rx={10} fill="var(--ink)" stroke="var(--surface)" strokeWidth={1.5} />
                    <Camera x={5} y={4} width={12} height={12} color="var(--surface)" strokeWidth={2} />
                    <text x={20} y={14} fontSize={11} fontWeight={600} fill="var(--surface)" className="num">
                      {label}
                    </text>
                  </g>
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

      {hoverLeg && !compact && (
        <div className="pointer-events-none absolute z-10 rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-lg" style={{ left: Math.min(hoverLeg.x + 14, hoverLeg.w - 260), top: hoverLeg.y + 14 }}>
          <p className="font-medium">
            {hoverLeg.leg.from.name ?? "Start"} → {hoverLeg.leg.to.name ?? ""}
          </p>
          <p className="text-xs text-muted">
            {[hoverLeg.leg.mode ? transportMeta(hoverLeg.leg.mode).label.toLowerCase() : "transport not set", hoverLeg.leg.to.note].filter(Boolean).join(" · ")}
          </p>
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

export function MapLegend({ layers, onToggle, className, modes = [], hasPhotos }: { layers: Layers; onToggle?: (key: keyof Layers) => void; className?: string; modes?: TransportMode[]; hasPhotos?: boolean }) {
  const items: { key: keyof Layers; label: string; color: string }[] = [
    { key: "visited", label: "Visited", color: "var(--visited)" },
    { key: "planned", label: "Planned", color: "var(--planned)" },
    { key: "wishlist", label: "Wishlist", color: "var(--wishlist)" },
    { key: "route", label: "Route", color: "var(--accent)" },
    { key: "cities", label: "Cities", color: "var(--ink)" },
    ...(hasPhotos ? [{ key: "photos" as const, label: "Photos", color: "var(--ink)" }] : []),
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
          ) : i.key === "photos" ? (
            <Camera className="size-3.5" style={{ color: i.color }} />
          ) : (
            <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          )}
          {i.label}
        </button>
      ))}
      {layers.route &&
        modes.map((m) => {
          const meta = TRANSPORT_META[m];
          return (
            <span key={m} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface/90 px-2.5 text-xs font-medium backdrop-blur">
              <svg width="18" height="6" aria-hidden className="shrink-0">
                <line x1="1" y1="3" x2="17" y2="3" stroke="var(--accent)" strokeWidth={Math.min(2.5, meta.arc.width)} strokeLinecap="round" strokeDasharray={meta.arc.dash ?? undefined} />
              </svg>
              <meta.icon className="size-3.5 text-accent" />
              {meta.label}
            </span>
          );
        })}
    </div>
  );
}
