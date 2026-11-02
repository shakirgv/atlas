import { differenceInCalendarDays } from "date-fns";
import { datesInRange, toDate } from "@/lib/dates";
import { pathDistanceKm } from "@/lib/geo";

export type RecapPeriod = number | "all";

export type RecapStay = { id: string; code: string; name: string; flag: string; status: string; arrive: string | null; depart: string | null };
export type RecapStop = { key: string; kind: "city" | "country"; id: string; tripCountryId: string; name: string; lat: number | null; lng: number | null; arrive: string | null; mode: string | null };
export type RecapPlace = { id: string; name: string; cityId: string; status: string; rating: number | null };
export type RecapExpense = { date: string; kind: string; category: string; amount_base: number | string };
export type RecapMemory = { id: string; date: string; title: string | null; body: string | null };
export type RecapPhoto = { id: string; url: string | null; thumbUrl: string | null; date: string | null; caption: string | null; linked: "memory" | "cover" | "other" };

export type RecapInput = { today: string; stays: RecapStay[]; stops: RecapStop[]; places: RecapPlace[]; expenses: RecapExpense[]; memories: RecapMemory[]; photos: RecapPhoto[] };

export type RecapStats = {
  period: RecapPeriod;
  label: string;
  countries: { code: string; name: string; flag: string; isNew: boolean }[];
  newCountries: number;
  revisited: number;
  route: { name: string; lat: number; lng: number; mode: string | null }[];
  cities: string[];
  daysOnRoad: number;
  distanceKm: number;
  longestStay: { name: string; flag: string; days: number } | null;
  mostVisited: { name: string; flag: string; visits: number } | null;
  placesVisited: number;
  topPlaces: { name: string; rating: number }[];
  money: { total: number; perDay: number | null; topCategory: { category: string; total: number } | null; priciestDay: { date: string; total: number } | null; fees: number } | null;
  photoCount: number;
  mosaic: RecapPhoto[];
  favoriteMemory: { id: string; title: string | null; date: string; excerpt: string } | null;
  months: number[];
  busiestMonth: number | null;
};

const inPeriod = (date: string | null | undefined, period: RecapPeriod) => Boolean(date) && (period === "all" || date!.startsWith(`${period}-`));

/** A stay counts once it has begun; wishlist entries never do, even with dates in the past. */
function realStays(input: RecapInput) {
  return input.stays.filter((s) => s.status !== "wishlist" && s.arrive && s.arrive <= input.today);
}

/** The days of a stay that have actually happened (a missing departure counts as just the arrival day). */
function pastDates(stay: RecapStay, today: string) {
  const end = stay.depart ?? stay.arrive!;
  return datesInRange(stay.arrive!, end < today ? end : today);
}

/** Years with anything that already happened, newest first. Planned spending and future stays don't count. */
export function recapYears(input: RecapInput) {
  const { today } = input;
  const years = new Set<string>();
  for (const s of realStays(input)) for (const d of pastDates(s, today)) years.add(d.slice(0, 4));
  for (const e of input.expenses) if (e.kind === "actual" && e.date <= today) years.add(e.date.slice(0, 4));
  for (const m of input.memories) if (m.date <= today) years.add(m.date.slice(0, 4));
  for (const p of input.photos) if (p.date && p.date <= today) years.add(p.date.slice(0, 4));
  return [...years].map(Number).sort((a, b) => b - a);
}

export function computeRecap(input: RecapInput, period: RecapPeriod): RecapStats {
  const { today } = input;
  const stays = realStays(input);
  const inside = stays.map((s) => ({ s, days: pastDates(s, today).filter((d) => inPeriod(d, period)) })).filter((x) => x.days.length);

  // A country is new the first year it was ever visited. Over all time, every country is new.
  const firstYear = new Map<string, number>();
  for (const s of stays) {
    const y = Number(s.arrive!.slice(0, 4));
    firstYear.set(s.code, Math.min(firstYear.get(s.code) ?? y, y));
  }
  const unique = new Map<string, RecapStats["countries"][number]>();
  for (const { s } of inside) if (!unique.has(s.code)) unique.set(s.code, { code: s.code, name: s.name, flag: s.flag, isNew: period === "all" || firstYear.get(s.code) === period });
  const countries = [...unique.values()];

  const stayIds = new Set(inside.map((x) => x.s.id));
  const stops = input.stops.filter((s) => stayIds.has(s.tripCountryId) && s.arrive && s.arrive <= today && inPeriod(s.arrive, period)).sort((a, b) => a.arrive!.localeCompare(b.arrive!, "en"));
  const route = stops.flatMap((s) => (s.lat != null && s.lng != null ? [{ name: s.name, lat: s.lat, lng: s.lng, mode: s.mode }] : []));
  const cityStops = stops.filter((s) => s.kind === "city");
  const cities = [...new Set(cityStops.map((s) => s.name))];

  const allDays = new Set(inside.flatMap((x) => x.days));
  const months = Array.from({ length: 12 }, () => 0);
  for (const d of allDays) months[Number(d.slice(5, 7)) - 1]!++;
  const peak = Math.max(...months);

  const longest = [...inside].sort((a, b) => b.days.length - a.days.length)[0];
  const visits = new Map<string, { name: string; flag: string; visits: number; days: number }>();
  for (const { s, days } of inside) {
    const v = visits.get(s.code) ?? { name: s.name, flag: s.flag, visits: 0, days: 0 };
    visits.set(s.code, { ...v, visits: v.visits + 1, days: v.days + days.length });
  }
  const most = [...visits.values()].sort((a, b) => b.visits - a.visits || b.days - a.days)[0];

  const cityIds = new Set(cityStops.map((s) => s.id));
  const visitedPlaces = input.places.filter((p) => p.status === "visited" && cityIds.has(p.cityId));
  const topPlaces = visitedPlaces
    .flatMap((p) => (p.rating ? [{ name: p.name, rating: p.rating }] : []))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);

  const spent = input.expenses.filter((e) => e.kind === "actual" && e.date <= today && inPeriod(e.date, period));
  const byCategory = new Map<string, number>();
  const byDay = new Map<string, number>();
  let total = 0;
  for (const e of spent) {
    const amount = Number(e.amount_base);
    total += amount;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + amount);
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topCategory = top(byCategory);
  const priciest = top(byDay);

  const photos = input.photos.filter((p) => p.date && p.date <= today && inPeriod(p.date, period));
  const rank = { cover: 0, memory: 1, other: 2 };
  const mosaic = [...photos].filter((p) => p.url || p.thumbUrl).sort((a, b) => rank[a.linked] - rank[b.linked]).slice(0, 6);

  const memories = input.memories.filter((m) => m.date <= today && inPeriod(m.date, period) && (m.body ?? "").trim());
  const favorite = [...memories].sort((a, b) => (b.body ?? "").trim().length - (a.body ?? "").trim().length)[0];

  return {
    period,
    label: period === "all" ? "All time" : String(period),
    countries,
    newCountries: countries.filter((c) => c.isNew).length,
    revisited: countries.filter((c) => !c.isNew).length,
    route,
    cities,
    daysOnRoad: allDays.size,
    distanceKm: Math.round(pathDistanceKm(route)),
    longestStay: longest ? { name: longest.s.name, flag: longest.s.flag, days: longest.days.length } : null,
    // Worth a slide only when somewhere was actually returned to.
    mostVisited: most && most.visits > 1 ? { name: most.name, flag: most.flag, visits: most.visits } : null,
    placesVisited: visitedPlaces.length,
    topPlaces,
    money: spent.length
      ? {
          total: Math.round(total * 100) / 100,
          perDay: allDays.size ? Math.round((total / allDays.size) * 100) / 100 : null,
          topCategory: topCategory ? { category: topCategory[0], total: Math.round(topCategory[1] * 100) / 100 } : null,
          priciestDay: priciest ? { date: priciest[0], total: Math.round(priciest[1] * 100) / 100 } : null,
          fees: Math.round((byCategory.get("fees") ?? 0) * 100) / 100,
        }
      : null,
    photoCount: photos.length,
    mosaic,
    favoriteMemory: favorite ? { id: favorite.id, title: favorite.title, date: favorite.date, excerpt: excerpt(favorite.body ?? "") } : null,
    months,
    busiestMonth: peak > 0 ? months.indexOf(peak) : null,
  };
}

/** Plain text from markdown, cut at a word. */
function excerpt(body: string, max = 260) {
  const text = body.replace(/[*_`#>~[\]]/g, "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export const SLIDE_KEYS = ["intro", "countries", "route", "cities", "days", "distance", "longest", "mostVisited", "places", "money", "photos", "memory", "months", "closing"] as const;
export type SlideKey = (typeof SLIDE_KEYS)[number];

/** The slides with something to say. Intro and closing only appear around real content. */
export function recapSlides(s: RecapStats): SlideKey[] {
  const has: Record<SlideKey, boolean> = {
    intro: true,
    countries: s.countries.length > 0,
    route: s.route.length > 1,
    cities: s.cities.length > 0,
    days: s.daysOnRoad > 0,
    distance: s.distanceKm > 0,
    longest: Boolean(s.longestStay),
    mostVisited: Boolean(s.mostVisited),
    places: s.placesVisited > 0,
    money: Boolean(s.money),
    photos: s.photoCount > 0,
    memory: Boolean(s.favoriteMemory),
    months: s.busiestMonth !== null,
    closing: true,
  };
  const body = SLIDE_KEYS.filter((k) => k !== "intro" && k !== "closing" && has[k]);
  return body.length ? ["intro", ...body, "closing"] : [];
}

/** Which year the dashboard offers. Prominent from 1 December to 31 January, otherwise a small link. */
export function recapEntry(today: string, years: number[]) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const seasonal = m === 12 ? y : m === 1 ? y - 1 : null;
  if (seasonal !== null && years.includes(seasonal)) return { year: seasonal, prominent: true };
  const latest = years.find((yr) => yr < y) ?? years[0];
  return latest === undefined ? null : { year: latest, prominent: false };
}

export type OnThisDayItem =
  | { kind: "memory"; id: string; date: string; yearsAgo: number; title: string; place: string | null; thumbUrl: string | null }
  | { kind: "photo"; id: string; date: string; yearsAgo: number; title: string; place: string | null; thumbUrl: string | null; url: string | null; caption: string | null };

/**
 * The anniversary of `today` closest to a date, in an earlier year, within a day either way. It looks
 * at neighbouring years too, so 1 January still matches a 31 December "today". Returns years ago, or null.
 */
export function yearsAgoIfAnniversary(date: string, today: string) {
  const d = toDate(date);
  const now = toDate(today);
  if (!d || !now) return null;
  const y = d.getFullYear();
  for (const year of [y, y - 1, y + 1]) {
    if (year >= now.getFullYear()) continue;
    const anniversary = new Date(year, now.getMonth(), now.getDate());
    if (Math.abs(differenceInCalendarDays(d, anniversary)) <= 1) return now.getFullYear() - year;
  }
  return null;
}

type OnThisDayMemory = { id: string; date: string; title: string | null; body: string | null; place: string | null; thumbUrl: string | null };
type OnThisDayPhoto = { id: string; date: string; caption: string | null; place: string | null; thumbUrl: string | null; url: string | null; memoryId: string | null };

/** At most three, most recent year first, exact day before a neighbouring one. A matched memory stands for its own photos. */
export function onThisDay(memories: OnThisDayMemory[], photos: OnThisDayPhoto[], today: string, limit = 3): OnThisDayItem[] {
  const items: OnThisDayItem[] = [];
  const shown = new Set<string>();
  for (const m of memories) {
    const yearsAgo = yearsAgoIfAnniversary(m.date, today);
    if (yearsAgo === null) continue;
    shown.add(m.id);
    items.push({ kind: "memory", id: m.id, date: m.date, yearsAgo, title: m.title || (m.body ?? "").replace(/[*_`#>]/g, "").trim().slice(0, 60) || "A memory", place: m.place, thumbUrl: m.thumbUrl });
  }
  for (const p of photos) {
    if (p.memoryId && shown.has(p.memoryId)) continue;
    const yearsAgo = yearsAgoIfAnniversary(p.date, today);
    if (yearsAgo === null) continue;
    items.push({ kind: "photo", id: p.id, date: p.date, yearsAgo, title: p.caption || "A photo", place: p.place, thumbUrl: p.thumbUrl, url: p.url, caption: p.caption });
  }
  const offset = (date: string) => {
    const now = toDate(today)!;
    const d = toDate(date)!;
    return Math.abs(differenceInCalendarDays(d, new Date(d.getFullYear(), now.getMonth(), now.getDate())));
  };
  return items.sort((a, b) => a.yearsAgo - b.yearsAgo || offset(a.date) - offset(b.date)).slice(0, limit);
}

export function yearsAgoLabel(n: number) {
  return `${n} year${n === 1 ? "" : "s"} ago`;
}
