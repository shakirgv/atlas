"use client";
import { forwardRef, useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { SHAPES, buildRouteLegs, type RoutePoint } from "@/components/map/world-map";
import { fmtDate } from "@/lib/dates";
import { EXPORT_PALETTES, wrapText } from "@/lib/map-export";
import { EXPENSE_CATEGORY_META, formatMoney } from "@/lib/money";
import { MONTH_NAMES } from "@/lib/climate";
import type { RecapStats, SlideKey } from "@/lib/recap";
import { transportMeta } from "@/lib/transport";
import type { ExpenseCategory } from "@/lib/types";

export const SLIDE_W = 1080;
export const SLIDE_H = 1920;
const M = 96;
const P = EXPORT_PALETTES.dark;
const EARTH_KM = 40075;

export type SlideFonts = { display: string; body: string; flags: string };

const BG: Partial<Record<SlideKey, string>> = { intro: "#14202B", days: "#101B26", distance: "#16161F", money: "#101F1E", months: "#14202B", closing: "#1A1410" };

type TextProps = { y: number; size: number; children: React.ReactNode; fill?: string; family: string; weight?: number; x?: number; anchor?: "start" | "middle" | "end" };
function T({ y, size, children, fill = P.ink, family, weight = 500, x = M, anchor = "start" }: TextProps) {
  return (
    <text x={x} y={y} fontSize={size} fontFamily={family} fontWeight={weight} fill={fill} textAnchor={anchor}>
      {children}
    </text>
  );
}

function RouteMap({ route, top, height }: { route: RecapStats["route"]; top: number; height: number }) {
  const { projection, shapes, sphere } = useMemo(() => {
    const projection = geoNaturalEarth1();
    const box: [[number, number], [number, number]] = [[M / 2, top], [SLIDE_W - M / 2, top + height]];
    // A long route shows the world; a short one zooms to it, but never closer than a region.
    const span = Math.max(...route.map((r) => r.lng)) - Math.min(...route.map((r) => r.lng));
    if (span > 120) projection.fitExtent(box, { type: "Sphere" });
    else {
      const pad = Math.max(6, span * 0.25);
      const lats = route.map((r) => r.lat);
      const lngs = route.map((r) => r.lng);
      projection.fitExtent(box, { type: "MultiPoint", coordinates: [[Math.min(...lngs) - pad, Math.min(...lats) - pad], [Math.max(...lngs) + pad, Math.max(...lats) + pad]] });
    }
    projection.clipExtent([[0, top], [SLIDE_W, top + height]]);
    const path = geoPath(projection);
    return { projection, sphere: path({ type: "Sphere" }) ?? "", shapes: SHAPES.map((s) => ({ id: s.id, d: path(s.feature) ?? "" })) };
  }, [route, top, height]);
  const points: RoutePoint[] = route.map((r, i) => ({ id: String(i), code: "", lat: r.lat, lng: r.lng, name: r.name, mode: r.mode }));
  const legs = buildRouteLegs(points, projection);
  return (
    <g>
      <path d={sphere} fill={P.ocean} />
      {shapes.map((s) => (
        <path key={s.id} d={s.d} fill={P.land} stroke={P.landStroke} strokeWidth={0.8} />
      ))}
      <g fill="none" strokeLinecap="round">
        {legs.map((leg) => {
          const meta = transportMeta(leg.mode);
          return <path key={leg.key} d={leg.d} stroke={leg.mode ? P.accent : P.muted} strokeWidth={meta.arc.width * 1.8} strokeDasharray={meta.arc.dash ? meta.arc.dash.split(" ").map((n) => Number(n) * 2).join(" ") : undefined} />;
        })}
      </g>
      {points.map((pt) => {
        const xy = projection([pt.lng, pt.lat]);
        return xy ? <circle key={pt.id} cx={xy[0]} cy={xy[1]} r={8} fill={P.ink} stroke={P.bg ?? "#000"} strokeWidth={2.5} /> : null;
      })}
    </g>
  );
}

const fmtNumber = (n: number) => n.toLocaleString("en-US");

function Body({ slide, s, currency, f }: { slide: SlideKey; s: RecapStats; currency: string; f: SlideFonts }) {
  const big = (value: string, y = 760, size = 300) => (
    <T y={y} size={size} family={f.display} weight={600} fill={P.accent}>
      {value}
    </T>
  );
  const caption = (text: string, y: number, size = 76) => (
    <T y={y} size={size} family={f.display} weight={500}>
      {text}
    </T>
  );
  const note = (text: string, y: number, size = 40) => (
    <T y={y} size={size} family={f.body} fill={P.muted} weight={400}>
      {text}
    </T>
  );

  switch (slide) {
    case "intro": {
      const parts = [s.countries.length ? `${s.countries.length} ${s.countries.length === 1 ? "country" : "countries"}` : null, s.daysOnRoad ? `${s.daysOnRoad} days` : null, s.cities.length ? `${s.cities.length} ${s.cities.length === 1 ? "city" : "cities"}` : null].filter(Boolean);
      return (
        <>
          <T y={640} size={84} family={f.display} weight={500}>
            Your
          </T>
          <T y={s.period === "all" ? 860 : 900} size={s.period === "all" ? 210 : 300} family={f.display} weight={600} fill={P.accent}>
            {s.label}
          </T>
          <T y={1040} size={84} family={f.display} weight={500}>
            in travel
          </T>
          {note(parts.join("  ·  "), 1170, 44)}
        </>
      );
    }
    case "countries": {
      const flags = s.countries.slice(0, 24);
      return (
        <>
          {big(String(s.countries.length), 560)}
          {caption(s.countries.length === 1 ? "country" : "countries", 680)}
          {s.period !== "all" && note(`${s.newCountries} new  ·  ${s.revisited} revisited`, 760)}
          {flags.map((c, i) => (
            <text key={c.code} x={M + (i % 5) * 180} y={950 + Math.floor(i / 5) * 170} fontSize={120} fontFamily={f.flags}>
              {c.flag}
            </text>
          ))}
        </>
      );
    }
    case "route":
      return (
        <>
          {caption("Your route", 240, 92)}
          {note(`${s.route.length} stops`, 310)}
          <RouteMap route={s.route} top={400} height={1200} />
        </>
      );
    case "cities":
      return (
        <>
          {big(String(s.cities.length), 560)}
          {caption(s.cities.length === 1 ? "city" : "cities", 680)}
          {s.cities.slice(0, 9).map((c, i) => (
            <T key={c} y={830 + i * 86} size={56} family={f.body} fill={i === 0 ? P.ink : P.muted} weight={400}>
              {c}
            </T>
          ))}
        </>
      );
    case "days":
      return (
        <>
          {big(String(s.daysOnRoad))}
          {caption(s.daysOnRoad === 1 ? "day on the road" : "days on the road", 880)}
          {s.period !== "all" && note(`${Math.round((s.daysOnRoad / 365) * 100)}% of the year`, 970)}
        </>
      );
    case "distance": {
      const laps = s.distanceKm / EARTH_KM;
      return (
        <>
          {big(fmtNumber(s.distanceKm), 760, s.distanceKm >= 100000 ? 170 : s.distanceKm >= 10000 ? 210 : 260)}
          {caption("km travelled", 880)}
          {laps >= 0.1 && note(`${laps.toFixed(1)} times around the Earth`, 970)}
          {note("Approximate: straight lines between your stops.", 1040, 34)}
        </>
      );
    }
    case "longest":
      return (
        <>
          <text x={M} y={720} fontSize={240} fontFamily={f.flags}>
            {s.longestStay!.flag}
          </text>
          {wrapText(s.longestStay!.name, 15, 2).map((line, i) => (
            <T key={i} y={900 + i * 120} size={110} family={f.display} weight={600}>
              {line}
            </T>
          ))}
          {note(`Your longest stay: ${s.longestStay!.days} days`, 1120, 46)}
        </>
      );
    case "mostVisited":
      return (
        <>
          <text x={M} y={720} fontSize={240} fontFamily={f.flags}>
            {s.mostVisited!.flag}
          </text>
          {wrapText(s.mostVisited!.name, 15, 2).map((line, i) => (
            <T key={i} y={900 + i * 120} size={110} family={f.display} weight={600}>
              {line}
            </T>
          ))}
          {note(`You kept coming back: ${s.mostVisited!.visits} visits`, 1120, 46)}
        </>
      );
    case "places":
      return (
        <>
          {big(String(s.placesVisited), 560)}
          {caption(s.placesVisited === 1 ? "place visited" : "places visited", 680)}
          {s.topPlaces.length > 0 && note("Your favourites", 840, 38)}
          {s.topPlaces.map((p, i) =>
            wrapText(p.name, 26, 1).map((line) => (
              <g key={p.name}>
                <T y={930 + i * 100} size={58} family={f.display}>
                  {line}
                </T>
                <T x={SLIDE_W - M} anchor="end" y={930 + i * 100} size={48} family={f.body} fill={P.planned}>
                  {`${p.rating} ★`}
                </T>
              </g>
            )),
          )}
        </>
      );
    case "money": {
      const m = s.money!;
      const rows = [
        m.perDay !== null ? ["Per day on the road", formatMoney(m.perDay, currency)] : null,
        m.topCategory ? ["Most went on", EXPENSE_CATEGORY_META[m.topCategory.category as ExpenseCategory]?.label ?? m.topCategory.category] : null,
        m.priciestDay ? ["Priciest day", `${fmtDate(m.priciestDay.date, "dd MMM")}, ${formatMoney(m.priciestDay.total, currency)}`] : null,
        m.fees > 0 ? ["Cash fees paid", formatMoney(m.fees, currency)] : null,
      ].filter((r): r is string[] => Boolean(r));
      const total = formatMoney(m.total, currency);
      return (
        <>
          {note("You spent", 420, 56)}
          {big(total, 620, total.length > 8 ? 130 : total.length > 6 ? 170 : 210)}
          {rows.map(([label, value], i) => (
            <g key={label}>
              <line x1={M} x2={SLIDE_W - M} y1={780 + i * 170} y2={780 + i * 170} stroke={P.land} strokeWidth={2} />
              <T y={840 + i * 170} size={38} family={f.body} fill={P.muted} weight={400}>
                {label}
              </T>
              <T y={910 + i * 170} size={58} family={f.display}>
                {value}
              </T>
            </g>
          ))}
        </>
      );
    }
    case "photos": {
      const cell = (SLIDE_W - M * 2 - 24) / 2;
      const rowH = cell * 0.8;
      return (
        <>
          {big(String(s.photoCount), 400, 220)}
          {caption(s.photoCount === 1 ? "photo" : "photos", 510)}
          {s.mosaic.map((p, i) => {
            const x = M + (i % 2) * (cell + 24);
            const y = 600 + Math.floor(i / 2) * (rowH + 24);
            return (
              <g key={p.id}>
                <clipPath id={`clip-${p.id}`}>
                  <rect x={x} y={y} width={cell} height={rowH} rx={24} />
                </clipPath>
                <rect x={x} y={y} width={cell} height={rowH} rx={24} fill={P.land} />
                <image href={p.url ?? p.thumbUrl ?? undefined} x={x} y={y} width={cell} height={rowH} preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-${p.id})`} />
              </g>
            );
          })}
        </>
      );
    }
    case "memory": {
      const memory = s.favoriteMemory!;
      const lines = wrapText(memory.excerpt, 30, 9);
      return (
        <>
          <T y={420} size={200} family={f.display} fill={P.accent} weight={600}>
            “
          </T>
          {lines.map((line, i) => (
            <T key={i} y={540 + i * 88} size={62} family={f.display} weight={400}>
              {line}
            </T>
          ))}
          {note([memory.title, fmtDate(memory.date, "dd MMM yyyy")].filter(Boolean).join("  ·  "), 620 + lines.length * 88)}
        </>
      );
    }
    case "months": {
      const max = Math.max(...s.months);
      const barW = 44;
      const gap = (SLIDE_W - M * 2 - barW * 12) / 11;
      const base = 1320;
      const height = 620;
      return (
        <>
          {note("Your busiest month", 360, 48)}
          {caption(MONTH_NAMES[s.busiestMonth!]!, 480, 120)}
          {s.months.map((value, i) => {
            const h = max ? (value / max) * height : 0;
            const x = M + i * (barW + gap);
            const peak = i === s.busiestMonth;
            return (
              <g key={i}>
                {value > 0 && <rect x={x} y={base - h} width={barW} height={h} rx={10} fill={peak ? P.accent : P.wishlist} opacity={peak ? 1 : 0.55} />}
                {peak && (
                  <T x={x + barW / 2} anchor="middle" y={base - h - 24} size={40} family={f.body} weight={600}>
                    {value}
                  </T>
                )}
                <T x={x + barW / 2} anchor="middle" y={base + 56} size={34} family={f.body} fill={peak ? P.ink : P.muted} weight={peak ? 600 : 400}>
                  {MONTH_NAMES[i]![0]}
                </T>
              </g>
            );
          })}
          {note("Days on the road per month", base + 130, 36)}
        </>
      );
    }
    case "closing":
      return (
        <>
          <T y={760} size={118} family={f.display} weight={600}>
            Thanks for
          </T>
          <T y={890} size={118} family={f.display} weight={600}>
            the journey.
          </T>
          <T y={1040} size={70} family={f.display} fill={P.accent}>
            Where to next?
          </T>
        </>
      );
  }
}

/** One story slide. On screen and in the export it is this same SVG. */
export const RecapSlide = forwardRef<SVGSVGElement, { slide: SlideKey; stats: RecapStats; currency: string; fonts: SlideFonts; className?: string }>(function RecapSlide({ slide, stats, currency, fonts, className }, ref) {
  return (
    <svg ref={ref} viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`} xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label={`${stats.label} recap: ${slide}`}>
      <rect width={SLIDE_W} height={SLIDE_H} fill={BG[slide] ?? P.bg ?? "#0D1117"} />
      <Body slide={slide} s={stats} currency={currency} f={fonts} />
      <T x={SLIDE_W - M} anchor="end" y={SLIDE_H - 72} size={30} family={fonts.body} fill={P.muted} weight={500}>
        {`Atlas · ${stats.label}`}
      </T>
    </svg>
  );
});
