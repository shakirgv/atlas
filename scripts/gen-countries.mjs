// Generates a slim, client-friendly country dataset from `world-countries`.
// Run: node scripts/gen-countries.mjs
import countries from "world-countries";
import { writeFileSync } from "node:fs";

const slim = countries
  .map((c) => ({
    cca2: c.cca2,
    ccn3: c.ccn3 ? c.ccn3.padStart(3, "0") : "",
    cca3: c.cca3,
    name: c.name.common,
    official: c.name.official,
    flag: c.flag,
    region: c.region,
    subregion: c.subregion,
    capital: c.capital ?? [],
    currencies: Object.entries(c.currencies ?? {}).map(([code, v]) => ({ code, name: v.name, symbol: v.symbol })),
    languages: Object.values(c.languages ?? {}),
    latlng: c.latlng,
    area: c.area,
    independent: Boolean(c.independent),
    unMember: Boolean(c.unMember),
    landlocked: Boolean(c.landlocked),
    tld: c.tld?.[0] ?? null,
    idd: c.idd?.root ? c.idd.root + (c.idd.suffixes?.length === 1 ? c.idd.suffixes[0] : "") : null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

writeFileSync(new URL("../lib/data/countries.json", import.meta.url), JSON.stringify(slim));
console.log(`wrote ${slim.length} countries`);
