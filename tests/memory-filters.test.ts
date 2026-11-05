import { describe, expect, it } from "vitest";
import { cityKey, filterMemories, filterOptions, hasFilters, isLongText, matchesQuery, memoryFacets, memoryLocation, NO_FILTERS, parseFilters, withCity, withCountry, writeFilters, type FacetContext } from "@/lib/memory-filters";
import { dayHref, dayLabel } from "@/lib/memory-links";

// Japan twice, once per trip: the filter treats both as one country, and Kyoto as one city.
const ctx: FacetContext = {
  countries: [
    { id: "jp-1", code: "jp", name: "Japan", flag: "🇯🇵" },
    { id: "jp-2", code: "JP", name: "Japan", flag: "🇯🇵" },
    { id: "it", code: "IT", name: "Italy", flag: "🇮🇹" },
  ],
  cities: [
    { id: "kyoto-1", name: "Kyoto", trip_country_id: "jp-1" },
    { id: "kyoto-2", name: "Kyōto", trip_country_id: "jp-2" },
    { id: "rome", name: "Rome", trip_country_id: "it" },
  ],
  places: [{ id: "fushimi", city_id: "kyoto-2" }],
};

const mem = (id: string, over: Partial<{ date: string; title: string | null; body: string | null; tags: string[]; trip_country_id: string | null; city_id: string | null; place_id: string | null }> = {}) => ({
  id,
  date: "2025-04-02",
  title: null,
  body: null,
  tags: [],
  trip_country_id: null,
  city_id: null,
  place_id: null,
  ...over,
});

const memories = [
  mem("a", { date: "2025-04-02", title: "Temple morning", body: "Quiet gardens", tags: ["temples", "food"], trip_country_id: "jp-1", city_id: "kyoto-1" }),
  mem("b", { date: "2026-03-10", title: "Inari", body: "Thousand gates at dawn", tags: ["hike"], place_id: "fushimi" }),
  mem("c", { date: "2026-05-01", title: "Café", body: "Best cornetto in Trastevere", tags: ["food"], trip_country_id: "it", city_id: "rome" }),
  mem("d", { date: "2024-01-01", title: null, body: "No place at all" }),
];

describe("memoryFacets", () => {
  it("groups the same country and city across trips", () => {
    expect(memoryFacets(memories[0]!, ctx)).toMatchObject({ country: "JP", city: "JP:kyoto", year: "2025" });
    expect(memoryFacets(memories[1]!, ctx)).toMatchObject({ country: "JP", city: "JP:kyoto", cityName: "Kyōto", year: "2026" });
  });

  it("finds the city and country through a linked place", () => {
    expect(memoryFacets(memories[1]!, ctx).countryLabel).toBe("🇯🇵 Japan");
  });

  it("leaves a memory with no place blank", () => {
    expect(memoryFacets(memories[3]!, ctx)).toMatchObject({ country: "", city: "", year: "2024" });
  });
});

describe("matchesQuery", () => {
  it("needs every word, in the title or the text, accents and case ignored", () => {
    expect(matchesQuery(memories[2]!, "cafe trastevere")).toBe(true);
    expect(matchesQuery(memories[2]!, "CORNETTO")).toBe(true);
    expect(matchesQuery(memories[2]!, "cornetto kyoto")).toBe(false);
    expect(matchesQuery(memories[2]!, "   ")).toBe(true);
  });

  it("doesn't search tags", () => {
    expect(matchesQuery(memories[1]!, "hike")).toBe(false);
  });
});

describe("filterMemories", () => {
  const ids = (f: Partial<typeof NO_FILTERS>) => filterMemories(memories, { ...NO_FILTERS, ...f }, ctx).map((m) => m.id);

  it("returns everything without filters", () => {
    expect(ids({})).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by country, city, year and tag together", () => {
    expect(ids({ country: "JP" })).toEqual(["a", "b"]);
    expect(ids({ city: "JP:kyoto" })).toEqual(["a", "b"]);
    expect(ids({ year: "2026" })).toEqual(["b", "c"]);
    expect(ids({ tag: "food" })).toEqual(["a", "c"]);
    expect(ids({ tag: "food", year: "2026" })).toEqual(["c"]);
    expect(ids({ country: "JP", q: "gates" })).toEqual(["b"]);
  });
});

describe("filterOptions", () => {
  it("lists only what the memories hold, with counts", () => {
    const o = filterOptions(memories, ctx);
    expect(o.countries).toEqual([
      { value: "IT", label: "🇮🇹 Italy", count: 1 },
      { value: "JP", label: "🇯🇵 Japan", count: 2 },
    ]);
    expect(o.cities.map((c) => [c.value, c.count, c.country])).toEqual([
      ["JP:kyoto", 2, "JP"],
      ["IT:rome", 1, "IT"],
    ]);
    expect(o.years.map((y) => y.value)).toEqual(["2026", "2025", "2024"]);
    expect(o.tags.map((t) => t.value)).toEqual(["food", "hike", "temples"]);
  });
});

describe("filters in the URL", () => {
  it("reads strings, uppercases the country and drops a bad year", () => {
    expect(parseFilters({ q: " ramen ", country: "jp", year: "20x6", tag: ["a", "b"], city: "JP:kyoto" })).toEqual({ q: "ramen", country: "JP", city: "JP:kyoto", year: "", tag: "" });
  });

  it("picks a linked city's country", () => {
    expect(parseFilters({ city: "JP:kyoto" })).toMatchObject({ city: "JP:kyoto", country: "JP" });
  });

  it("writes only the filters that are set and keeps other params", () => {
    const url = writeFilters(new URL("https://atlas.test/memories?tab=map&year=2020"), { ...NO_FILTERS, country: "JP", tag: "food" });
    expect(url.search).toBe("?tab=map&country=JP&tag=food");
  });

  it("knows when any filter is set", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, q: "x" })).toBe(true);
  });
});

describe("country and city stay consistent", () => {
  it("clears a city outside the new country, keeps one inside it", () => {
    const f = { ...NO_FILTERS, country: "JP", city: "JP:kyoto" };
    expect(withCountry(f, "IT").city).toBe("");
    expect(withCountry(f, "JP").city).toBe("JP:kyoto");
    expect(withCountry(f, "").city).toBe("JP:kyoto");
  });

  it("picks the city's country with the city", () => {
    expect(withCity(NO_FILTERS, "IT:rome")).toMatchObject({ city: "IT:rome", country: "IT" });
    expect(withCity({ ...NO_FILTERS, country: "IT", city: "IT:rome" }, "")).toMatchObject({ city: "", country: "IT" });
  });

  it("builds city keys from folded names", () => {
    expect(cityKey("jp", "Kyōto")).toBe("JP:kyoto");
  });
});

describe("isLongText", () => {
  it("folds long or many-line text", () => {
    expect(isLongText(null)).toBe(false);
    expect(isLongText("short")).toBe(false);
    expect(isLongText("x".repeat(321))).toBe(true);
    expect(isLongText("1\n2\n3\n4\n5\n6\n7")).toBe(true);
    expect(isLongText("1\n\n\n2\n\n\n3")).toBe(false);
  });
});

describe("memoryLocation", () => {
  const places = [{ id: "p", city_id: "c", lat: 1, lng: 2 }];
  const cities = [{ id: "c", lat: 5, lng: 6 }, { id: "nowhere", lat: null, lng: null }];

  it("prefers a photo's GPS, then the place, then the city", () => {
    expect(memoryLocation({ photos: [{ lat: null, lng: null }, { lat: 9, lng: 8 }], place_id: "p", city_id: "c" }, places, cities)).toEqual({ lat: 9, lng: 8 });
    expect(memoryLocation({ photos: [{ lat: null, lng: null }], place_id: "p", city_id: "c" }, places, cities)).toEqual({ lat: 1, lng: 2 });
    expect(memoryLocation({ photos: [], place_id: null, city_id: "c" }, places, cities)).toEqual({ lat: 5, lng: 6 });
  });

  it("returns null when nothing has coordinates", () => {
    expect(memoryLocation({ photos: [], place_id: null, city_id: "nowhere" }, places, cities)).toBeNull();
    expect(memoryLocation({ photos: [], place_id: null, city_id: null }, places, cities)).toBeNull();
  });
});

describe("linked day", () => {
  it("names a day by number, date and title or city", () => {
    expect(dayLabel({ day_number: 3, date: "2026-03-12", title: null }, "Kyoto")).toBe("Day 3 · 12 Mar · Kyoto");
    expect(dayLabel({ day_number: 1, date: null, title: "Arrival" }, "Kyoto")).toBe("Day 1 · Arrival");
    expect(dayLabel({ day_number: 2, date: null, title: " " })).toBe("Day 2");
  });

  it("links to the day in the itinerary", () => {
    expect(dayHref({ id: "d1", trip_country_id: "tc" })).toBe("/itinerary?country=tc&day=d1");
  });
});
