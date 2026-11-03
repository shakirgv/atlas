import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  formatDistanceToNowStrict,
  isValid,
  parseISO,
} from "date-fns";

export const WEEK_STARTS_ON = 1 as const; // Monday
export const DATE_FORMAT = "dd MMM yyyy";

/** Parse a `yyyy-MM-dd` (or ISO) string as a local date. */
export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function fmtDate(value: string | Date | null | undefined, pattern = DATE_FORMAT) {
  const d = toDate(value);
  return d ? format(d, pattern) : "—";
}

export function fmtShort(value: string | Date | null | undefined) {
  return fmtDate(value, "dd MMM");
}

export function fmtRange(start: string | null | undefined, end: string | null | undefined) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s && !e) return "No dates yet";
  if (s && !e) return `From ${format(s, DATE_FORMAT)}`;
  if (!s && e) return `Until ${format(e, DATE_FORMAT)}`;
  if (format(s!, DATE_FORMAT) === format(e!, DATE_FORMAT)) return format(s!, DATE_FORMAT);
  if (s!.getFullYear() === e!.getFullYear()) {
    if (s!.getMonth() === e!.getMonth()) return `${format(s!, "dd")} – ${format(e!, DATE_FORMAT)}`;
    return `${format(s!, "dd MMM")} – ${format(e!, DATE_FORMAT)}`;
  }
  return `${format(s!, DATE_FORMAT)} – ${format(e!, DATE_FORMAT)}`;
}

/** `yyyy-MM-dd` for a Date (local). */
export function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function todayIso() {
  return isoDate(new Date());
}

export function shiftIso(iso: string, days: number) {
  const d = toDate(iso);
  return d ? isoDate(addDays(d, days)) : iso;
}

export function daysBetween(start: string | null | undefined, end: string | null | undefined) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return 0;
  return Math.max(0, differenceInCalendarDays(e, s) + 1);
}

/** "9-day stay", counting both the day of arrival and the day of departure. Empty without both dates. */
export function stayLabel(start: string | null | undefined, end: string | null | undefined) {
  const n = daysBetween(start, end);
  return n ? `${n}-day stay` : "";
}

/** Days planned in the itinerary, kept apart from the length of the stay: "9-day stay · 0 itinerary days". */
export function durationLabel(start: string | null | undefined, end: string | null | undefined, itineraryDays: number) {
  return [stayLabel(start, end), `${itineraryDays} itinerary ${itineraryDays === 1 ? "day" : "days"}`].filter(Boolean).join(" · ");
}

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** Stands in for a date that is only part filled in. It fails the forms' date check, so it is refused rather than saved as no date. */
export const INCOMPLETE_DATE = "incomplete";

export type DateParts = { day: string; month: string; year: string };

export function splitDate(value: string | null | undefined): DateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return m ? { year: m[1]!, month: m[2]!, day: m[3]! } : { day: "", month: "", year: "" };
}

/** Days to offer for a month. Before a month or a year is chosen, the most a date could still need. */
export function daysInMonth(year: string, month: string) {
  return new Date(/^\d{4}$/.test(year) ? Number(year) : 2000, month ? Number(month) : 1, 0).getDate();
}

export function joinDate({ day, month, year }: DateParts) {
  if (!day && !month && !year) return "";
  return day && month && /^\d{4}$/.test(year) && Number(year) >= 1900 ? `${year}-${month}-${day}` : INCOMPLETE_DATE;
}

export function daysUntil(value: string | null | undefined, from: Date = new Date()) {
  const d = toDate(value);
  if (!d) return null;
  return differenceInCalendarDays(d, from);
}

export function datesInRange(start: string, end: string) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e || e < s) return [];
  return eachDayOfInterval({ start: s, end: e }).map(isoDate);
}

export function isOngoing(start: string | null | undefined, end: string | null | undefined, today = todayIso()) {
  if (!start || !end) return false;
  return start <= today && today <= end;
}

export function relative(value: string | null | undefined) {
  const d = toDate(value);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : "";
}

/** "in 42 days", "tomorrow", "today", "3 days ago" */
export function countdownLabel(value: string | null | undefined) {
  const n = daysUntil(value);
  if (n === null) return "";
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${Math.abs(n)} days ago`;
}

export function fmtTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

export function monthKey(value: string) {
  return value.slice(0, 7);
}

export function fmtMonth(key: string) {
  const d = toDate(`${key}-01`);
  return d ? format(d, "MMMM yyyy") : key;
}
