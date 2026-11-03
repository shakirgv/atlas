import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/lib/countries";
import { buildRoutePreview, lookupCountry, normalizeName, splitRouteText, type RouteStop } from "@/lib/route-paste";

const stop = (code: string): RouteStop => {
  const c = COUNTRIES.find((x) => x.cca2 === code)!;
  return { id: `id-${code}`, code, name: c.name, flag: c.flag };
};
const route = ["AL", "AZ", "GE", "GR", "TR", "JP"].map(stop);
const codes = (rows: RouteStop[]) => rows.map((r) => r.code);

describe("reading a pasted route", () => {
  it("reads a numbered list, as in the brief", () => {
    expect(splitRouteText("1. Azerbaijan\n2. Georgia\n3. Türkiye\n4. Greece\n5. Albania\n")).toEqual(["Azerbaijan", "Georgia", "Türkiye", "Greece", "Albania"]);
  });

  it("reads comma separated codes, as in the brief", () => {
    expect(codes(buildRoutePreview("AZ, GE, TR, GR, AL", route).matched)).toEqual(["AZ", "GE", "TR", "GR", "AL"]);
  });

  it("reads arrows, bullets, flags, notes and table rows", () => {
    expect(codes(buildRoutePreview("Azerbaijan → Georgia -> Türkiye", route).matched)).toEqual(["AZ", "GE", "TR"]);
    expect(codes(buildRoutePreview("- Greece\n• Albania\n* Japan", route).matched)).toEqual(["GR", "AL", "JP"]);
    expect(codes(buildRoutePreview("🇦🇿\n🇬🇪 Georgia", route).matched)).toEqual(["AZ", "GE"]);
    expect(codes(buildRoutePreview("Azerbaijan (Baku)\nGeorgia - 3 days\nGreece: Athens", route).matched)).toEqual(["AZ", "GE", "GR"]);
    expect(codes(buildRoutePreview("| 1 | Japan | Tokyo |\n2\tGreece\tAthens", route).matched)).toEqual(["JP", "GR"]);
  });

  it("knows other names, spellings and languages", () => {
    expect(lookupCountry("Turkey")).toEqual(["TR"]);
    expect(lookupCountry("turkiye")).toEqual(["TR"]);
    expect(lookupCountry("TÜRKİYƏ")).toEqual(["TR"]);
    expect(lookupCountry("USA")).toEqual(["US"]);
    expect(lookupCountry("UK")).toEqual(["GB"]);
    expect(lookupCountry("Gürcüstan")).toEqual(["GE"]);
    expect(lookupCountry("Yunanıstan")).toEqual(["GR"]);
    expect(lookupCountry("Czech Republic")).toEqual(["CZ"]);
    expect(lookupCountry("The Gambia")).toEqual(["GM"]);
    expect(lookupCountry("St Lucia")).toEqual(lookupCountry("Saint Lucia"));
    expect(lookupCountry("AZE")).toEqual(["AZ"]);
    expect(normalizeName("São Tomé & Príncipe")).toBe("sao tome and principe");
  });

  it("recognises every country by its name and by its code", () => {
    for (const c of COUNTRIES) {
      expect(lookupCountry(c.name), c.name).toEqual([c.cca2]);
      expect(lookupCountry(c.cca2), c.cca2).toEqual([c.cca2]);
    }
  });

  it("does not guess between countries that share a name", () => {
    expect(lookupCountry("Congo").sort()).toEqual(["CD", "CG"]);
    expect(lookupCountry("Korea").sort()).toEqual(["KP", "KR"]);
    expect(buildRoutePreview("Korea", [stop("KR"), stop("JP")]).matched.map((r) => r.code)).toEqual(["KR"]);
    const both = buildRoutePreview("Korea", [stop("KR"), stop("KP")]);
    expect(both.unresolved[0]).toMatchObject({ reason: "ambiguous", suggestions: ["id-KR", "id-KP"] });
  });
});

describe("the preview", () => {
  it("puts everything left out at the end, in its current order, and never drops a stop", () => {
    const p = buildRoutePreview("Türkiye\nAzerbaijan", route);
    expect(codes(p.order)).toEqual(["TR", "AZ", "AL", "GE", "GR", "JP"]);
    expect(codes(p.missing)).toEqual(["AL", "GE", "GR", "JP"]);
    expect(p.order).toHaveLength(route.length);
    expect(new Set(p.order.map((r) => r.id)).size).toBe(route.length);
  });

  it("reports duplicates and counts the first one", () => {
    const p = buildRoutePreview("Georgia\nAzerbaijan\nGE", route);
    expect(codes(p.matched)).toEqual(["GE", "AZ"]);
    expect(p.duplicates).toEqual([{ text: "GE", stop: stop("GE") }]);
  });

  it("tells an unknown name from a real country that isn't on this route", () => {
    const p = buildRoutePreview("Azerbaijan\nFrance\nZzzland", route);
    expect(p.unresolved.map((u) => [u.text, u.reason])).toEqual([
      ["France", "not_on_route"],
      ["Zzzland", "unknown"],
    ]);
  });

  it("offers close spellings without applying them", () => {
    const p = buildRoutePreview("Azerbaijann\nGeorgi", route);
    expect(p.matched).toEqual([]);
    expect(p.unresolved.map((u) => u.suggestions[0])).toEqual(["id-AZ", "id-GE"]);
  });

  it("uses what was picked by hand, and a skip removes the question", () => {
    const p = buildRoutePreview("Azerbaijann\nZzzland\nGeorgia", route, { 0: "id-AZ", 1: null });
    expect(codes(p.matched)).toEqual(["AZ", "GE"]);
    expect(p.unresolved).toEqual([]);
  });

  it("flags a hand-picked stop that is already in the list as a duplicate", () => {
    const p = buildRoutePreview("Azerbaijan\nAzerbaijann", route, { 1: "id-AZ" });
    expect(codes(p.matched)).toEqual(["AZ"]);
    expect(p.duplicates).toHaveLength(1);
  });

  it("knows when nothing would change", () => {
    expect(buildRoutePreview(route.map((r) => r.name).join("\n"), route).unchanged).toBe(true);
    expect(buildRoutePreview("Japan", route).unchanged).toBe(false);
    expect(buildRoutePreview("", route).unchanged).toBe(true);
  });

  it("handles a whole-world list quickly", () => {
    const world = COUNTRIES.map((c) => stop(c.cca2));
    const text = [...world]
      .reverse()
      .map((r, i) => `${i + 1}. ${r.name}`)
      .join("\n");
    const started = performance.now();
    const p = buildRoutePreview(text, world);
    expect(p.matched).toHaveLength(world.length);
    expect(p.unresolved).toEqual([]);
    expect(codes(p.order)).toEqual(codes([...world].reverse()));
    expect(performance.now() - started).toBeLessThan(1500);
  });
});
