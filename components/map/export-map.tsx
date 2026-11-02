"use client";
import { forwardRef, useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { House } from "lucide-react";
import { EXPORT_ASPECTS, EXPORT_PALETTES, wrapText, type ExportAspect, type ExportPalette, type ExportTheme } from "@/lib/map-export";
import { transportMeta, TRANSPORT_META } from "@/lib/transport";
import { TRANSPORT_MODES } from "@/lib/types";
import { buildRouteLegs, modesInUse, SHAPES, type MapCity, type RoutePoint } from "./world-map";

export type ExportOptions = {
  aspect: ExportAspect;
  theme: ExportTheme;
  title: string;
  show: { visited: boolean; planned: boolean; wishlist: boolean; route: boolean; cities: boolean; stats: boolean; legend: boolean };
};

export type ExportContent = {
  /** Country code → status to paint. */
  states: Record<string, string>;
  routes: RoutePoint[][];
  cities: MapCity[];
  stats: string[];
};

const LEGEND = (p: ExportPalette) => [
  { key: "visited" as const, label: "Visited", color: p.visited },
  { key: "planned" as const, label: "Planned", color: p.planned },
  { key: "wishlist" as const, label: "Wishlist", color: p.wishlist },
];

/** A finished poster of the map, drawn only with explicit colours so it survives being serialized. */
export const ExportMap = forwardRef<SVGSVGElement, { options: ExportOptions; content: ExportContent; display?: string; body?: string; className?: string }>(function ExportMap({ options, content, display = "serif", body = "sans-serif", className }, ref) {
  const { aspect, theme, title, show } = options;
  const { width: W, height: H } = EXPORT_ASPECTS[aspect];
  const p = EXPORT_PALETTES[theme];
  const margin = Math.round(Math.min(W, H) * 0.075);
  const wide = W > H;
  const titleSize = Math.round((wide ? H : W) * (wide ? 0.075 : 0.085));
  const lines = useMemo(() => wrapText(title, wide ? 34 : 18, 2), [title, wide]);
  const titleBlock = lines.length ? margin + lines.length * titleSize * 1.05 : margin;
  const hasStats = show.stats && content.stats.length > 0;
  const unit = Math.min(W, H) / 1080;
  // Tall shapes have room to spare, so the numbers get a line each at a large size.
  const stacked = H / W > 1.3;
  const statSize = Math.round(unit * (stacked ? 76 : wide ? 34 : 38));
  const statLines = !hasStats ? [] : stacked ? content.stats : [content.stats.join("  ·  ")];
  const legendSize = Math.round(unit * 24);
  const footer = statLines.length * statSize * 1.2 + (show.legend ? legendSize * 2.4 : 0) + margin;

  // Fitted to the space left between the title and the footer, centred, and never cropped.
  const projection = useMemo(() => geoNaturalEarth1().fitExtent([[margin, titleBlock + margin * 0.5], [W - margin, H - footer - margin * 0.25]], { type: "Sphere" }), [W, H, margin, titleBlock, footer]);
  const path = useMemo(() => geoPath(projection), [projection]);
  const sphere = useMemo(() => path({ type: "Sphere" }) ?? "", [path]);
  const shapes = useMemo(() => SHAPES.map((s) => ({ ...s, projected: path(s.feature) ?? "" })), [path]);
  const legs = useMemo(() => content.routes.flatMap((r) => buildRouteLegs(r, projection)), [content.routes, projection]);
  const modes = useMemo(() => modesInUse(content.routes), [content.routes]);

  const statusColor = (code: string | null) => {
    const status = code ? content.states[code] : undefined;
    if (status === "visited" && show.visited) return p.visited;
    if (status === "planned" && show.planned) return p.planned;
    if (status === "wishlist" && show.wishlist) return p.wishlist;
    return p.land;
  };

  const legendItems = LEGEND(p).filter((i) => show[i.key] && Object.values(content.states).includes(i.key));
  const legendY = H - margin;
  const statsY = legendY - (show.legend ? legendSize * 2.4 : 0);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label={title || "Travel map"}>
      {p.bg && <rect width={W} height={H} fill={p.bg} />}
      <path d={sphere} fill={p.ocean} />
      <g>
        {shapes.map((s) => (
          <path key={s.id} d={s.projected} fill={statusColor(s.code)} stroke={p.landStroke} strokeWidth={0.7 * unit} />
        ))}
      </g>
      {show.route && (
        <g fill="none" strokeLinecap="round">
          {legs.map((leg) => {
            const meta = transportMeta(leg.mode);
            return <path key={leg.key} d={leg.d} stroke={leg.mode ? p.accent : p.muted} strokeWidth={meta.arc.width * 1.3 * unit} strokeOpacity={leg.mode ? 0.95 : 0.7} strokeDasharray={meta.arc.dash ? meta.arc.dash.split(" ").map((n) => Number(n) * 1.4 * unit).join(" ") : undefined} />;
          })}
        </g>
      )}
      {show.cities &&
        content.cities.map((c) => {
          const xy = projection([c.lng, c.lat]);
          return xy ? <circle key={c.id} cx={xy[0]} cy={xy[1]} r={3.2 * unit} fill={p.surface} stroke={p.ink} strokeWidth={1.3 * unit} /> : null;
        })}
      {show.route &&
        legs
          .filter((leg) => leg.length > 60 * unit)
          .map((leg) => {
            const meta = transportMeta(leg.mode);
            const r = 12 * unit;
            return (
              <g key={`badge-${leg.key}`} transform={`translate(${leg.mid[0]},${leg.mid[1]})`}>
                <circle r={r} fill={p.surface} stroke={leg.mode ? p.accent : p.muted} strokeWidth={1.6 * unit} />
                <meta.icon x={-r * 0.62} y={-r * 0.62} width={r * 1.24} height={r * 1.24} color={leg.mode ? p.accent : p.muted} strokeWidth={2} />
              </g>
            );
          })}
      {show.route &&
        content.routes.flat().map((pt) => {
          const xy = projection([pt.lng, pt.lat]);
          if (!xy) return null;
          if (pt.home) {
            const r = 11 * unit;
            return (
              <g key={`home-${pt.id}`} transform={`translate(${xy[0]},${xy[1]})`}>
                <circle r={r} fill={p.surface} stroke={p.ink} strokeWidth={1.6 * unit} />
                <House x={-r * 0.6} y={-r * 0.6} width={r * 1.2} height={r * 1.2} color={p.ink} strokeWidth={2.2} />
              </g>
            );
          }
          return <circle key={`stop-${pt.id}`} cx={xy[0]} cy={xy[1]} r={(pt.minor ? 3.5 : 5.5) * unit} fill={p.ink} stroke={p.surface} strokeWidth={1.4 * unit} />;
        })}

      {lines.map((line, i) => (
        <text key={i} x={margin} y={margin + titleSize * 0.85 + i * titleSize * 1.05} fontFamily={display} fontSize={titleSize} fontWeight={600} fill={p.ink} letterSpacing={-0.5 * unit}>
          {line}
        </text>
      ))}
      {statLines.map((line, i) => (
        <text key={line} x={margin} y={statsY - (statLines.length - 1 - i) * statSize * 1.2} fontFamily={display} fontSize={statSize} fontWeight={stacked ? 600 : 500} fill={p.ink} letterSpacing={-0.3 * unit}>
          {line}
        </text>
      ))}
      {show.legend && (
        <g fontFamily={body} fontSize={legendSize} fill={p.muted}>
          {(() => {
            let x = margin;
            const out: React.ReactNode[] = [];
            for (const item of legendItems) {
              const start = x;
              out.push(
                <g key={item.key}>
                  <rect x={start} y={legendY - legendSize * 0.72} width={legendSize * 0.72} height={legendSize * 0.72} rx={3 * unit} fill={item.color} />
                  <text x={start + legendSize} y={legendY}>
                    {item.label}
                  </text>
                </g>,
              );
              x += legendSize + item.label.length * legendSize * 0.56 + legendSize;
            }
            if (show.route) {
              for (const mode of TRANSPORT_MODES.filter((m) => modes.includes(m))) {
                const meta = TRANSPORT_META[mode];
                const start = x;
                const lineW = legendSize * 1.4;
                out.push(
                  <g key={mode}>
                    <line x1={start} x2={start + lineW} y1={legendY - legendSize * 0.34} y2={legendY - legendSize * 0.34} stroke={p.accent} strokeWidth={Math.max(2, meta.arc.width * 1.3) * unit} strokeLinecap="round" strokeDasharray={meta.arc.dash ? meta.arc.dash.split(" ").map((n) => Number(n) * 1.4 * unit).join(" ") : undefined} />
                    <text x={start + lineW + legendSize * 0.35} y={legendY}>
                      {meta.label}
                    </text>
                  </g>,
                );
                x += lineW + legendSize * 0.35 + meta.label.length * legendSize * 0.56 + legendSize;
              }
            }
            return out;
          })()}
        </g>
      )}
    </svg>
  );
});
