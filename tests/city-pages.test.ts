import { describe, expect, it } from "vitest";
import { filterPlaces, placeCategories, placesPreview } from "@/lib/city-pages";
import { citySchema } from "@/lib/validation";
import { INCOMPLETE_DATE } from "@/lib/dates";
import { buildStops, previousStop } from "@/lib/route";

const place = (name: string, category: string, status: string) => ({ name, category, status });
const PLACES = [place("Senso-ji", "sight", "visited"), place("Ichiran Ramen", "food", "want"), place("Café de l'Ambre", "cafe", "planned"), place("Tsukiji", "food", "visited")];

describe("a city's places list", () => {
  it("narrows by name, category and status together", () => {
    const all = { query: "", category: "all", status: "all" };
    expect(filterPlaces(PLACES, all)).toHaveLength(4);
    expect(filterPlaces(PLACES, { ...all, query: "senso" }).map((p) => p.name)).toEqual(["Senso-ji"]);
    expect(filterPlaces(PLACES, { ...all, query: "cafe de" }).map((p) => p.name)).toEqual(["Café de l'Ambre"]);
    expect(filterPlaces(PLACES, { ...all, category: "food" })).toHaveLength(2);
    expect(filterPlaces(PLACES, { ...all, category: "food", status: "visited" }).map((p) => p.name)).toEqual(["Tsukiji"]);
    expect(filterPlaces(PLACES, { query: "senso", category: "food", status: "all" })).toEqual([]);
  });

  it("offers only the categories the list has, in the usual order", () => {
    expect(placeCategories(PLACES)).toEqual(["sight", "food", "cafe"]);
    expect(placeCategories([])).toEqual([]);
  });

  it("previews a long list and leaves a short one alone", () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => i);
    expect(placesPreview(rows(8), false)).toEqual({ long: false, rows: rows(8) });
    expect(placesPreview(rows(9), false)).toEqual({ long: true, rows: rows(6) });
    expect(placesPreview(rows(9), true)).toEqual({ long: true, rows: rows(9) });
  });
});

describe("the previous stop", () => {
  const country = (id: string, name: string, order_index: number) => ({ id, code: id.toUpperCase(), name, order_index, arrive_date: null, depart_date: null });
  const city = (id: string, name: string, trip_country_id: string, order_index: number) => ({ id, name, trip_country_id, order_index, lat: null, lng: null, arrive_date: null, depart_date: null });
  const stops = buildStops([country("kr", "South Korea", 1), country("jp", "Japan", 0), country("cn", "China", 2)], [city("kyoto", "Kyoto", "jp", 1), city("tokyo", "Tokyo", "jp", 0), city("seoul", "Seoul", "kr", 0), city("beijing", "Beijing", "cn", 0)]);

  it("follows the route across countries, by route order rather than saved order", () => {
    expect(previousStop(stops, "tokyo")).toBeNull();
    expect(previousStop(stops, "kyoto")?.name).toBe("Tokyo");
    expect(previousStop(stops, "seoul")?.name).toBe("Kyoto");
  });

  it("names a country that has no cities yet", () => {
    const withEmpty = buildStops([country("jp", "Japan", 0), country("kr", "South Korea", 1)], [city("seoul", "Seoul", "kr", 0)]);
    expect(previousStop(withEmpty, "seoul")?.name).toBe("Japan");
  });

  it("has nothing for a stop that isn't on the route", () => {
    expect(previousStop(stops, "nowhere")).toBeNull();
  });
});

describe("the city form", () => {
  const base = { name: "Tokyo", status: "planned" };

  it("refuses a part-filled date instead of clearing it", () => {
    const res = citySchema.safeParse({ ...base, arrive_date: INCOMPLETE_DATE });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.message).toBe("Enter the full date");
  });

  it("saves whole dates and empty ones", () => {
    const res = citySchema.parse({ ...base, arrive_date: "2037-01-03", depart_date: "" });
    expect(res.arrive_date).toBe("2037-01-03");
    expect(res.depart_date).toBeNull();
  });
});
