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
