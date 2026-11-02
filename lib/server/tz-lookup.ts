import "server-only";
import tzlookup from "tz-lookup";

/** Offline coordinates → IANA time zone (tz-lookup). Returns null for invalid input. */
export function tzForCoords(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  try {
    return tzlookup(lat, lng);
  } catch {
    return null;
  }
}
