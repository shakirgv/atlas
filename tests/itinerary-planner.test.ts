import { describe, expect, it } from "vitest";
import { dayMatch, previewMissingDays } from "@/lib/itinerary-days";
import { parsePrint, printHeading, selectPrintDays, type PrintSelection } from "@/lib/print-itinerary";

const day = (id: string, day_number: number, date: string | null, extra: { title?: string | null; city_id?: string | null; trip_country_id?: string } = {}) => ({
  id,
  day_number,
  date,
  title: extra.title ?? null,
  city_id: extra.city_id ?? null,
  trip_country_id: extra.trip_country_id ?? "jp",
});

describe("Generate missing days preview", () => {
  it("lists only the dates of the stay that have no day", () => {
    const days = [day("a", 1, "2037-05-01"), day("b", 2, "2037-05-03")];
    expect(previewMissingDays("2037-05-01", "2037-05-04", days, () => true)).toEqual({ dates: ["2037-05-02", "2037-05-04"], filled: 0, renumbered: 1, tooLong: false });
  });

  it("says when nothing is missing", () => {
    const days = [day("a", 1, "2037-05-01"), day("b", 2, "2037-05-02")];
    expect(previewMissingDays("2037-05-01", "2037-05-02", days, () => true).dates).toEqual([]);
  });

  it("counts an empty undated day taking a date, and leaves an undated day with a plan alone", () => {
    const days = [day("a", 1, "2037-05-01"), day("empty", 2, null), day("planned", 3, null, { title: "Ideas" })];
    const preview = previewMissingDays("2037-05-01", "2037-05-03", days, (d) => Boolean(d.title));
    expect(preview.dates).toEqual(["2037-05-02", "2037-05-03"]);
    expect(preview.filled).toBe(1);
  });

  it("refuses a stay longer than the action allows, and a stay without dates adds nothing", () => {
    expect(previewMissingDays("2037-01-01", "2037-12-31", [], () => false).tooLong).toBe(true);
    expect(previewMissingDays(null, "2037-01-05", [day("a", 1, null)], () => false)).toEqual({ dates: [], filled: 0, renumbered: 0, tooLong: false });
  });
});

describe("Jump to day", () => {
  const d12 = day("x", 12, "2037-05-03", { title: "Temples" });
  it("puts a typed day number first, then dates with that number", () => {
    expect(dayMatch("12", d12, "Kyoto")).toBe(1);
    expect(dayMatch("day 12", d12, "Kyoto")).toBe(1);
    expect(dayMatch("3", d12, "Kyoto")).toBe(0.5);
    expect(dayMatch("4", d12, "Kyoto")).toBe(0);
  });

  it("matches the date written out, the title and the city in any order", () => {
    expect(dayMatch("sun 3 may", d12, "Kyoto")).toBeGreaterThan(0);
    expect(dayMatch("2037-05-03", d12, null)).toBeGreaterThan(0);
    expect(dayMatch("kyoto temples", d12, "Kyoto")).toBeGreaterThan(0);
    expect(dayMatch("osaka", d12, "Kyoto")).toBe(0);
    expect(dayMatch("dayton", day("y", 1, null), "Dayton")).toBeGreaterThan(0);
  });
});

describe("print selection", () => {
  it("reads old links and new ones", () => {
    expect(parsePrint({}).selection.scope).toBe("trip");
    expect(parsePrint({ country: "jp" }).selection).toMatchObject({ scope: "country", countryId: "jp" });
    expect(parsePrint({ country: "jp", city: "kyoto" }).selection.scope).toBe("city");
    expect(parsePrint({ scope: "range", from: "2037-05-02", to: "nope" }).selection).toMatchObject({ scope: "range", from: "2037-05-02", to: null });
    expect(parsePrint({ scope: "bogus" }).selection.scope).toBe("trip");
  });

  it("turns each part off on its own", () => {
    expect(parsePrint({}).options).toEqual({ addresses: true, notes: true, checkboxes: true });
    expect(parsePrint({ notes: "0" }).options).toEqual({ addresses: true, notes: false, checkboxes: true });
    expect(parsePrint({ addresses: "0", checkboxes: "0" }).options).toEqual({ addresses: false, notes: true, checkboxes: false });
  });

  const days = [
    day("1", 1, "2037-05-01", { city_id: "tokyo" }),
    day("2", 2, "2037-05-02", { city_id: "kyoto" }),
    day("3", 3, null, { city_id: "kyoto" }),
    day("4", 1, "2037-06-01", { city_id: "rome", trip_country_id: "it" }),
  ];
  const sel = (s: Partial<PrintSelection>): PrintSelection => ({ scope: "trip", countryId: null, cityId: null, from: null, to: null, ...s });
  const ids = (s: Partial<PrintSelection>) => selectPrintDays(days, sel(s)).map((d) => d.id);

  it("prints a country, a city, a date range or the whole trip", () => {
    expect(ids({})).toEqual(["1", "2", "3", "4"]);
    expect(ids({ scope: "country", countryId: "jp" })).toEqual(["1", "2", "3"]);
    expect(ids({ scope: "city", cityId: "kyoto" })).toEqual(["2", "3"]);
    expect(ids({ scope: "range", from: "2037-05-02", to: "2037-06-01" })).toEqual(["2", "4"]);
    expect(ids({ scope: "range", to: "2037-05-01" })).toEqual(["1"]);
  });

  const ctx = {
    appName: "Atlas",
    trip: { title: "World Tour", start_date: "2037-05-01", end_date: "2037-06-30" },
    country: { name: "Japan", flag: "🇯🇵", arrive_date: "2037-05-01", depart_date: "2037-05-14" },
    city: { name: "Kyoto", arrive_date: null, depart_date: null },
    dates: ["2037-05-04", "2037-05-02", null],
  };

  it("titles and dates the printout after what was chosen", () => {
    expect(printHeading(sel({}), ctx)).toMatchObject({ title: "World Tour", range: "01 May – 30 Jun 2037", flag: null });
    expect(printHeading(sel({ scope: "country" }), ctx)).toMatchObject({ title: "Japan", flag: "🇯🇵", range: "01 – 14 May 2037", eyebrow: "World Tour · Itinerary" });
    // A city without dates of its own takes the span of its days.
    expect(printHeading(sel({ scope: "city" }), ctx)).toMatchObject({ title: "Kyoto", range: "02 – 04 May 2037", eyebrow: "World Tour · Japan" });
    expect(printHeading(sel({ scope: "range", from: "2037-05-03", to: "2037-05-09" }), ctx)).toMatchObject({ title: "World Tour", range: "03 – 09 May 2037" });
    expect(printHeading(sel({ scope: "country" }), ctx).documentTitle).toBe("Japan itinerary · 01 – 14 May 2037");
  });
});
