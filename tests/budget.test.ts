import { describe, expect, it } from "vitest";
import { cappedCountries, searchCountryBudgets, summarizeBudget, totalOfCaps } from "@/lib/budget";
import type { CountryVM } from "@/lib/data";
import type { Trip } from "@/lib/types";

const row = (name: string, cap: number, actual = 0) => ({ id: name, name, flag: "", actual, planned: 0, cap });

describe("the total of country caps", () => {
  it("adds up only the countries that have a cap", () => {
    expect(totalOfCaps([row("Georgia", 10000), row("Japan", 0), row("Armenia", 5000)])).toBe(15000);
  });

  it("stays visible when the trip has its own total", () => {
    const trips = [{ total_budget: 1000000 }] as Trip[];
    const countries = [{ id: "ge", name: "Georgia", flag: "", budget: 10000 }, { id: "am", name: "Armenia", flag: "", budget: 5000 }, { id: "jp", name: "Japan", flag: "", budget: null }] as CountryVM[];
    const summary = summarizeBudget([], trips, countries);
    expect(summary.totalBudget).toBe(1000000);
    expect(totalOfCaps(summary.byCountry)).toBe(15000);
  });
});

describe("cappedCountries", () => {
  it("leaves out countries with no cap and puts the closest to going over first", () => {
    const list = cappedCountries([row("Georgia", 1000, 100), row("Japan", 0, 500), row("Armenia", 1000, 1200), row("Greece", 1000, 900)]);
    expect(list.map((c) => c.name)).toEqual(["Armenia", "Greece", "Georgia"]);
  });

  it("keeps the route order when nothing is spent yet", () => {
    const list = cappedCountries([row("Azerbaijan", 10000), row("Georgia", 5000), row("Armenia", 20000)]);
    expect(list.map((c) => c.name)).toEqual(["Azerbaijan", "Georgia", "Armenia"]);
  });
});

describe("searchCountryBudgets", () => {
  const all = [row("Türkiye", 20000), row("Japan", 0), row("Saint Lucia", 500), row("Bosnia and Herzegovina", 5000)];
  const names = (q: string) => searchCountryBudgets(all, q).map((c) => c.name);

  it("finds a country without its accents, in any case", () => {
    expect(names("turkiye")).toEqual(["Türkiye"]);
    expect(names("TÜRKİYƏ")).toEqual(["Türkiye"]);
  });

  it("also finds countries with no cap, so the answer can be that none is set", () => {
    expect(names("japan")).toEqual(["Japan"]);
  });

  it("matches while a name is still being typed", () => {
    expect(names("sain")).toEqual(["Saint Lucia"]);
    expect(names("bosnia ")).toEqual(["Bosnia and Herzegovina"]);
  });

  it("finds nothing for a name that is not in the budget", () => {
    expect(names("atlantis")).toEqual([]);
  });
});
