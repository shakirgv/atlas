import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  citiesInCountry,
  DEFAULT_PLACE_FILTERS,
  directionsUrl,
  filterPlaceList,
  mergePlaceFilters,
  moreFilterCounts,
  parsePlaceFilters,
  placeFiltersToParams,
  stopTimeLabel,
  stopTypeForPlace,
  suggestedDay,
  withCountry,
  type PlaceListFilters,
} from "@/lib/place-list";
import { similarPlaces } from "@/lib/place-duplicates";

const cities = [
  { id: "tokyo", trip_country_id: "jp" },
  { id: "kyoto", trip_country_id: "jp" },
  { id: "rome", trip_country_id: "it" },
];
const known = { countryIds: ["jp", "it"], cities };

const place = (id: string, extra: Partial<Parameters<typeof filterPlaceList>[0][number]> = {}) => ({
  id,
  name: id,
  address: null,
  city_id: "tokyo",
  city_name: "Tokyo",
  category: "sight",
  status: "want",
  lat: 35.7 as number | null,
  lng: 139.8 as number | null,
  cover_path: "c.webp" as string | null,
  ...extra,
});

const f = (patch: Partial<PlaceListFilters> = {}): PlaceListFilters => ({ ...DEFAULT_PLACE_FILTERS, ...patch });

describe("places list filters in the address", () => {
  it("reads every filter back from the address", () => {
    const params = new URLSearchParams("q=temple&country=jp&city=kyoto&category=food&status=visited&unscheduled=1&no_pin=1&no_cover=1&view=map");
    expect(parsePlaceFilters(params, known)).toEqual({
      query: "temple",
      country: "jp",
      city: "kyoto",
      category: "food",
      status: "visited",
      notInItinerary: true,
      missingPin: true,
      missingCover: true,
      view: "map",
    });
  });

  it("falls back to the default for anything it doesn't know", () => {
    const params = new URLSearchParams("country=xx&city=nowhere&category=spa&status=maybe&view=globe");
    expect(parsePlaceFilters(params, known)).toEqual(DEFAULT_PLACE_FILTERS);
  });

  it("drops a city that isn't in the chosen country", () => {
    expect(parsePlaceFilters(new URLSearchParams("country=it&city=kyoto"), known)).toMatchObject({ country: "it", city: "all" });
  });

  it("writes only what differs from the defaults", () => {
    expect(placeFiltersToParams(DEFAULT_PLACE_FILTERS).toString()).toBe("");
    expect(placeFiltersToParams(f({ query: "ramen", view: "table", missingPin: true })).toString()).toBe("q=ramen&no_pin=1&view=table");
  });

  it("keeps the open place when the filters change", () => {
    expect(mergePlaceFilters("?open=abc&q=old&view=map", f({ query: "new" }))).toBe("open=abc&q=new");
  });

  it("round-trips through the address unchanged", () => {
    const filters = f({ query: "senso", country: "jp", city: "tokyo", category: "museum", status: "planned", notInItinerary: true, view: "map" });
    expect(parsePlaceFilters(new URLSearchParams(mergePlaceFilters("", filters)), known)).toEqual(filters);
  });
});

describe("country narrows the city filter", () => {
  it("offers only the chosen country's cities", () => {
    expect(citiesInCountry(cities, "jp").map((c) => c.id)).toEqual(["tokyo", "kyoto"]);
    expect(citiesInCountry(cities, "all")).toHaveLength(3);
  });

  it("lets go of a city from another country, and keeps one inside it", () => {
    expect(withCountry(f({ city: "rome" }), "jp", cities)).toMatchObject({ country: "jp", city: "all" });
    expect(withCountry(f({ city: "kyoto" }), "jp", cities)).toMatchObject({ country: "jp", city: "kyoto" });
    expect(withCountry(f({ city: "kyoto" }), "all", cities)).toMatchObject({ country: "all", city: "kyoto" });
  });
});

describe("filtering places", () => {
  const places = [
    place("a"),
    place("b", { city_id: "kyoto", city_name: "Kyoto", lat: null, lng: null }),
    place("c", { city_id: "rome", city_name: "Rome", cover_path: null }),
    place("d", { name: "Senso-ji", address: "2-3-1 Asakusa" }),
  ];
  const ctx = { cities, scheduled: new Set(["a"]) };
  const ids = (filters: PlaceListFilters) => filterPlaceList(places, filters, ctx).map((p) => p.id);

  it("narrows by country and city", () => {
    expect(ids(f({ country: "jp" }))).toEqual(["a", "b", "d"]);
    expect(ids(f({ city: "rome" }))).toEqual(["c"]);
  });

  it("finds places that aren't in the itinerary, have no pin or no cover", () => {
    expect(ids(f({ notInItinerary: true }))).toEqual(["b", "c", "d"]);
    expect(ids(f({ missingPin: true }))).toEqual(["b"]);
    expect(ids(f({ missingCover: true }))).toEqual(["c"]);
  });

  it("searches name, address and city, with or without accents", () => {
    expect(ids(f({ query: "sensō" }))).toEqual(["d"]);
    expect(ids(f({ query: "asakusa" }))).toEqual(["d"]);
    expect(ids(f({ query: "kyoto" }))).toEqual(["b"]);
  });

  it("counts each extra filter against what the other filters leave", () => {
    expect(moreFilterCounts(places, f({ country: "jp", missingPin: true }), ctx)).toEqual({ notInItinerary: 2, missingPin: 1, missingCover: 0 });
  });
});

describe("scheduling a place", () => {
  const days = [
    { id: "1", city_id: "tokyo", date: "2037-05-01" },
    { id: "2", city_id: "kyoto", date: "2037-05-03" },
    { id: "3", city_id: "kyoto", date: "2037-05-04" },
    { id: "4", city_id: null, date: null },
  ];

  it("suggests the next day in the place's own city", () => {
    expect(suggestedDay(days, "kyoto", "2037-05-04")?.id).toBe("3");
    expect(suggestedDay(days, "kyoto", "2037-04-01")?.id).toBe("2");
  });

  it("falls back to a past day in the city, then the next day anywhere", () => {
    expect(suggestedDay(days, "tokyo", "2037-06-01")?.id).toBe("1");
    expect(suggestedDay(days, "osaka", "2037-05-02")?.id).toBe("2");
    expect(suggestedDay([], "tokyo")).toBeNull();
  });

  it("turns a place's category into the stop's type", () => {
    expect(stopTypeForPlace("cafe")).toBe("food");
    expect(stopTypeForPlace("stay")).toBe("stay");
    expect(stopTypeForPlace("museum")).toBe("activity");
  });

  it("shows a stop's time as a range, a start, or nothing", () => {
    expect(stopTimeLabel("09:30:00", "11:00:00")).toBe("09:30–11:00");
    expect(stopTimeLabel("09:30:00", null)).toBe("09:30");
    expect(stopTimeLabel(null, null)).toBe("");
  });

  it("links directions to the pin", () => {
    expect(directionsUrl({ lat: 35.71, lng: 139.79 })).toBe("https://www.google.com/maps/dir/?api=1&destination=35.71,139.79");
  });
});

describe("a similar place while adding", () => {
  const saved = [
    { id: "s1", city_id: "tokyo", name: "Senso-ji Temple", lat: 35.7148, lng: 139.7967 },
    { id: "s2", city_id: "kyoto", name: "Sensoji Temple", lat: null, lng: null },
    { id: "s3", city_id: "tokyo", name: "Ueno Park", lat: null, lng: null },
  ];

  it("finds a saved place with a similar name in the same city only", () => {
    expect(similarPlaces({ name: "Sensoji temple", city_id: "tokyo" }, saved).map((p) => p.id)).toEqual(["s1"]);
  });

  it("ignores an empty name and a branch far away", () => {
    expect(similarPlaces({ name: "  ", city_id: "tokyo" }, saved)).toEqual([]);
    expect(similarPlaces({ name: "Senso-ji Temple", city_id: "tokyo", lat: 35.65, lng: 139.7 }, saved)).toEqual([]);
  });

  it("leaves out the place being edited", () => {
    expect(similarPlaces({ name: "Senso-ji Temple", city_id: "tokyo" }, saved, "s1")).toEqual([]);
  });
});

// schedulePlace against a stand-in database.
type Call = { table: string; op: string; row?: Record<string, unknown>; filter: Record<string, unknown> };
let calls: Call[];
let dayCountry = "jp";
let placeStatus = "want";

function client() {
  const from = (table: string) => {
    const call: Call = { table, op: "select", filter: {} };
    const result = () => {
      if (table === "places" && call.op === "select") return { id: "p", name: "Senso-ji", category: "cafe", status: placeStatus, city_id: "tokyo" };
      if (table === "itinerary_days") return { id: "d", trip_country_id: dayCountry };
      if (table === "cities") return { trip_country_id: "jp" };
      if (table === "itinerary_items" && call.op === "select") return [{ order_index: 2 }];
      return { id: "new" };
    };
    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (row: Record<string, unknown>) => ((call.op = "insert"), (call.row = row), chain),
      update: (row: Record<string, unknown>) => ((call.op = "update"), (call.row = row), chain),
      eq: (col: string, v: unknown) => ((call.filter[col] = v), chain),
      order: () => chain,
      limit: () => chain,
      single: () => chain,
      then: (done: (r: unknown) => unknown) => {
        calls.push(call);
        return Promise.resolve({ data: result(), error: null }).then(done);
      },
    };
    return chain;
  };
  return { from };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ supabase: client(), user: { id: "u" } }) }));
vi.mock("@/lib/storage", () => ({ cleanupEntityPhotos: vi.fn() }));

const { schedulePlace } = await import("@/actions/places");
const P = "11111111-1111-4111-8111-111111111111";
const D = "22222222-2222-4222-8222-222222222222";

describe("Add to itinerary", () => {
  beforeEach(() => {
    calls = [];
    dayCountry = "jp";
    placeStatus = "want";
  });

  it("adds a linked stop after the day's others, at the chosen time", async () => {
    expect(await schedulePlace(P, D, "09:30")).toMatchObject({ ok: true, data: { id: "new" } });
    expect(calls.find((c) => c.table === "itinerary_items" && c.op === "insert")?.row).toEqual({ day_id: D, title: "Senso-ji", type: "food", start_time: "09:30", place_id: P, order_index: 3 });
  });

  it("plans a place that was only wanted, and leaves a visited one alone", async () => {
    await schedulePlace(P, D, null);
    expect(calls.find((c) => c.table === "places" && c.op === "update")?.row).toEqual({ status: "planned" });
    calls = [];
    placeStatus = "visited";
    await schedulePlace(P, D, "");
    expect(calls.some((c) => c.table === "places" && c.op === "update")).toBe(false);
    expect(calls.find((c) => c.op === "insert")?.row).toMatchObject({ start_time: null });
  });

  it("refuses a day from another country's itinerary", async () => {
    dayCountry = "it";
    expect(await schedulePlace(P, D)).toMatchObject({ ok: false, error: "That day belongs to another country's itinerary." });
    expect(calls.some((c) => c.op !== "select")).toBe(false);
  });

  it("refuses a time that isn't HH:MM", async () => {
    expect((await schedulePlace(P, D, "9am")).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});
