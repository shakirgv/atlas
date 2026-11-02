import { countryExtras } from "@/lib/country-extras";
import type { CountryInfoOverride } from "@/lib/types";

/** Text fields I can override. Keys match the columns of `country_info_overrides`. */
export const INFO_TEXT_FIELDS = [
  "emergency_general",
  "emergency_police",
  "emergency_ambulance",
  "emergency_fire",
  "voltage",
  "frequency",
  "tipping",
  "tap_water",
  "sim_tips",
  "embassy_name",
  "embassy_phone",
  "embassy_address",
  "embassy_url",
  "notes",
] as const;
export type InfoTextField = (typeof INFO_TEXT_FIELDS)[number];

export type Merged<T> = { value: T | null; edited: boolean };
export type MergedInfo = Record<InfoTextField, Merged<string>> & { plugs: Merged<string[]>; driving: "left" | "right" | null };

export type InfoOverride = Partial<Pick<CountryInfoOverride, InfoTextField | "plugs">> | null | undefined;

/** Layers the bundled baseline with my overrides. A blank override falls back to the baseline. */
export function mergeCountryInfo(code: string, override: InfoOverride): MergedInfo {
  const base = countryExtras(code);
  const pick = (field: InfoTextField, baseline: string | null | undefined): Merged<string> => {
    const own = override?.[field]?.trim();
    return own ? { value: own, edited: true } : { value: baseline ?? null, edited: false };
  };
  const plugs = override?.plugs?.length ? override.plugs : null;
  return {
    emergency_general: pick("emergency_general", base?.emergency?.general),
    emergency_police: pick("emergency_police", base?.emergency?.police),
    emergency_ambulance: pick("emergency_ambulance", base?.emergency?.ambulance),
    emergency_fire: pick("emergency_fire", base?.emergency?.fire),
    voltage: pick("voltage", base?.voltage),
    frequency: pick("frequency", base?.frequency),
    tipping: pick("tipping", base?.tipping),
    tap_water: pick("tap_water", base?.tapWater),
    sim_tips: pick("sim_tips", null),
    embassy_name: pick("embassy_name", null),
    embassy_phone: pick("embassy_phone", null),
    embassy_address: pick("embassy_address", null),
    embassy_url: pick("embassy_url", null),
    notes: pick("notes", null),
    plugs: plugs ? { value: plugs, edited: true } : { value: base?.plugs ?? null, edited: false },
    driving: base?.driving ?? null,
  };
}

const TAP_LABELS: Record<string, string> = {
  safe: "Generally safe to drink",
  caution: "Check locally, bottled is often safer",
  unsafe: "Not recommended, drink bottled or filtered",
};

export function tapWaterLabel(value: string | null) {
  return value ? (TAP_LABELS[value] ?? value) : null;
}

/** `tel:` link for a typed number, or null when it holds no digits to dial. */
export function telHref(number: string | null | undefined) {
  const clean = (number ?? "").replace(/[^\d+*#]/g, "");
  return /\d/.test(clean) ? `tel:${clean}` : null;
}

/** Only http(s) links are ever rendered, so a saved value can't become a script link. */
export function safeUrl(url: string | null | undefined) {
  if (!url) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/** "a, b/c" → ["A", "B", "C"]: IEC plug letters, without duplicates. */
export function parsePlugs(text: string) {
  return Array.from(new Set(text.toUpperCase().split(/[^A-Z]+/).filter((p) => /^[A-O]$/.test(p))));
}
