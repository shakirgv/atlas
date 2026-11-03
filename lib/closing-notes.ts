import { todayIso } from "@/lib/dates";
import type { CountryReview } from "@/lib/types";

/** How long after leaving a country the dashboard still asks. Older trips aren't worth nagging about. */
export const CLOSING_PROMPT_DAYS = 30;

type Stop = { id: string; status: string; arrive_date: string | null; depart_date: string | null };

export function hasLeft(c: Stop, today = todayIso()) {
  return c.status !== "wishlist" && Boolean(c.depart_date && c.depart_date < today);
}

/**
 * The country to ask about right now: the one I left most recently, if that was lately, and only if
 * nothing has been written for it or waved away yet.
 */
export function closingPrompt<T extends Stop>(countries: T[], reviews: Pick<CountryReview, "trip_country_id" | "completed_at" | "dismissed_at">[], today = todayIso()): T | null {
  const answered = new Set(reviews.filter((r) => r.completed_at || r.dismissed_at).map((r) => r.trip_country_id));
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - CLOSING_PROMPT_DAYS);
  const since = cutoff.toISOString().slice(0, 10);
  return (
    countries
      .filter((c) => hasLeft(c, today) && c.depart_date! >= since && !answered.has(c.id))
      .sort((a, b) => b.depart_date!.localeCompare(a.depart_date!))[0] ?? null
  );
}

/** Places I wanted to see here and didn't, offered as "for next time". */
export function placesLeft<T extends { status: string; name: string }>(places: T[]) {
  return Array.from(new Set(places.filter((p) => p.status !== "visited").map((p) => p.name)));
}

export type NextVisitGroup = { name: string; places: string[] };

/**
 * The choices for "left for next time", by city. A name already written in the notes but no longer on offer
 * (typed by hand, or since visited) stays in its own group, so saving can't drop it unnoticed.
 */
export function nextVisitGroups(places: { name: string; status: string; city_name?: string | null }[], chosen: string[]): NextVisitGroup[] {
  const seen = new Set<string>();
  const groups: NextVisitGroup[] = [];
  for (const p of places) {
    if (p.status === "visited" || seen.has(p.name)) continue;
    seen.add(p.name);
    const city = p.city_name?.trim() || "Other places";
    const group = groups.find((g) => g.name === city);
    if (group) group.places.push(p.name);
    else groups.push({ name: city, places: [p.name] });
  }
  const added = Array.from(new Set(chosen.filter((name) => !seen.has(name))));
  return added.length ? [...groups, { name: "Added by you", places: added }] : groups;
}

/** Places I stayed, to offer when asking which hotel I'd recommend. */
export function hotelNames(bookings: { type: string; title: string; status: string }[], places: { category: string; name: string }[]) {
  const stays = new Set(["hotel", "hostel", "apartment"]);
  return Array.from(new Set([...bookings.filter((b) => stays.has(b.type) && b.status !== "cancelled").map((b) => b.title), ...places.filter((p) => p.category === "stay").map((p) => p.name)]));
}

export function reviewHasContent(r: CountryReview | null | undefined) {
  return Boolean(r && (r.best_experience || r.best_food || r.overpriced || r.recommended_hotel || r.enough_days || r.return_again || r.next_visit.length));
}
