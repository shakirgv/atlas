import { tzOffset } from "@date-fns/tz";

/**
 * Client-safe time zone helpers (Intl-based, DST-aware). The coordinate → zone lookup
 * (`tzForCoords`) lives in `lib/server/tz-lookup.ts` so the ~70 KB boundary data never ships
 * to the browser.
 */

/** UTC offset in minutes for `tz` at `date` (e.g. +540 for Tokyo). Falls back to 0 for unknown zones. */
export function offsetMinutesAt(tz: string | null | undefined, date: Date | string = new Date()): number {
  if (!tz) return 0;
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T12:00:00Z`) : date;
  try {
    const off = tzOffset(tz, d);
    return Number.isFinite(off) ? off : 0;
  } catch {
    return 0;
  }
}

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "14:20" in the given zone. */
export function formatLocalTime(tz: string | null | undefined, date: Date = new Date(), opts: { seconds?: boolean } = {}) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz && isValidTimeZone(tz) ? tz : undefined,
      hour: "2-digit",
      minute: "2-digit",
      second: opts.seconds ? "2-digit" : undefined,
      hour12: false,
    }).format(date);
  } catch {
    return "--:--";
  }
}

/** Weekday + day in the zone, e.g. "Tue 14". */
export function formatLocalDay(tz: string | null | undefined, date: Date = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz && isValidTimeZone(tz) ? tz : undefined, weekday: "short", day: "numeric" }).format(date);
  } catch {
    return "";
  }
}

/** Short human offset difference: +5h, −3h 30m, same time. */
export function formatHourDiff(hours: number) {
  if (Math.abs(hours) < 0.01) return "same time";
  const sign = hours > 0 ? "+" : "−";
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${sign}${h}h${m ? ` ${m}m` : ""}`;
}

/** "UTC+5:30" */
export function formatUtcOffset(minutes: number) {
  const sign = minutes >= 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Last segment of an IANA name, readable: "America/New_York" → "New York". */
export function zoneCity(tz: string | null | undefined) {
  if (!tz) return "";
  return (tz.split("/").pop() ?? tz).replace(/_/g, " ");
}
