import { fmtRange } from "@/lib/dates";

export const PRINT_SCOPES = ["country", "city", "range", "trip"] as const;
export type PrintScope = (typeof PRINT_SCOPES)[number];

export type PrintSelection = { scope: PrintScope; countryId: string | null; cityId: string | null; from: string | null; to: string | null };
export type PrintOptions = { addresses: boolean; notes: boolean; checkboxes: boolean };
export const PRINT_OPTIONS = ["addresses", "notes", "checkboxes"] as const satisfies readonly (keyof PrintOptions)[];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);
const isIso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * The print page's address. An old link with only `?country=` still prints that country, and one with nothing prints the trip.
 * Each part of the page is on unless the address turns it off with `=0`.
 */
export function parsePrint(params: Params): { selection: PrintSelection; options: PrintOptions } {
  const countryId = one(params.country);
  const cityId = one(params.city);
  const asked = PRINT_SCOPES.find((s) => s === params.scope);
  const scope: PrintScope = asked ?? (cityId ? "city" : countryId ? "country" : "trip");
  return {
    selection: { scope, countryId, cityId, from: isIso(one(params.from)), to: isIso(one(params.to)) },
    options: { addresses: params.addresses !== "0", notes: params.notes !== "0", checkboxes: params.checkboxes !== "0" },
  };
}

type DayLike = { date: string | null; city_id: string | null; trip_country_id: string };

/** The days a selection prints. A date range takes only dated days, and either end may be left open. */
export function selectPrintDays<D extends DayLike>(days: D[], sel: PrintSelection): D[] {
  switch (sel.scope) {
    case "trip":
      return days;
    case "country":
      return days.filter((d) => d.trip_country_id === sel.countryId);
    case "city":
      return days.filter((d) => d.city_id === sel.cityId);
    case "range":
      return days.filter((d) => d.date && (!sel.from || d.date >= sel.from) && (!sel.to || d.date <= sel.to));
  }
}

type Dated = { arrive_date: string | null; depart_date: string | null };

export type PrintHeading = { eyebrow: string; flag: string | null; title: string; range: string; documentTitle: string };

/**
 * The title and dates the printout opens with, for what was chosen. The browser names a saved PDF after `documentTitle`.
 * A stay's own dates come first; without them the dates of the days printed stand in.
 */
export function printHeading(
  sel: PrintSelection,
  ctx: {
    appName: string;
    trip: { title: string; start_date: string | null; end_date: string | null };
    country: ({ name: string; flag: string } & Dated) | null;
    city: ({ name: string } & Dated) | null;
    dates: (string | null)[];
  },
): PrintHeading {
  const dated = ctx.dates.filter((d): d is string => Boolean(d)).sort();
  const span = (start: string | null | undefined, end: string | null | undefined) => (start || end ? fmtRange(start, end) : fmtRange(dated[0], dated.at(-1)));
  const base = `${ctx.appName} · Itinerary`;
  let out: Omit<PrintHeading, "documentTitle">;
  if (sel.scope === "country" && ctx.country) {
    out = { eyebrow: `${ctx.trip.title} · Itinerary`, flag: ctx.country.flag, title: ctx.country.name, range: span(ctx.country.arrive_date, ctx.country.depart_date) };
  } else if (sel.scope === "city" && ctx.city) {
    out = { eyebrow: [ctx.trip.title, ctx.country?.name].filter(Boolean).join(" · "), flag: ctx.country?.flag ?? null, title: ctx.city.name, range: span(ctx.city.arrive_date, ctx.city.depart_date) };
  } else if (sel.scope === "range") {
    out = { eyebrow: base, flag: null, title: ctx.trip.title, range: span(sel.from ?? dated[0], sel.to ?? dated.at(-1)) };
  } else {
    out = { eyebrow: base, flag: null, title: ctx.trip.title, range: span(ctx.trip.start_date, ctx.trip.end_date) };
  }
  return { ...out, documentTitle: `${out.title} itinerary · ${out.range}` };
}
