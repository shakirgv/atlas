import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, type LucideIcon, Snowflake, Sun, Thermometer, ThermometerSun, ThumbsUp, Umbrella } from "lucide-react";

/** Verdict thresholds (°C, mm, days). Tune them here. */
export const CLIMATE = {
  veryHotMax: 35,
  hotMax: 30,
  /** Lower than the "feels freezing" 0 °C on purpose: see README Decisions. */
  freezingMin: -5,
  coldMin: 5,
  rainyWetDays: 15,
  rainyPrecip: 250,
  bestMaxLow: 18,
  bestMaxHigh: 30,
  bestWetDays: 8,
  /** A day counts as wet from this much precipitation. */
  wetDayMm: 1,
} as const;

export const CLIMATE_LABEL = "Typical conditions (last 5 years)";
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

export type ClimateMonth = { month: number; tmax: number; tmin: number; precip: number; wetDays: number };
export type Verdict = "very_hot" | "freezing" | "cold" | "rainy" | "hot" | "good";
export type VerdictTone = "good" | "info" | "warning" | "danger";
export type ForecastDay = { date: string; code: number; tmax: number; tmin: number; rainChance: number | null };
export type ClimateStop = { name: string; lat: number; lng: number; arrive: string | null; depart: string | null };

/** Worst first. A month takes the first verdict it matches; a longer stay takes its worst month. */
const VERDICT_ORDER: Verdict[] = ["very_hot", "freezing", "cold", "rainy", "hot", "good"];

export const VERDICT_META: Record<Verdict, { label: string; icon: LucideIcon; tone: VerdictTone }> = {
  very_hot: { label: "Very hot", icon: ThermometerSun, tone: "danger" },
  freezing: { label: "Freezing", icon: Snowflake, tone: "danger" },
  cold: { label: "Cold", icon: Thermometer, tone: "info" },
  rainy: { label: "Rainy season", icon: Umbrella, tone: "warning" },
  hot: { label: "Hot", icon: Sun, tone: "warning" },
  good: { label: "Good", icon: ThumbsUp, tone: "good" },
};

export function verdictForMonth(m: ClimateMonth): Verdict {
  if (m.tmax >= CLIMATE.veryHotMax) return "very_hot";
  if (m.tmin <= CLIMATE.freezingMin) return "freezing";
  if (m.tmin <= CLIMATE.coldMin) return "cold";
  if (m.wetDays >= CLIMATE.rainyWetDays || m.precip >= CLIMATE.rainyPrecip) return "rainy";
  if (m.tmax >= CLIMATE.hotMax) return "hot";
  return "good";
}

export function isBestMonth(m: ClimateMonth) {
  return verdictForMonth(m) === "good" && m.tmax >= CLIMATE.bestMaxLow && m.tmax <= CLIMATE.bestMaxHigh && m.wetDays <= CLIMATE.bestWetDays;
}

/** Calendar months (1-12) touched by a stay, in order. One known date counts as a one-month stay. */
export function monthsInStay(arrive: string | null | undefined, depart: string | null | undefined): number[] {
  const start = arrive ?? depart;
  const end = depart ?? arrive;
  if (!start || !end) return [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const ey = Number(end.slice(0, 4));
  const em = Number(end.slice(5, 7));
  const first = m;
  const out: number[] = [];
  for (let guard = 0; guard < 24 && (y < ey || (y === ey && m <= em)); guard++) {
    if (!out.includes(m)) out.push(m);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out.length ? out : [first];
}

/** Worst verdict over the months of a stay. No dates means no verdict. */
export function verdictForStay(months: ClimateMonth[], arrive: string | null | undefined, depart: string | null | undefined): { verdict: Verdict; month: ClimateMonth } | null {
  const covered = monthsInStay(arrive, depart)
    .map((n) => months.find((m) => m.month === n))
    .filter((m): m is ClimateMonth => Boolean(m));
  if (!covered.length) return null;
  const worst = [...covered].sort((a, b) => VERDICT_ORDER.indexOf(verdictForMonth(a)) - VERDICT_ORDER.indexOf(verdictForMonth(b)))[0]!;
  return { verdict: verdictForMonth(worst), month: worst };
}

/** Worst verdict across several stops (one route row can hold many cities). */
export function worstVerdict(stops: ClimateStop[], data: Record<string, ClimateMonth[] | undefined>) {
  const found = stops.flatMap((stop) => {
    const months = data[climateKey(stop.lat, stop.lng)];
    const v = months ? verdictForStay(months, stop.arrive, stop.depart) : null;
    return v ? [{ ...v, stop }] : [];
  });
  return found.sort((a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict))[0] ?? null;
}

export function verdictReason(m: ClimateMonth) {
  return `${MONTH_NAMES[m.month - 1]}: ${Math.round(m.tmin)} to ${Math.round(m.tmax)} °C, ${Math.round(m.precip)} mm, ${Math.round(m.wetDays)} wet days`;
}

/** Cache key: coordinates rounded to one decimal (about 11 km), which is plenty for climate normals. */
export function climateKey(lat: number, lng: number) {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

type DailySeries = { time: string[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[]; precipitation_sum: (number | null)[] };

/** Daily archive rows to per-month normals. Returns null unless all twelve months have data. */
export function aggregateDaily(daily: DailySeries): ClimateMonth[] | null {
  const acc = Array.from({ length: 12 }, () => ({ max: 0, maxN: 0, min: 0, minN: 0, rain: 0, wet: 0, years: new Set<string>() }));
  daily.time.forEach((t, i) => {
    const a = acc[Number(t.slice(5, 7)) - 1];
    if (!a) return;
    a.years.add(t.slice(0, 4));
    const max = daily.temperature_2m_max[i];
    const min = daily.temperature_2m_min[i];
    const rain = daily.precipitation_sum[i];
    if (max != null) {
      a.max += max;
      a.maxN++;
    }
    if (min != null) {
      a.min += min;
      a.minN++;
    }
    if (rain != null) {
      a.rain += rain;
      if (rain >= CLIMATE.wetDayMm) a.wet++;
    }
  });
  if (acc.some((a) => !a.maxN || !a.minN)) return null;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return acc.map((a, i) => ({ month: i + 1, tmax: r1(a.max / a.maxN), tmin: r1(a.min / a.minN), precip: r1(a.rain / a.years.size), wetDays: r1(a.wet / a.years.size) }));
}

/** WMO weather interpretation codes, as documented by Open-Meteo. */
export function weatherFromCode(code: number): { label: string; icon: LucideIcon } {
  if (code === 0) return { label: "Clear sky", icon: Sun };
  if (code === 1) return { label: "Mainly clear", icon: Sun };
  if (code === 2) return { label: "Partly cloudy", icon: CloudSun };
  if (code === 3) return { label: "Overcast", icon: Cloud };
  if (code === 45 || code === 48) return { label: "Fog", icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: CloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", icon: CloudRain };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", icon: CloudSnow };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", icon: CloudLightning };
  return { label: "Unknown", icon: Cloud };
}
