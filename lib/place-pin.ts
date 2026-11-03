import { distanceKm } from "@/lib/geo";
import type { GeoResult } from "@/lib/server/geocode";

/** Far enough for a day trip from the city, close enough to rule out namesakes elsewhere. */
const MAX_KM_FROM_CITY = 150;

/** Say what you do or when, not where: left out of the search, so "Walk around Gion" looks for Gion. */
const ACTIVITY = new Set(
  "breakfast brunch lunch dinner supper snack drinks coffee visit visiting explore exploring see seeing walk walking stroll wander tour climb hike hiking shopping relax rest sleep nap free time check checkin checkout arrive arrival depart departure return flight train bus taxi ferry transfer trip day morning afternoon evening night sunrise sunset dawn dusk".split(" "),
);
/** Say what kind of place it is: kept in the search, but "Blue Mosque" must not match any mosque. */
const KIND = new Set(
  "temple shrine mosque church cathedral basilica chapel synagogue monastery museum museums gallery palace castle fortress fort tower bridge gate fountain square park garden gardens beach lake river mount mountain market bazaar mall street restaurant cafe bar pub bakery hotel hostel station airport terminal port pier viewpoint".split(" "),
);
const CONNECTOR = new Set("a an the at in on to of by near around through from and with for".split(" "));
/** "Flight to Bali" is a journey, and where it ends isn't where the stop is. */
const JOURNEY = /\b(?:flight|fly|flying|train|bus|taxi|cab|ferry|boat|transfer|drive|ride|metro|subway|shuttle)\b.*\b(?:to|from)\b|→|->/i;

function words(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ə/g, "e")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

const squash = (text: string) => words(text).join("");

/** The words a result's name has to answer to. */
function distinctive(query: string) {
  return words(query).filter((w) => w.length > 1 && !KIND.has(w) && !CONNECTOR.has(w));
}

function clean(text: string): string | null {
  const kept = text.split(/\s+/).filter((w) => squash(w) && !ACTIVITY.has(squash(w)));
  while (kept.length && CONNECTOR.has(squash(kept[0]!))) kept.shift();
  while (kept.length && CONNECTOR.has(squash(kept.at(-1)!))) kept.pop();
  const query = kept.join(" ");
  return distinctive(query).length ? query : null;
}

/** The part of a name worth searching for, or null when it names no place ("Lunch", "Free time"). */
export function placeQuery(name: string): string | null {
  if (JOURNEY.test(name)) return null;
  // "Colosseum & Roman Forum" is one stop at two places: the first one gets the pin.
  const first = name.split(/\s*[,&+(]\s*|\s+[-–—]\s+/)[0]!;
  // "Baklava at Karaköy Güllüoğlu": the place follows the "at". "Galata Tower at sunset": it doesn't.
  const afterAt = first.split(/\s(?:at|@)\s/i).slice(1).join(" ");
  return clean(afterAt) ?? clean(first);
}

export type PinPick = { result: GeoResult; full: boolean };

/**
 * The best result near the city that really carries the name: `full` when it has every word of the
 * search, otherwise a looser match. Search engines fill their lists with partial matches, and a
 * wrong pin is worse than none: it looks like a fact.
 */
export function pickPin(query: string, city: { lat: number | null; lng: number | null }, results: GeoResult[]): PinPick | null {
  const wanted = distinctive(query);
  const kinds = words(query).filter((w) => KIND.has(w));
  const { lat, lng } = city;
  const near = results.filter((r) => lat == null || lng == null || distanceKm({ lat, lng }, r) <= MAX_KM_FROM_CITY);

  const full = near.find((r) => [...wanted, ...kinds].every((w) => squash(r.name).includes(w)));
  if (full) return { result: full, full: true };

  const loose = near.find((r) => {
    const name = squash(r.name);
    if (wanted.filter((w) => name.includes(w)).length * 2 <= wanted.length) return false;
    // "Senso-ji temple" can be plain "Sensō-ji", but "Mount Fuji" isn't "Fuji Television".
    return !kinds.length || kinds.some((k) => name.includes(k)) || name === wanted.join("");
  });
  return loose ? { result: loose, full: false } : null;
}
