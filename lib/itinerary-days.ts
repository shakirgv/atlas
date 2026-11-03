type DayLike = { id: string; day_number: number; date: string | null };

export type MissingDaysPlan = {
  /** Existing days whose position changes. A `date` is set only on an empty undated day taking a date. */
  renumber: { id: string; day_number: number; date?: string }[];
  insert: { date: string; day_number: number }[];
  /** How many dates of the stay gained a day. */
  created: number;
};

/**
 * How to fill the gaps in a stay. Only the dates with no day are touched: a day outside the stay stays too, even an empty one.
 * An empty undated day is a placeholder, so it takes a date before a new day is added, and the count stays honest.
 * Existing days only ever change number, to keep the days in date order.
 */
export function planMissingDays<T extends DayLike>(dates: string[], days: T[], hasContent: (day: T) => boolean): MissingDaysPlan {
  const taken = new Set(days.flatMap((d) => (d.date ? [d.date] : [])));
  const missing = dates.filter((date) => !taken.has(date));
  if (!missing.length) return { renumber: [], insert: [], created: 0 };

  const spares = days.filter((d) => !d.date && !hasContent(d));
  const assigned = new Map<string, string>();
  const newDates: string[] = [];
  for (const date of missing) {
    const spare = spares.shift();
    if (spare) assigned.set(spare.id, date);
    else newDates.push(date);
  }

  type Row = { id: string | null; date: string | null; number: number };
  const rows: Row[] = [
    ...days.map((d) => ({ id: d.id, date: assigned.get(d.id) ?? d.date, number: d.day_number })),
    ...newDates.map((date) => ({ id: null, date, number: Number.MAX_SAFE_INTEGER })),
  ];
  // Dated days in date order, then the undated ones in the order they were in.
  rows.sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) || a.number - b.number : a.date ? -1 : b.date ? 1 : a.number - b.number));

  const plan: MissingDaysPlan = { renumber: [], insert: [], created: missing.length };
  rows.forEach((row, i) => {
    const day_number = i + 1;
    if (!row.id) plan.insert.push({ date: row.date!, day_number });
    else if (assigned.has(row.id)) plan.renumber.push({ id: row.id, day_number, date: row.date! });
    else if (row.number !== day_number) plan.renumber.push({ id: row.id, day_number });
  });
  return plan;
}

export type DayGroup<T> = { cityId: string | null; name: string; days: T[] };

/** Days under their city, in route order. Days with no city, or a city since removed, come last. */
export function groupDaysByCity<T extends { city_id: string | null }>(days: T[], cities: { id: string; name: string }[]): DayGroup<T>[] {
  const known = new Set(cities.map((c) => c.id));
  const groups: DayGroup<T>[] = cities.map((c) => ({ cityId: c.id, name: c.name, days: days.filter((d) => d.city_id === c.id) }));
  groups.push({ cityId: null, name: "No city yet", days: days.filter((d) => !d.city_id || !known.has(d.city_id)) });
  return groups.filter((g) => g.days.length > 0);
}

/** A stop's time as written in the planner: "09:00 – 10:30", "09:00", or nothing. */
export function stopTime(start: string | null | undefined, end: string | null | undefined) {
  const from = start?.slice(0, 5) ?? "";
  const to = end?.slice(0, 5) ?? "";
  return from && to ? `${from} – ${to}` : from || to;
}
