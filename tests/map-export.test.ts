import { describe, expect, it } from "vitest";
import { WORLD_COUNTRY_COUNT } from "@/lib/countries";
import { EXPORT_ASPECTS, exportSize, exportStats, MAX_EXPORT_SIDE, UN_RECOGNISED_CODES, worldPercent, worldShare, wrapText, type ExportAspect } from "@/lib/map-export";

describe("export size", () => {
  it("gives the spec's story sizes", () => {
    expect(exportSize("9:16", 1)).toEqual({ width: 1080, height: 1920 });
    expect(exportSize("9:16", 2)).toEqual({ width: 2160, height: 3840 });
  });
  it("caps the long side without changing the shape", () => {
    const s = exportSize("9:16", 3);
    expect(s.height).toBe(MAX_EXPORT_SIDE);
    expect(s.width / s.height).toBeCloseTo(1080 / 1920, 2);
  });
  it("never exceeds the cap on any aspect or scale", () => {
    for (const aspect of Object.keys(EXPORT_ASPECTS) as ExportAspect[]) {
      for (const scale of [1, 2, 3]) expect(Math.max(exportSize(aspect, scale).width, exportSize(aspect, scale).height)).toBeLessThanOrEqual(MAX_EXPORT_SIDE);
    }
  });
  it("keeps the A3 ratio", () => {
    const s = exportSize("a3", 2);
    expect(s.height / s.width).toBeCloseTo(Math.SQRT2, 1);
  });
});

describe("share of the world", () => {
  it("uses the same 195 UN-recognised countries as the Stats page", () => {
    expect(UN_RECOGNISED_CODES.size).toBe(195);
    expect(UN_RECOGNISED_CODES.size).toBe(WORLD_COUNTRY_COUNT);
    expect(UN_RECOGNISED_CODES.has("VA")).toBe(true);
    expect(UN_RECOGNISED_CODES.has("PS")).toBe(true);
    expect(worldPercent(Array.from(UN_RECOGNISED_CODES))).toBe(100);
    expect(worldShare(["JP"])).toBeCloseTo(100 / 195, 5);
  });
  it("rounds a share", () => {
    expect(worldPercent(["JP", "IT", "TR"])).toBe(2);
    expect(worldPercent([])).toBe(0);
  });
  it("doesn't count territories or repeats", () => {
    expect(worldPercent(["HK", "XK", "EH"])).toBe(0);
    expect(worldPercent(["JP", "JP", "JP"])).toBe(worldPercent(["JP"]));
  });
});

describe("stats strip", () => {
  it("counts visited countries", () => {
    expect(exportStats([{ code: "JP", status: "visited" }, { code: "IT", status: "visited" }, { code: "TR", status: "planned" }], 5)).toEqual(["2 countries", "1% of the world", "5 cities"]);
  });
  it("counts a country once, as visited if any trip visited it", () => {
    expect(exportStats([{ code: "JP", status: "planned" }, { code: "JP", status: "visited" }, { code: "JP", status: "planned" }], 1)).toEqual(["1 country", "1% of the world", "1 city"]);
  });
  it("makes no world claim before anything is visited", () => {
    expect(exportStats([{ code: "JP", status: "planned" }], 0)).toEqual(["1 country planned"]);
  });
  it("is empty with nothing to say", () => {
    expect(exportStats([], 0)).toEqual([]);
  });
});

describe("text wrapping", () => {
  it("breaks on spaces", () => {
    expect(wrapText("A long year on the road", 10)).toEqual(["A long", "year on", "the road"]);
  });
  it("keeps a word longer than the line whole", () => {
    expect(wrapText("Llanfairpwllgwyngyll now", 10)).toEqual(["Llanfairpwllgwyngyll", "now"]);
  });
  it("cuts off with an ellipsis past the limit", () => {
    expect(wrapText("one two three four five six", 5, 2)).toEqual(["one", "two…"]);
  });
  it("handles empty text", () => {
    expect(wrapText("   ", 10)).toEqual([]);
  });
});
