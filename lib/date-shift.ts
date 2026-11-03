import { fmtDate, fmtRange, shiftIso } from "@/lib/dates";

export const SHIFT_MODES = ["extend", "move"] as const;
export type ShiftMode = (typeof SHIFT_MODES)[number];
export const MAX_SHIFT_DAYS = 365;

export type ShiftCountry = { id: string; name: string; flag: string; order_index: number; status: string; arrive_date: string | null; depart_date: string | null };
export type ShiftCity = { id: string; trip_country_id: string; name: string; order_index: number; arrive_date: string | null; depart_date: string | null };
export type ShiftDay = { id: string; trip_country_id: string; city_id: string | null; day_number: number; date: string | null; title: string | null; stops: number };
export type ShiftBooking = { id: string; type: string; title: string; status: string; trip_country_id: string | null; city_id: string | null; start_at: string | null; end_at: string | null };
export type ShiftData = {
  trip: { id: string; title: string; start_date: string | null; end_date: string | null };
  countries: ShiftCountry[];
  cities: ShiftCity[];
  days: ShiftDay[];
  bookings: ShiftBooking[];
};

export type ShiftInput = {
  /** "extend": this stay gets longer or shorter. "move": the whole stop moves. Later stops follow either way. */
  mode: ShiftMode;
  countryId: string;
  cityId: string | null;
  days: number;
  moveBookingIds: string[];
};

export type StopChange = { id: string; name: string; start_before: string | null; end_before: string | null; start_after: string | null; end_after: string | null };
export type CountryChange = StopChange & { flag: string; cities: StopChange[]; days: DayChange[] };
export type DayChange = { id: string; trip_country_id: string; name: string; stops: number; before: string; after: string };
export type BookingCheck = { booking: ShiftBooking; move: boolean; start_after: string | null; end_after: string | null; conflict: string | null };

export type ShiftPlan = {
  error: string | null;
  label: string;
  countries: CountryChange[];
  /** Fixed-date bookings near what moves. They stay put unless ticked. */
  bookings: BookingCheck[];
  trip: { start_before: string | null; end_before: string | null; start_after: string | null; end_after: string | null } | null;
  /** Days that would land after the shortened stay. They keep their date and content. */
  stranded: { name: string; date: string; stops: number }[];
  skipped: { undated: string[]; visited: string[] };
  /** Days the longer stay gains. Creating them is left to the itinerary's "Generate days". */
  newDays: number;
  counts: { countries: number; cities: number; days: number; stops: number; bookings: number };
};

export type ShiftChanges = {
  trips: { id: string; start_before: string | null; end_before: string | null; start_after: string | null; end_after: string | null }[];
  countries: Omit<StopChange, "name">[];
  cities: Omit<StopChange, "name">[];
  days: { id: string; start_before: string; start_after: string }[];
  bookings: { id: string; start_before: string | null; end_before: string | null; start_after: string | null; end_after: string | null }[];
};

const shift = (iso: string | null, days: number) => (iso ? shiftIso(iso, days) : null);
/** A booking's time moves by whole days; the time of day stays as it was. */
const shiftInstant = (iso: string | null, days: number) => (iso ? new Date(new Date(iso).getTime() + days * 86_400_000).toISOString() : null);
const dayOf = (iso: string | null) => iso?.slice(0, 10) ?? null;
const inOrder = <T extends { order_index: number }>(rows: T[]) => [...rows].sort((a, b) => a.order_index - b.order_index);
const change = (r: { id: string; name: string; arrive_date: string | null; depart_date: string | null }, start_after: string | null, end_after: string | null): StopChange => ({
  id: r.id,
  name: r.name,
  start_before: r.arrive_date,
  end_before: r.depart_date,
  start_after,
  end_after,
});
const moved = (r: { id: string; name: string; arrive_date: string | null; depart_date: string | null }, days: number) => change(r, shift(r.arrive_date, days), shift(r.depart_date, days));
const isChange = (c: StopChange) => c.start_before !== c.start_after || c.end_before !== c.end_after;
const dated = (r: { arrive_date: string | null; depart_date: string | null }) => Boolean(r.arrive_date || r.depart_date);

export function shiftLabel(days: number, name: string) {
  return `${days > 0 ? "+" : "−"}${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} from ${name}`;
}

const emptyPlan = (error: string | null): ShiftPlan => ({
  error,
  label: "",
  countries: [],
  bookings: [],
  trip: null,
  stranded: [],
  skipped: { undated: [], visited: [] },
  newDays: 0,
  counts: { countries: 0, cities: 0, days: 0, stops: 0, bookings: 0 },
});

/**
 * Works out every date a shift would change, without changing anything. The dialog shows this as the
 * preview and the server runs it again on fresh rows when applying, so what you saw is what gets saved.
 */
export function planDateShift(data: ShiftData, input: ShiftInput): ShiftPlan {
  const { days: n, mode } = input;
  const route = inOrder(data.countries);
  const at = route.findIndex((c) => c.id === input.countryId);
  const anchor = route[at];
  if (!anchor) return emptyPlan("Pick a stop.");
  if (!Number.isInteger(n) || Math.abs(n) > MAX_SHIFT_DAYS) return emptyPlan(`Use a whole number of days, up to ${MAX_SHIFT_DAYS}.`);
  if (n === 0) return emptyPlan(null);

  const anchorCities = inOrder(data.cities.filter((c) => c.trip_country_id === anchor.id));
  const city = input.cityId ? anchorCities.find((c) => c.id === input.cityId) : undefined;
  if (input.cityId && !city) return emptyPlan("Pick a city in this country.");
  const stop = city ?? anchor;
  const stopName = stop.name;

  if (mode === "extend" && !stop.depart_date) return emptyPlan(`Set a departure date for ${stopName} first.`);
  if (mode === "move" && !dated(stop)) return emptyPlan(`Set dates for ${stopName} first.`);
  if (mode === "extend" && stop.arrive_date && shift(stop.depart_date, n)! < stop.arrive_date) return emptyPlan(`${stopName} would end before it starts. Its stay is too short for that.`);

  const cityChanges: StopChange[] = [];
  const movedCityIds = new Set<string>();
  const moveCity = (c: ShiftCity) => {
    if (!dated(c)) return;
    cityChanges.push(moved(c, n));
    movedCityIds.add(c.id);
  };

  // The anchor country first: which of its cities move, and where its own dates end up.
  let anchorChange: StopChange;
  /** Days in the anchor country dated after this keep their place in the order, so they move too. */
  let boundary: string | null = null;
  let staysPut = new Set<string>();
  if (city) {
    const index = anchorCities.indexOf(city);
    const before = anchorCities.slice(0, index);
    const after = anchorCities.slice(index + 1);
    staysPut = new Set(before.map((c) => c.id));
    if (mode === "extend") {
      staysPut.add(city.id);
      cityChanges.push(change(city, city.arrive_date, shift(city.depart_date, n)));
      boundary = city.depart_date;
    } else {
      moveCity(city);
      boundary = city.arrive_date ? shiftIso(city.arrive_date, -1) : null;
    }
    after.forEach(moveCity);
    const firstDated = anchorCities.find(dated);
    const startMoves = mode === "move" && firstDated?.id === city.id && anchor.arrive_date === city.arrive_date;
    anchorChange = change(anchor, startMoves ? shift(anchor.arrive_date, n) : anchor.arrive_date, shift(anchor.depart_date, n));
  } else if (mode === "extend") {
    // The stay ends later, so its last dated city ends later with it. Earlier cities don't change.
    const last = [...anchorCities].reverse().find((c) => c.depart_date);
    if (last) {
      cityChanges.push(change(last, last.arrive_date, shift(last.depart_date, n)));
      staysPut.add(last.id);
    }
    anchorChange = change(anchor, anchor.arrive_date, shift(anchor.depart_date, n));
    boundary = anchor.depart_date;
  } else {
    anchorCities.forEach(moveCity);
    anchorChange = moved(anchor, n);
  }

  const anchorDays = data.days.filter((d) => d.trip_country_id === anchor.id && d.date);
  const moveAnchorDay = (d: ShiftDay) => {
    if (!city && mode === "move") return true;
    if (d.city_id && movedCityIds.has(d.city_id)) return true;
    if (d.city_id && staysPut.has(d.city_id)) return false;
    return boundary !== null && d.date! > boundary;
  };
  const dayName = (d: ShiftDay) => d.title || `Day ${d.day_number}`;
  const dayChange = (d: ShiftDay): DayChange => ({ id: d.id, trip_country_id: d.trip_country_id, name: dayName(d), stops: d.stops, before: d.date!, after: shiftIso(d.date!, n) });

  const skipped = { undated: [] as string[], visited: [] as string[] };
  const countries: CountryChange[] = [{ ...anchorChange, flag: anchor.flag, cities: cityChanges, days: anchorDays.filter(moveAnchorDay).map(dayChange) }];

  const later = route.slice(at + 1);
  for (const c of later) {
    // Somewhere I've already been didn't get later because this stop did.
    if (c.status === "visited") {
      skipped.visited.push(c.name);
      continue;
    }
    const cities = inOrder(data.cities.filter((x) => x.trip_country_id === c.id));
    const movedHere = cities.filter(dated);
    const daysHere = data.days.filter((d) => d.trip_country_id === c.id && d.date);
    if (!dated(c) && !movedHere.length && !daysHere.length) {
      skipped.undated.push(c.name);
      continue;
    }
    movedHere.forEach((x) => movedCityIds.add(x.id));
    countries.push({ ...moved(c, n), flag: c.flag, cities: movedHere.map((x) => moved(x, n)), days: daysHere.map(dayChange) });
  }

  // A shorter stay can strand days that were inside it. They hold content, so nothing happens to them silently.
  const newEnd = mode === "extend" ? shift(stop.depart_date, n) : null;
  const stranded =
    n < 0 && newEnd
      ? anchorDays
          .filter((d) => !moveAnchorDay(d) && d.date! > newEnd && d.date! <= stop.depart_date! && (!city || d.city_id === city.id || !d.city_id))
          .map((d) => ({ name: dayName(d), date: d.date!, stops: d.stops }))
      : [];

  const changedCountries = countries.filter((c) => isChange(c) || c.cities.length || c.days.length);
  const allDays = changedCountries.flatMap((c) => c.days);

  const bookingRows = bookingChecks(data, input, changedCountries);

  return {
    error: null,
    label: shiftLabel(n, stopName),
    countries: changedCountries,
    bookings: bookingRows,
    trip: tripChange(data.trip, n, mode, changedCountries),
    stranded,
    skipped,
    newDays: mode === "extend" && n > 0 && anchorDays.length ? n : 0,
    counts: {
      countries: changedCountries.filter(isChange).length,
      cities: changedCountries.reduce((s, c) => s + c.cities.length, 0),
      days: allDays.length,
      stops: allDays.reduce((s, d) => s + d.stops, 0),
      bookings: bookingRows.filter((b) => b.move).length,
    },
  };
}

/** The earliest date that actually changes. Everything from here on is affected. */
function firstChangedDate(countries: CountryChange[]) {
  return countries
    .flatMap((c) => [c, ...c.cities])
    .filter(isChange)
    .flatMap((c) => [c.start_before !== c.start_after ? c.start_before : null, c.end_before !== c.end_after ? c.end_before : null])
    .filter((d): d is string => Boolean(d))
    .sort()[0];
}

/** The trip's own dates follow the part of it that moved. */
function tripChange(trip: ShiftData["trip"], n: number, mode: ShiftMode, countries: CountryChange[]): ShiftPlan["trip"] {
  const first = firstChangedDate(countries);
  if (!first) return null;
  const endMoves = Boolean(trip.end_date && trip.end_date >= first);
  const anchor = countries[0];
  const startMoves = mode === "move" && Boolean(trip.start_date && anchor?.start_before === trip.start_date && anchor.start_after !== trip.start_date);
  if (!endMoves && !startMoves) return null;
  return { start_before: trip.start_date, end_before: trip.end_date, start_after: startMoves ? shift(trip.start_date, n) : trip.start_date, end_after: endMoves ? shift(trip.end_date, n) : trip.end_date };
}

const STAYS = new Set(["hotel", "hostel", "apartment"]);

/** What no longer lines up between a booking and the stop it belongs to, on the new dates. */
function bookingConflict(type: string, start: string, end: string | null, stop: StopChange) {
  if (!stop.start_after || !stop.end_after) return null;
  const range = fmtRange(stop.start_after, stop.end_after);
  if (start < stop.start_after || start > stop.end_after) return `Outside your new dates for ${stop.name} (${range})`;
  if (end && end > stop.end_after) return `Ends after you leave ${stop.name} (${range})`;
  const endMoved = stop.end_before !== stop.end_after;
  if (STAYS.has(type)) return endMoved && end && stop.end_before && end >= stop.end_before && end < stop.end_after ? `Ends before you leave ${stop.name} (${range})` : null;
  return endMoved && start === stop.end_before ? `Leaves on your old last day in ${stop.name}. You now stay until ${fmtDate(stop.end_after)}` : null;
}

/**
 * Tickets and hotels are real reservations, so they never move on their own. Every one touching what
 * moves is listed, with what no longer lines up against the new dates.
 */
function bookingChecks(data: ShiftData, input: ShiftInput, countries: CountryChange[]): BookingCheck[] {
  const stops = new Map(countries.flatMap((c) => [c, ...c.cities]).map((s) => [s.id, s]));
  const first = firstChangedDate(countries);
  const out: BookingCheck[] = [];
  for (const b of data.bookings) {
    if (b.status === "cancelled" || !b.start_at) continue;
    const start = dayOf(b.start_at)!;
    const linked = (b.city_id && stops.get(b.city_id)) || (b.trip_country_id && stops.get(b.trip_country_id)) || null;
    const during = linked ?? [...stops.values()].find((s) => s.start_before && s.end_before && s.start_before <= start && start <= s.end_before) ?? null;
    if (!during && !(first && start >= first)) continue;
    const move = input.moveBookingIds.includes(b.id);
    out.push({
      booking: b,
      move,
      start_after: move ? shiftInstant(b.start_at, input.days) : b.start_at,
      end_after: move ? shiftInstant(b.end_at, input.days) : b.end_at,
      conflict: !move && during ? bookingConflict(b.type, start, dayOf(b.end_at), during) : null,
    });
  }
  return out.sort((a, b) => Number(Boolean(b.conflict)) - Number(Boolean(a.conflict)) || (a.booking.start_at ?? "").localeCompare(b.booking.start_at ?? ""));
}

/** The before and after of every row, as the apply function takes it and the undo log keeps it. */
export function shiftChanges(plan: ShiftPlan, tripId: string): ShiftChanges {
  const strip = ({ id, start_before, end_before, start_after, end_after }: StopChange) => ({ id, start_before, end_before, start_after, end_after });
  return {
    trips: plan.trip ? [{ id: tripId, ...plan.trip }] : [],
    countries: plan.countries.filter(isChange).map(strip),
    cities: plan.countries.flatMap((c) => c.cities).filter(isChange).map(strip),
    days: plan.countries.flatMap((c) => c.days).map((d) => ({ id: d.id, start_before: d.before, start_after: d.after })),
    bookings: plan.bookings.filter((b) => b.move).map((b) => ({ id: b.booking.id, start_before: b.booking.start_at, end_before: b.booking.end_at, start_after: b.start_after, end_after: b.end_after })),
  };
}
