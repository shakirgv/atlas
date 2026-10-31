import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";

const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const land = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>;

/** Server-rendered decorative world map (no JS shipped). */
export function StaticWorld({ className, highlight = [] }: { className?: string; highlight?: string[] }) {
  const width = 960;
  const height = 500;
  const projection = geoNaturalEarth1().fitSize([width, height], { type: "Sphere" });
  const path = geoPath(projection);
  const hl = new Set(highlight);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <path d={path({ type: "Sphere" }) ?? ""} fill="var(--ocean)" />
      <path d={path(geoGraticule10()) ?? ""} fill="none" stroke="var(--border)" strokeWidth={0.5} />
      {land.features.map((f, i) => (
        <path
          key={String(f.id ?? i)}
          d={path(f) ?? ""}
          fill={f.id && hl.has(String(f.id)) ? "var(--accent)" : "var(--land)"}
          stroke="var(--land-stroke)"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}
