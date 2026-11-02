import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { getCountryByCcn3 } from "@/lib/countries";
import type { PublicPoint } from "@/lib/share";

const W = 960;
const H = 500;
const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
const FEATURES = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry>).features.filter((f) => f.id !== undefined && f.id !== "");

/**
 * Drawn entirely on the server, so only finished SVG shapes reach the page: no latitude or longitude
 * is ever sent to the visitor's browser, whichever location setting was chosen.
 */
export function PublicMap({ countries, points }: { countries: string[]; points: PublicPoint[] }) {
  const projection = geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: "Sphere" });
  const path = geoPath(projection);
  const highlight = new Set(countries);
  const dots = points.flatMap((p) => {
    const xy = projection([p.lng, p.lat]);
    return xy ? [{ x: Math.round(xy[0] * 10) / 10, y: Math.round(xy[1] * 10) / 10 }] : [];
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Map of the places in this story">
      <path d={path({ type: "Sphere" }) ?? ""} fill="var(--ocean)" />
      {FEATURES.map((f) => {
        const code = getCountryByCcn3(String(f.id))?.cca2;
        return <path key={String(f.id)} d={path(f) ?? ""} fill={code && highlight.has(code) ? "var(--visited)" : "var(--land)"} stroke="var(--land-stroke)" strokeWidth={0.5} />;
      })}
      {dots.length > 1 && <path d={`M${dots.map((d) => `${d.x},${d.y}`).join("L")}`} fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeDasharray="5 5" strokeLinecap="round" />}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.4} />
      ))}
    </svg>
  );
}
