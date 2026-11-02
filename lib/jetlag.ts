import { offsetMinutesAt } from "@/lib/timezones";

/** Shifts below this many hours are not shown at all. */
export const JETLAG_MIN_HOURS = 3;
/** From this many hours the shift counts as "strong" (and the itinerary suggests a light first day). */
export const JETLAG_STRONG_HOURS = 6;

export type JetLagSeverity = "none" | "moderate" | "strong";
export type JetLag = {
  /** Signed hours: positive = eastward (clocks jump forward). Can be fractional (India, Nepal…). */
  shift: number;
  direction: "east" | "west" | "none";
  severity: JetLagSeverity;
  /** Rough adaptation estimate in days (see `adaptationDays`). */
  days: number;
};

/**
 * Shift in hours between the origin's offset on the departure date and the destination's offset
 * on the arrival date (both DST-aware). Normalised into (−12, +12]: a +14 h jump is experienced
 * as −10 h, because the body adapts along the shorter direction.
 */
export function shiftHours(fromTz: string, fromDate: Date | string, toTz: string, toDate: Date | string): number {
  const minutes = offsetMinutesAt(toTz, toDate) - offsetMinutesAt(fromTz, fromDate);
  let h = minutes / 60;
  while (h > 12) h -= 24;
  while (h <= -12) h += 24;
  return Math.round(h * 100) / 100;
}

/**
 * Rough heuristic, NOT medical guidance: adapting eastward takes about one day per hour of
 * shift, westward about half a day per hour (the body clock runs slightly longer than 24 h, so
 * delaying is easier than advancing). Rounded up and capped at 7 days.
 */
export function adaptationDays(shift: number): number {
  const abs = Math.abs(shift);
  if (abs < 0.01) return 0;
  const perHour = shift > 0 ? 1 : 0.5;
  return Math.min(7, Math.ceil(abs * perHour));
}

export function severityFor(shift: number): JetLagSeverity {
  const abs = Math.abs(shift);
  if (abs < JETLAG_MIN_HOURS) return "none";
  return abs >= JETLAG_STRONG_HOURS ? "strong" : "moderate";
}

export function jetLag(fromTz: string | null | undefined, fromDate: Date | string, toTz: string | null | undefined, toDate: Date | string): JetLag | null {
  if (!fromTz || !toTz) return null;
  const shift = shiftHours(fromTz, fromDate, toTz, toDate);
  return {
    shift,
    direction: shift > 0 ? "east" : shift < 0 ? "west" : "none",
    severity: severityFor(shift),
    days: adaptationDays(shift),
  };
}

/** "+5h east · ~5 days to adjust" */
export function jetLagLabel(j: JetLag) {
  const abs = Math.abs(j.shift);
  const h = Number.isInteger(abs) ? `${abs}h` : `${Math.floor(abs)}h ${Math.round((abs % 1) * 60)}m`;
  return `${j.shift > 0 ? "+" : "−"}${h} ${j.direction} · ~${j.days} day${j.days === 1 ? "" : "s"} to adjust`;
}

export function jetLagTip(j: JetLag) {
  return j.direction === "east"
    ? "Going east: seek morning light and go to bed a little earlier for a few days before you leave."
    : "Going west: seek evening light and stay up a little later for a few days before you leave.";
}

export const JETLAG_DISCLAIMER = "General guidance, not medical advice.";
