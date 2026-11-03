import aliases from "@/lib/data/country-aliases.json";
import { COUNTRIES } from "@/lib/countries";

export type RouteStop = { id: string; code: string; name: string; flag: string };

/** Names that fairly mean more than one country. Never guessed, unless only one of them is on the route. */
const AMBIGUOUS: Record<string, string[]> = {
  congo: ["CG", "CD"],
  korea: ["KR", "KP"],
  "virgin islands": ["VG", "VI"],
  konqo: ["CG", "CD"],
  koreya: ["KR", "KP"],
};

/** Lowercase, no accents, no punctuation: "Türkiyə" and "TURKIYE" are the same name here. */
export function normalizeName(value: string) {
  const folded = value
    .replace(/[əƏ]/g, "e")
    .replace(/[ıİ]/g, "i")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/&/g, " and ")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`.]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return folded.replace(/^the /, "").replace(/\bsaint\b/g, "st").replace(/\bsainte\b/g, "ste");
}

type Hit = { rank: number; codes: string[] };

function buildIndex() {
  const index = new Map<string, Hit>();
  const add = (name: string, code: string, rank: number) => {
    const key = normalizeName(name);
    if (!key) return;
    const hit = index.get(key);
    if (!hit || rank < hit.rank) index.set(key, { rank, codes: [code] });
    else if (rank === hit.rank && !hit.codes.includes(code)) hit.codes.push(code);
  };
  // A country's own code and name always beat somebody else's alternative spelling.
  for (const c of COUNTRIES) {
    add(c.cca2, c.cca2, 0);
    add(c.cca3, c.cca2, 0);
    add(c.name, c.cca2, 0);
    add(c.official, c.cca2, 1);
  }
  for (const [code, names] of Object.entries(aliases as Record<string, string[]>)) names.forEach((n) => add(n, code, 2));
  for (const [name, codes] of Object.entries(AMBIGUOUS)) index.set(name, { rank: 0, codes });
  return index;
}

let cached: Map<string, Hit> | null = null;
const countryIndex = () => (cached ??= buildIndex());

/** Every country a piece of text could be, or none. A flag emoji counts. */
export function lookupCountry(text: string): string[] {
  const flag = text.match(/\p{Regional_Indicator}{2}/u)?.[0];
  if (flag) {
    const code = Array.from(flag, (ch) => String.fromCharCode(ch.codePointAt(0)! - 0x1f1e6 + 65)).join("");
    if (COUNTRIES.some((c) => c.cca2 === code)) return [code];
  }
  return [...(countryIndex().get(normalizeName(text))?.codes ?? [])];
}

/** The ways to read one piece of text as a country, best first. */
function candidates(text: string) {
  const out = [text];
  const noParens = text.replace(/\([^)]*\)|\[[^\]]*\]/g, " ").trim();
  if (noParens && noParens !== text) out.push(noParens);
  // "Azerbaijan - 3 days", "Georgia: Tbilisi"
  const head = noParens.split(/\s[-–—]\s|:\s|\s[-–—]$/)[0]?.trim();
  if (head && head !== noParens) out.push(head);
  // "AZ - Azerbaijan"
  const tail = noParens.split(/\s[-–—]\s/).pop()?.trim();
  if (tail && tail !== noParens && tail !== head) out.push(tail);
  // "Korea, South" and "Congo, Democratic Republic of the"
  const comma = noParens.match(/^([^,]+),\s*([^,]+)$/);
  if (comma) out.push(`${comma[2]} ${comma[1]}`);
  return out;
}

function resolve(text: string) {
  for (const c of candidates(text)) {
    const codes = lookupCountry(c);
    if (codes.length) return codes;
  }
  return [];
}

const stripBullet = (line: string) =>
  line
    .replace(/[*_`]/g, "")
    .replace(/^\s*(?:\d+\s*[.):\-–—]+|\d+\s+|[-–—•·▪◦>]+)\s*/, "")
    .trim();

/** Numbered lists, bullets, flags, codes, commas, arrows and pasted table rows all come down to a list of names. */
export function splitRouteText(text: string) {
  const entries: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripBullet(rawLine);
    if (!line || /^\d+$/.test(line)) continue;
    if (resolve(line).length) {
      entries.push(line);
      continue;
    }
    // A table row: the first cell that is a country stands for the row.
    if (/\t|\|/.test(line)) {
      const cells = line.split(/\t|\|/).map(stripBullet).filter(Boolean);
      const hit = cells.find((c) => resolve(c).length);
      if (hit) entries.push(hit);
      else if (cells.some((c) => !/^\d+$/.test(c))) entries.push(cells.filter((c) => !/^\d+$/.test(c)).join(" "));
      continue;
    }
    const parts = line.split(/\s*(?:[,;/→➡>]|->|=>)\s*/).map(stripBullet).filter(Boolean);
    entries.push(...parts);
  }
  return entries;
}

function editDistance(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length]!;
}

const MAX_GUESSES = 40;

/** Close spellings among the route's countries, nearest first: only ever offered, never applied by itself. */
function guess(text: string, route: RouteStop[]) {
  const key = normalizeName(text);
  if (key.length < 4) return [];
  const limit = Math.max(2, Math.floor(key.length / 4));
  const lists = aliases as Record<string, string[]>;
  const scored = route.map((r) => {
    const names = [r.name, ...(lists[r.code] ?? [])].map(normalizeName);
    return { id: r.id, score: Math.min(...names.map((n) => editDistance(key, n, limit))) };
  });
  return scored
    .filter((s) => s.score <= limit)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((s) => s.id);
}

export type UnresolvedEntry = {
  /** Which entry of the paste this is. A choice is remembered against it while the text stays the same. */
  index: number;
  text: string;
  reason: "unknown" | "ambiguous" | "not_on_route";
  /** Stop ids worth offering first. */
  suggestions: string[];
};

export type RoutePreview = {
  /** Every line or name read from the paste. */
  entries: string[];
  /** The final route: everything named, in that order, then the rest as they were. */
  order: RouteStop[];
  matched: RouteStop[];
  unresolved: UnresolvedEntry[];
  duplicates: { text: string; stop: RouteStop }[];
  /** On the route but not in the paste. They stay, at the end. */
  missing: RouteStop[];
  /** Nothing would change. */
  unchanged: boolean;
};

/** Matches a pasted list against the stops on this route. `picks` holds the choices made by hand: a stop id or null to skip. */
export function buildRoutePreview(text: string, route: RouteStop[], picks: Record<number, string | null> = {}): RoutePreview {
  const entries = splitRouteText(text);
  const byCode = new Map(route.map((r) => [r.code, r]));
  const byId = new Map(route.map((r) => [r.id, r]));
  const used = new Set<string>();
  const matched: RouteStop[] = [];
  const unresolved: UnresolvedEntry[] = [];
  const duplicates: RoutePreview["duplicates"] = [];
  let guesses = 0;

  entries.forEach((entry, index) => {
    const picked = picks[index];
    const codes = resolve(entry);
    const onRoute = codes.map((c) => byCode.get(c)).filter((r): r is RouteStop => Boolean(r));
    let stop: RouteStop | undefined;
    if (picked) stop = byId.get(picked);
    else if (picked !== null && onRoute.length === 1) stop = onRoute[0];

    if (stop) {
      if (used.has(stop.id)) duplicates.push({ text: entry, stop });
      else {
        used.add(stop.id);
        matched.push(stop);
      }
      return;
    }
    if (picked === null) return;
    if (onRoute.length > 1) unresolved.push({ index, text: entry, reason: "ambiguous", suggestions: onRoute.map((r) => r.id) });
    else if (codes.length) unresolved.push({ index, text: entry, reason: "not_on_route", suggestions: [] });
    else unresolved.push({ index, text: entry, reason: "unknown", suggestions: guesses++ < MAX_GUESSES ? guess(entry, route) : [] });
  });

  const missing = route.filter((r) => !used.has(r.id));
  const order = [...matched, ...missing];
  return { entries, order, matched, unresolved, duplicates, missing, unchanged: order.every((r, i) => r.id === route[i]?.id) };
}
