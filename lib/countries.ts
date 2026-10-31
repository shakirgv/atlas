import data from "@/lib/data/countries.json";

export type CountryInfo = {
  cca2: string;
  ccn3: string;
  cca3: string;
  name: string;
  official: string;
  flag: string;
  region: string;
  subregion: string;
  capital: string[];
  currencies: { code: string; name: string; symbol: string }[];
  languages: string[];
  latlng: [number, number];
  area: number;
  independent: boolean;
  unMember: boolean;
  landlocked: boolean;
  tld: string | null;
  idd: string | null;
};

export const COUNTRIES = data as CountryInfo[];

const byCca2 = new Map(COUNTRIES.map((c) => [c.cca2, c]));
const byCcn3 = new Map(COUNTRIES.filter((c) => c.ccn3).map((c) => [c.ccn3, c]));

export function getCountry(cca2: string | null | undefined): CountryInfo | undefined {
  if (!cca2) return undefined;
  return byCca2.get(cca2.trim().toUpperCase());
}

/** world-atlas ids are numeric strings; zero-pad to 3 digits to match ccn3. */
export function getCountryByCcn3(id: string | number | null | undefined): CountryInfo | undefined {
  if (id === null || id === undefined || id === "") return undefined;
  return byCcn3.get(String(id).padStart(3, "0"));
}

export function countryName(cca2: string | null | undefined) {
  return getCountry(cca2)?.name ?? cca2 ?? "Unknown";
}

export function countryFlag(cca2: string | null | undefined) {
  return getCountry(cca2)?.flag ?? "🏳️";
}

export function primaryCurrency(cca2: string | null | undefined) {
  return getCountry(cca2)?.currencies[0]?.code ?? null;
}

export const CONTINENTS = ["Africa", "Americas", "Asia", "Europe", "Oceania", "Antarctic"] as const;

/** Number of countries used as the denominator for "% of world" (UN members + observers). */
export const WORLD_COUNTRY_COUNT = COUNTRIES.filter((c) => c.unMember).length + 2;

export function searchCountries(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.official.toLowerCase().includes(q) ||
      c.cca2.toLowerCase() === q ||
      c.cca3.toLowerCase() === q ||
      c.capital.some((cap) => cap.toLowerCase().includes(q)),
  );
}
