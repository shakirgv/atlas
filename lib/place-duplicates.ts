import { normalizeName } from "@/lib/normalize-name";
import type { PlaceStatus } from "@/lib/types";
import { haversineKm } from "@/lib/utils";

type Candidate = { id: string; city_id: string; name: string; lat: number | null; lng: number | null };

/** Two pins this far apart are two branches of a chain, whatever they're called. */
const SEPARATE_KM = 0.3;
/** Names this short are too likely to match by chance ("Park" and "Ueno Park"). */
const MIN_PARTIAL_LENGTH = 6;

function oneEditApart(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length < b.length ? a.slice(i) === b.slice(i + 1) : a.slice(i + 1) === b.slice(i);
}

/** One slip inside a real word. A number or a single letter is a label instead: "Terminal 1" and "Terminal 2" are two places. */
function hasTypo(wordsA: string[], wordsB: string[]) {
  if (wordsA.length !== wordsB.length) return false;
  const differing = wordsA.flatMap((w, i) => (w === wordsB[i] ? [] : [[w, wordsB[i]!] as const]));
  if (differing.length !== 1) return false;
  const [x, y] = differing[0]!;
  return Math.min(x.length, y.length) >= MIN_PARTIAL_LENGTH && !/\d/.test(x + y) && oneEditApart(x, y);
}

function looksAlike(a: Candidate, b: Candidate) {
  const wordsA = normalizeName(a.name).split(" ").filter(Boolean);
  const wordsB = normalizeName(b.name).split(" ").filter(Boolean);
  // Squashed, so "Senso-ji" and "Sensoji" read the same.
  const x = wordsA.join("");
  const y = wordsB.join("");
  if (!x || !y) return false;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null && haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) > SEPARATE_KM) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < MIN_PARTIAL_LENGTH) return false;
  if (hasTypo(wordsA, wordsB)) return true;
  // "Blue Mosque" and "Blue Mosque Istanbul": every word of the shorter name is in the longer one.
  const [short, long] = wordsA.length <= wordsB.length ? [wordsA, wordsB] : [wordsB, wordsA];
  return short.every((w) => long.includes(w));
}

/** Groups of places in one city that may be the same place. Only ever a suggestion: nothing merges without being asked. */
export function findDuplicatePlaces<T extends Candidate>(places: T[]): T[][] {
  const parent = places.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  places.forEach((a, i) => {
    for (let j = i + 1; j < places.length; j++) {
      if (a.city_id === places[j]!.city_id && looksAlike(a, places[j]!)) parent[root(j)] = root(i);
    }
  });
  const groups = new Map<number, T[]>();
  places.forEach((p, i) => {
    const r = root(i);
    groups.set(r, [...(groups.get(r) ?? []), p]);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}

/**
 * Saved places in the same city that look like the one being added, by the same rule as Possible duplicates.
 * Asked while typing, so the existing one can be used instead of saving a second.
 */
export function similarPlaces<T extends Candidate>(draft: { name: string; city_id: string; lat?: number | null; lng?: number | null }, places: T[], exceptId?: string | null): T[] {
  if (!draft.name.trim() || !draft.city_id) return [];
  const candidate: Candidate = { id: "__draft__", city_id: draft.city_id, name: draft.name, lat: draft.lat ?? null, lng: draft.lng ?? null };
  return places.filter((p) => p.id !== exceptId && p.city_id === draft.city_id && looksAlike(candidate, p));
}

export type PlaceLinks = { stops: number; memories: number };

/** Stops and memories pointing at each place, for showing what a merge would move. */
export function placeLinks(items: { place_id: string | null }[], memories: { place_id: string | null }[]) {
  const out: Record<string, PlaceLinks> = {};
  for (const i of items) if (i.place_id) (out[i.place_id] ??= { stops: 0, memories: 0 }).stops++;
  for (const m of memories) if (m.place_id) (out[m.place_id] ??= { stops: 0, memories: 0 }).memories++;
  return out;
}

/** The place to suggest keeping: one I've visited, then the one the most hangs off, then the first saved. */
export function keeperFor<T extends { id: string; status: string }>(group: T[], links: Record<string, PlaceLinks>): T {
  const weight = (p: T) => (links[p.id]?.stops ?? 0) + (links[p.id]?.memories ?? 0);
  return group.reduce((best, p) => {
    const visited = Number(p.status === "visited") - Number(best.status === "visited");
    return visited > 0 || (visited === 0 && weight(p) > weight(best)) ? p : best;
  });
}

type Mergeable = {
  status: string;
  rating: number | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  url: string | null;
  cost_estimate: number | null;
  cost_currency: string | null;
  opening_hours: string | null;
  cover_path: string | null;
};

const STATUS_RANK: Record<PlaceStatus, number> = { want: 0, planned: 1, visited: 2 };
const rankOf = (status: string) => STATUS_RANK[status as PlaceStatus] ?? 0;

/**
 * What the kept place takes from its duplicates. "Visited" and a rating are history, so the merged place keeps the
 * furthest status and the best rating. Anything else fills only what the kept place left blank, and notes are combined.
 */
export function mergedPlacePatch(keep: Mergeable, duplicates: Mergeable[]) {
  const all = [keep, ...duplicates];
  const first = (pick: (p: Mergeable) => string | null) => all.map(pick).find((v) => v) ?? null;
  const ratings = all.flatMap((p) => (p.rating ? [p.rating] : []));
  // A pin's two numbers, and a cost and its currency, are one fact each, so they come from the same place.
  const pin = all.find((p) => p.lat != null && p.lng != null);
  const cost = all.find((p) => p.cost_estimate != null);
  return {
    status: all.reduce((best, p) => (rankOf(p.status) > rankOf(best) ? p.status : best), keep.status),
    rating: ratings.length ? Math.max(...ratings) : null,
    notes: Array.from(new Set(all.flatMap((p) => (p.notes?.trim() ? [p.notes.trim()] : [])))).join("\n\n") || null,
    lat: pin?.lat ?? null,
    lng: pin?.lng ?? null,
    address: first((p) => p.address),
    url: first((p) => p.url),
    cost_estimate: cost?.cost_estimate ?? null,
    cost_currency: cost?.cost_currency ?? null,
    opening_hours: first((p) => p.opening_hours),
    cover_path: first((p) => p.cover_path),
  };
}
