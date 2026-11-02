import { COUNTRIES } from "@/lib/countries";

/** Sizes at 1x. The A3 poster keeps the ISO ratio (1 : √2). */
export const EXPORT_ASPECTS = {
  "1:1": { label: "Square", width: 1080, height: 1080 },
  "4:5": { label: "Portrait", width: 1080, height: 1350 },
  "9:16": { label: "Story", width: 1080, height: 1920 },
  "16:9": { label: "Wide", width: 1920, height: 1080 },
  a3: { label: "A3 poster", width: 1754, height: 2480 },
} as const;
export type ExportAspect = keyof typeof EXPORT_ASPECTS;

export type ExportTheme = "light" | "dark" | "transparent";

/** Longest side of an exported image: bigger canvases fail on phones. */
export const MAX_EXPORT_SIDE = 4096;

/** Pixel size for an aspect and scale. Past the cap it shrinks evenly, so the image is never cropped. */
export function exportSize(aspect: ExportAspect, scale: number) {
  const base = EXPORT_ASPECTS[aspect];
  const fit = Math.min(scale, MAX_EXPORT_SIDE / Math.max(base.width, base.height));
  return { width: Math.round(base.width * fit), height: Math.round(base.height * fit) };
}

/**
 * The "of the world" denominator: 195 UN-recognised countries, the same as the Stats page
 * (`WORLD_COUNTRY_COUNT`). That is the 193 members plus the observers Vatican City and Palestine;
 * `world-countries` already marks the Vatican as a member, so only Palestine is added. Territories such
 * as Hong Kong show on the map but don't count, on either side of the fraction.
 */
export const UN_RECOGNISED_CODES: ReadonlySet<string> = new Set(COUNTRIES.filter((c) => c.unMember || c.cca2 === "PS").map((c) => c.cca2));

/** Percent of the world visited, unrounded. */
export function worldShare(visitedCodes: Iterable<string>) {
  let n = 0;
  for (const code of new Set(visitedCodes)) if (UN_RECOGNISED_CODES.has(code)) n++;
  return (n / UN_RECOGNISED_CODES.size) * 100;
}

export function worldPercent(visitedCodes: Iterable<string>) {
  return Math.round(worldShare(visitedCodes));
}

/** "23 countries · 12% of the world · 58 cities"; only visited countries count toward the percentage. */
export function exportStats(countries: { code: string; status: string }[], cityCount: number) {
  const unique = new Map<string, string>();
  for (const c of countries) if (unique.get(c.code) !== "visited") unique.set(c.code, c.status);
  const visited = [...unique].filter(([, status]) => status === "visited").map(([code]) => code);
  const cities = cityCount ? [`${cityCount} ${cityCount === 1 ? "city" : "cities"}`] : [];
  if (visited.length) return [`${visited.length} ${visited.length === 1 ? "country" : "countries"}`, `${worldPercent(visited)}% of the world`, ...cities];
  if (unique.size) return [`${unique.size} ${unique.size === 1 ? "country" : "countries"} planned`, ...cities];
  return cities;
}

export type ExportPalette = { bg: string | null; ocean: string; land: string; landStroke: string; ink: string; muted: string; accent: string; visited: string; planned: string; wishlist: string; surface: string };

/** Written out in full: a serialized SVG can't see the page's CSS variables. */
export const EXPORT_PALETTES: Record<ExportTheme, ExportPalette> = {
  light: { bg: "#F5F2EC", ocean: "#E9E6DF", land: "#DAD5C9", landStroke: "#F5F2EC", ink: "#15181E", muted: "#61656E", accent: "#E8532F", visited: "#0E7C7B", planned: "#F2A93B", wishlist: "#7C8DB5", surface: "#FFFFFF" },
  dark: { bg: "#0D1117", ocean: "#151B23", land: "#2A3440", landStroke: "#0D1117", ink: "#F2EFE9", muted: "#8E99A8", accent: "#FF6B45", visited: "#2CC4B8", planned: "#F5B84B", wishlist: "#8FA2CF", surface: "#151B23" },
  transparent: { bg: null, ocean: "transparent", land: "#CFC9BB", landStroke: "#F5F2EC", ink: "#15181E", muted: "#61656E", accent: "#E8532F", visited: "#0E7C7B", planned: "#F2A93B", wishlist: "#7C8DB5", surface: "#FFFFFF" },
};

/** Splits text into lines of about `max` characters, on spaces, for SVG text that can't wrap by itself. */
export function wrapText(text: string, max: number, maxLines = 3) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1]!.replace(/[\s,.;:]+$/, "")}…`;
  return kept;
}
