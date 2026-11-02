import extras from "@/data/country-extras.json";

/**
 * Best-effort baseline facts per country (emergency numbers, plugs, voltage, tipping, tap water,
 * driving side, capital coordinates). Fields are null when unknown — never guessed. My own edits
 * live in `country_info_overrides` and always win.
 */
export type CountryExtras = {
  emergency?: { general?: string | null; police?: string | null; ambulance?: string | null; fire?: string | null } | null;
  plugs?: string[] | null;
  voltage?: string | null;
  frequency?: string | null;
  tipping?: string | null;
  tapWater?: "safe" | "caution" | "unsafe" | string | null;
  driving?: "left" | "right" | null;
  weekStart?: "monday" | "sunday" | "saturday" | null;
  capital?: [number, number] | null;
};

type File = { reviewed: string; note?: string; countries: Record<string, CountryExtras> };
const data = extras as unknown as File;

export const EXTRAS_REVIEWED = data.reviewed;

export function countryExtras(cca2: string | null | undefined): CountryExtras | null {
  if (!cca2) return null;
  return data.countries[cca2.trim().toUpperCase()] ?? null;
}

export function capitalCoords(cca2: string | null | undefined): [number, number] | null {
  const c = countryExtras(cca2)?.capital;
  return c && c.length === 2 ? c : null;
}
