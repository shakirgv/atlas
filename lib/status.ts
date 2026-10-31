import type { DisplayStatus, GeoStatus, PlaceStatus, TripStatus } from "@/lib/types";
import { isOngoing } from "@/lib/dates";

export const GEO_STATUS_META: Record<DisplayStatus, { label: string; color: string; soft: string }> = {
  visited: { label: "Visited", color: "var(--visited)", soft: "var(--visited-soft)" },
  planned: { label: "Planned", color: "var(--planned)", soft: "var(--planned-soft)" },
  wishlist: { label: "Wishlist", color: "var(--wishlist)", soft: "var(--wishlist-soft)" },
  ongoing: { label: "Ongoing", color: "var(--accent)", soft: "var(--accent-soft)" },
};

export const TRIP_STATUS_META: Record<TripStatus, { label: string; color: string; soft: string }> = {
  dreaming: { label: "Dreaming", color: "var(--wishlist)", soft: "var(--wishlist-soft)" },
  planning: { label: "Planning", color: "var(--planned)", soft: "var(--planned-soft)" },
  ongoing: { label: "Ongoing", color: "var(--accent)", soft: "var(--accent-soft)" },
  completed: { label: "Completed", color: "var(--visited)", soft: "var(--visited-soft)" },
};

export const PLACE_STATUS_META: Record<PlaceStatus, { label: string; color: string; soft: string }> = {
  want: { label: "Want to go", color: "var(--wishlist)", soft: "var(--wishlist-soft)" },
  planned: { label: "Planned", color: "var(--planned)", soft: "var(--planned-soft)" },
  visited: { label: "Visited", color: "var(--visited)", soft: "var(--visited-soft)" },
};

/** Derive the display status: "ongoing" when today is within the dates (and not already visited). */
export function displayStatus(
  status: string,
  arrive: string | null | undefined,
  depart: string | null | undefined,
): DisplayStatus {
  const s = (status as GeoStatus) ?? "planned";
  if (s !== "visited" && isOngoing(arrive, depart)) return "ongoing";
  return s;
}

/** Map priority when a country appears in several trips: visited > planned > wishlist. */
export function strongerStatus(a: GeoStatus | undefined, b: GeoStatus): GeoStatus {
  const rank: Record<GeoStatus, number> = { wishlist: 1, planned: 2, visited: 3 };
  if (!a) return b;
  return rank[b] > rank[a] ? b : a;
}
