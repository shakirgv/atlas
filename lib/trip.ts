import { daysBetween, todayIso } from "@/lib/dates";
import type { CityVM, CountryVM } from "@/lib/data";
import type { DocumentRow, Expense, ItineraryDay, ItineraryItem, Trip } from "@/lib/types";

export type StepKey = "countries" | "cities" | "dates" | "days" | "budget" | "documents";
export type Step = { key: StepKey; label: string; hint: string; done: boolean; href?: string };

/** "Next steps" checklist guiding the core flow. */
export function nextSteps(args: {
  trip: Trip;
  countries: CountryVM[];
  cities: CityVM[];
  days: ItineraryDay[];
  items: ItineraryItem[];
  expenses: Expense[];
  documents: DocumentRow[];
}): Step[] {
  const { trip, countries, cities, days, items, expenses, documents } = args;
  const undated = countries.find((c) => !c.arrive_date || !c.depart_date);
  const firstWithoutDays = countries.find((c) => !days.some((d) => d.trip_country_id === c.id));
  return [
    { key: "countries", label: "Add countries", hint: "Pick every stop on the route", done: countries.length > 0 },
    { key: "cities", label: "Add cities", hint: "Search and pin them on the map", done: cities.length > 0 },
    {
      key: "dates",
      label: "Set dates",
      hint: undated ? `${undated.flag} ${undated.name} has no dates yet` : "Every country has dates",
      done: countries.length > 0 && !undated,
      href: undated ? `/countries/${undated.id}?edit=1` : undefined,
    },
    {
      key: "days",
      label: "Plan days",
      hint: "Generate days and add stops",
      done: items.length > 0,
      href: `/itinerary${firstWithoutDays ? `?country=${firstWithoutDays.id}` : countries[0] ? `?country=${countries[0].id}` : ""}`,
    },
    { key: "budget", label: "Set budget", hint: "A total, country caps or first expenses", done: Boolean(trip.total_budget) || expenses.length > 0 },
    { key: "documents", label: "Upload documents", hint: "Passport, visas, tickets", done: documents.some((d) => d.trip_id === trip.id || d.type === "passport") },
  ];
}

/** Trip progress: time elapsed when dated, otherwise checklist completion. */
export function tripProgress(trip: Trip, stepsDone: number, stepsTotal = 6) {
  if (trip.start_date && trip.end_date) {
    const today = todayIso();
    if (today < trip.start_date) return stepsDone / stepsTotal; // before departure: planning progress
    if (today > trip.end_date) return 1;
    const total = daysBetween(trip.start_date, trip.end_date);
    const done = daysBetween(trip.start_date, today);
    return total ? done / total : 0;
  }
  return stepsDone / stepsTotal;
}

/** Days on the road: elapsed days of trips that started (until today or end). */
export function daysOnTheRoad(countries: { arrive_date: string | null; depart_date: string | null; status: string }[]) {
  const today = todayIso();
  const seen = new Set<string>();
  for (const c of countries) {
    if (!c.arrive_date) continue;
    if (c.arrive_date > today) continue;
    const end = c.depart_date && c.depart_date < today ? c.depart_date : today;
    const s = new Date(`${c.arrive_date}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    for (let d = s; d <= e; d.setDate(d.getDate() + 1)) seen.add(d.toISOString().slice(0, 10));
  }
  return seen.size;
}
