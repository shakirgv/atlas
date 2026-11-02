import { describe, expect, it } from "vitest";
import extras from "@/data/country-extras.json";
import { COUNTRIES } from "@/lib/countries";
import { mergeCountryInfo, parsePlugs, safeUrl, tapWaterLabel, telHref } from "@/lib/country-info";

describe("baseline data", () => {
  const rows = Object.entries(extras.countries) as [string, Record<string, unknown> & { emergency: Record<string, string | null> | null; plugs: string[] | null; voltage: string | null; frequency: string | null }][];

  it("meets the spec's Japan example", () => {
    const m = mergeCountryInfo("JP", null);
    expect(m.emergency_police.value).toBe("110");
    expect(m.emergency_ambulance.value).toBe("119");
    expect(m.plugs.value).toEqual(["A", "B"]);
    expect(m.voltage.value).toBe("100 V");
    expect(m.driving).toBe("left");
  });

  it("uses only known country codes", () => {
    const known = new Set(COUNTRIES.map((c) => c.cca2));
    expect(rows.filter(([code]) => !known.has(code))).toEqual([]);
  });

  it("covers every populated country that is not an uninhabited or unknown territory", () => {
    const covered = new Set(rows.map(([code]) => code));
    const missing = COUNTRIES.filter((c) => !covered.has(c.cca2)).map((c) => c.cca2).sort();
    expect(missing).toEqual(["AQ", "BV", "EH", "GS", "HM", "IO", "KP", "PN", "SH", "TF", "UM", "WF"]);
  });

  it("keeps values in their expected shape", () => {
    for (const [code, c] of rows) {
      for (const p of c.plugs ?? []) expect(p, code).toMatch(/^[A-O]$/);
      if (c.voltage) expect(c.voltage, code).toMatch(/^\d+(\/\d+)? V$/);
      if (c.frequency) expect(c.frequency, code).toMatch(/^\d+(\/\d+)? Hz$/);
      if (c.tapWater) expect(["safe", "caution", "unsafe"], code).toContain(c.tapWater);
      if (c.driving) expect(["left", "right"], code).toContain(c.driving);
      for (const n of Object.values(c.emergency ?? {})) if (n) expect(n, code).toMatch(/^\d{2,5}$/);
    }
  });
});

describe("mergeCountryInfo", () => {
  it("lets my edits win and marks them", () => {
    const m = mergeCountryInfo("JP", { tipping: "Never", plugs: ["A"] });
    expect(m.tipping).toEqual({ value: "Never", edited: true });
    expect(m.plugs).toEqual({ value: ["A"], edited: true });
    expect(m.voltage.edited).toBe(false);
  });

  it("falls back to the baseline when an edit is blank", () => {
    const m = mergeCountryInfo("JP", { tipping: "   ", plugs: [] });
    expect(m.tipping.edited).toBe(false);
    expect(m.tipping.value).toContain("Not customary");
    expect(m.plugs.value).toEqual(["A", "B"]);
  });

  it("leaves unknown fields empty instead of inventing them", () => {
    const m = mergeCountryInfo("AQ", null);
    expect(m.emergency_general.value).toBeNull();
    expect(m.plugs.value).toBeNull();
    expect(m.driving).toBeNull();
    expect(mergeCountryInfo("JP", null).embassy_name.value).toBeNull();
  });
});

describe("helpers", () => {
  it("builds tel links only for dialable numbers", () => {
    expect(telHref("110")).toBe("tel:110");
    expect(telHref("+81 3-1234 5678")).toBe("tel:+81312345678");
    expect(telHref("call the desk")).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  it("allows only web links", () => {
    expect(safeUrl("https://example.org/a")).toBe("https://example.org/a");
    expect(safeUrl("example.org")).toBe("https://example.org/");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,x")).toBeNull();
    expect(safeUrl("")).toBeNull();
  });

  it("parses plug letters", () => {
    expect(parsePlugs("a, b/c  a")).toEqual(["A", "B", "C"]);
    expect(parsePlugs("Type Z")).toEqual([]);
  });

  it("labels tap water and keeps my own words", () => {
    expect(tapWaterLabel("safe")).toContain("safe");
    expect(tapWaterLabel("Boil it first")).toBe("Boil it first");
    expect(tapWaterLabel(null)).toBeNull();
  });
});
