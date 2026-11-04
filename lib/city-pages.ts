import { matchesName } from "@/lib/normalize-name";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/lib/types";

export type PlaceFilters = { query: string; category: string; status: string };

export function filterPlaces<T extends { name: string; category: string; status: string }>(places: T[], f: PlaceFilters): T[] {
  return places.filter((p) => (f.category === "all" || p.category === f.category) && (f.status === "all" || p.status === f.status) && matchesName(p.name, f.query));
}

/** Only the categories this list has, so no choice leads to an empty list. */
export function placeCategories(places: { category: string }[]): PlaceCategory[] {
  const present = new Set(places.map((p) => p.category));
  return PLACE_CATEGORIES.filter((c) => present.has(c));
}

const PREVIEW_ROWS = 6;
/** Hiding one or two rows behind a button saves nothing, so a list starts folding a little past the preview. */
const LONG_LIST = 8;

export function placesPreview<T>(rows: T[], expanded: boolean) {
  const long = rows.length > LONG_LIST;
  return { long, rows: long && !expanded ? rows.slice(0, PREVIEW_ROWS) : rows };
}
