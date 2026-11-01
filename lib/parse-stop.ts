import type { StopType } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");

function toTime(h: number, m: number, ampm?: string) {
  let hour = h;
  if (ampm) {
    const pm = ampm.toLowerCase() === "pm";
    if (pm && hour < 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  if (hour > 23 || m > 59) return null;
  return `${pad(hour)}:${pad(m)}`;
}

const KEYWORDS: [StopType, RegExp][] = [
  ["transport", /\b(flight|fly|train|bus|ferry|taxi|uber|metro|subway|airport|transfer|drive|car rental|land at|depart|shinkansen|tram)\b/i],
  ["stay", /\b(hotel|check[- ]?in|check[- ]?out|hostel|airbnb|ryokan|apartment|guesthouse|b&b)\b/i],
  ["food", /\b(breakfast|lunch|dinner|brunch|café|cafe|coffee|restaurant|eat|food|market|bar|ramen|sushi|pizza|gelato|tapas|street food|izakaya|baklava|tea)\b/i],
  ["free", /\b(free time|rest|relax|beach|nap|chill|spa)\b/i],
];

/**
 * Parse quick-add text like "10:00 Senso-ji temple", "9:30-11 Museum", "7pm Dinner at Roscioli".
 * Returns time range, cleaned title and a guessed stop type.
 */
export function parseStop(input: string): { title: string; start_time: string | null; end_time: string | null; type: StopType } {
  let text = input.trim();
  let start: string | null = null;
  let end: string | null = null;
  const range = text.match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm)?\s*(?:[-–—]|to)\s*(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm)?\s+(.+)$/i);
  const single = text.match(/^(\d{1,2})(?:[:.h](\d{2}))\s*(am|pm)?\s+(.+)$/i) ?? text.match(/^(\d{1,2})\s*(am|pm)\s+(.+)$/i);
  if (range && (range[2] || range[3] || range[5] || range[6])) {
    start = toTime(Number(range[1]), Number(range[2] ?? 0), range[3] ?? range[6]);
    end = toTime(Number(range[4]), Number(range[5] ?? 0), range[6]);
    text = range[7]!;
  } else if (single) {
    if (single.length === 5) {
      start = toTime(Number(single[1]), Number(single[2] ?? 0), single[3]);
      text = single[4]!;
    } else {
      start = toTime(Number(single[1]), 0, single[2]);
      text = single[3]!;
    }
  }
  const type = KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "activity";
  return { title: text.trim() || input.trim(), start_time: start, end_time: end, type };
}
