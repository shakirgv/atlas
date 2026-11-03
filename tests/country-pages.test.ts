import { describe, expect, it } from "vitest";
import { estimateGroups } from "@/lib/budget";
import { nextVisitGroups } from "@/lib/closing-notes";
import { filterCountries, itineraryProgress, itineraryStats, listFiltersToQuery, parseListFilters, routeNumbers, type ListFilters } from "@/lib/country-list";
import { daysInMonth, durationLabel, fmtRange, INCOMPLETE_DATE, joinDate, splitDate } from "@/lib/dates";
import { groupDaysByCity, planMissingDays, stopTime } from "@/lib/itinerary-days";
import { findDuplicatePlaces, keeperFor, mergedPlacePatch, placeLinks } from "@/lib/place-duplicates";
import { matchesName } from "@/lib/normalize-name";
import { tripCountrySchema } from "@/lib/validation";
import type { DisplayStatus, Expense } from "@/lib/types";

describe("dates and duration", () => {
  it("shows a same-day visit as one date", () => {
    expect(fmtRange("2037-01-04", "2037-01-04")).toBe("04 Jan 2037");
    expect(fmtRange("2037-01-04", "2037-01-12")).toBe("04 – 12 Jan 2037");
  });

  it("keeps the stay apart from the itinerary days", () => {
    expect(durationLabel("2037-01-04", "2037-01-12", 0)).toBe("9-day stay · 0 itinerary days");
    expect(durationLabel("2037-01-04", "2037-01-04", 1)).toBe("1-day stay · 1 itinerary day");
    expect(durationLabel(null, null, 3)).toBe("3 itinerary days");
  });

  it("splits and joins a date by its parts", () => {
    expect(splitDate("2037-01-04")).toEqual({ day: "04", month: "01", year: "2037" });
    expect(joinDate({ day: "04", month: "01", year: "2037" })).toBe("2037-01-04");
    expect(splitDate(null)).toEqual({ day: "", month: "", year: "" });
    expect(joinDate({ day: "", month: "", year: "" })).toBe("");
  });

  it("refuses a part-filled date instead of saving it as no date", () => {
    for (const parts of [{ day: "04", month: "", year: "2037" }, { day: "04", month: "01", year: "203" }, { day: "", month: "01", year: "2037" }]) {
      expect(joinDate(parts)).toBe(INCOMPLETE_DATE);
    }
    const res = tripCountrySchema.safeParse({ status: "planned", arrive_date: INCOMPLETE_DATE });
    expect(res.success).toBe(false);
    expect(res.error?.issues[0]?.message).toBe("Enter the full date");
    expect(tripCountrySchema.parse({ status: "planned", arrive_date: "" }).arrive_date).toBeNull();
    expect(tripCountrySchema.parse({ status: "planned", arrive_date: "2037-01-04" }).arrive_date).toBe("2037-01-04");
  });

  it("offers the days a month has", () => {
    expect(daysInMonth("2037", "02")).toBe(28);
    expect(daysInMonth("2036", "02")).toBe(29);
    expect(daysInMonth("", "04")).toBe(30);
    expect(daysInMonth("", "")).toBe(31);
  });
});

describe("countries list", () => {
  const c = (id: string, name: string, arrive_date: string | null, depart_date: string | null, display: DisplayStatus = "planned") => ({ id, name, arrive_date, depart_date, display, region: "Asia", trip_id: "t" });
  const countries = [c("jp", "Japan", "2037-01-04", "2037-01-12"), c("ge", "Georgia", null, null), c("in", "India", "2037-03-01", null), c("it", "Italy", "2037-02-01", "2037-02-02", "visited")];
  const stats = { jp: { days: 3, planned: 2 }, it: { days: 2, planned: 0 } };
  const base: ListFilters = { query: "", status: "all", continent: "all", trip: "all", sort: "route", view: "grid", missingDates: false, missingItinerary: false };
  const ids = (f: Partial<ListFilters>) => filterCountries(countries, { ...base, ...f }, stats).map((x) => x.id);

  it("finds countries with a date missing", () => {
    expect(ids({ missingDates: true })).toEqual(["ge", "in"]);
  });

  it("counts blank generated days as a missing itinerary", () => {
    expect(ids({ missingItinerary: true })).toEqual(["ge", "in", "it"]);
  });

  it("combines the new filters with search and each other", () => {
    expect(ids({ missingDates: true, query: "geo" })).toEqual(["ge"]);
    expect(ids({ missingItinerary: true, query: "ital" })).toEqual(["it"]);
    expect(ids({ missingDates: true, query: "japan" })).toEqual([]);
    expect(ids({ missingItinerary: true, status: "visited" })).toEqual(["it"]);
    expect(ids({ missingDates: true, missingItinerary: true })).toEqual(["ge", "in"]);
  });

  it("counts a day as planned once it has a title, notes or a stop", () => {
    const day = (id: string, title: string | null, notes: string | null = null) => ({ id, trip_country_id: "jp", title, notes });
    expect(itineraryStats([day("a", null), day("b", "Temples"), day("c", null, "Rest"), day("d", null)], [{ day_id: "d" }])).toEqual({ jp: { days: 4, planned: 3 } });
  });

  it("measures progress against the stay, or the days when there are no dates", () => {
    expect(itineraryProgress(countries[0]!, stats.jp)).toEqual({ planned: 2, total: 9, percent: (2 / 9) * 100 });
    expect(itineraryProgress(countries[1]!, { days: 4, planned: 1 })).toMatchObject({ planned: 1, total: 4 });
    expect(itineraryProgress(countries[1]!, undefined)).toEqual({ planned: 0, total: 0, percent: 0 });
    expect(itineraryProgress(c("x", "X", "2037-01-01", "2037-01-02"), { days: 5, planned: 5 })).toMatchObject({ planned: 2, total: 2, percent: 100 });
  });

  it("numbers the route per trip, whatever the filter", () => {
    expect(routeNumbers([{ id: "a", trip_id: "1" }, { id: "b", trip_id: "2" }, { id: "c", trip_id: "1" }])).toEqual({ a: 1, b: 1, c: 2 });
  });

  it("round-trips filters through the address", () => {
    const known = { continents: ["Asia"], tripIds: ["t"] };
    const f: ListFilters = { query: "ja pan", status: "visited", continent: "Asia", trip: "t", sort: "date", view: "list", missingDates: true, missingItinerary: true };
    expect(parseListFilters(new URLSearchParams(listFiltersToQuery(f)), known)).toEqual(f);
    expect(listFiltersToQuery(base)).toBe("");
  });

  it("ignores an out-of-date address instead of hiding the list", () => {
    const parsed = parseListFilters(new URLSearchParams("status=nope&continent=Atlantis&trip=gone&sort=x&view=y&missing_dates=0"), { continents: ["Asia"], tripIds: ["t"] });
    expect(parsed).toEqual(base);
  });

  it("searches names with or without accents", () => {
    expect(matchesName("Türkiye", "turkiye")).toBe(true);
    expect(matchesName("Saint Lucia", "sain")).toBe(true);
    expect(matchesName("Japan", "")).toBe(true);
    expect(matchesName("Japan", "peru")).toBe(false);
  });
});

describe("generating days", () => {
  const stay = ["2037-01-04", "2037-01-05", "2037-01-06", "2037-01-07"];
  const day = (id: string, day_number: number, date: string | null, planned = false) => ({ id, day_number, date, planned });
  const hasContent = (d: { planned: boolean }) => d.planned;

  it("creates only the missing days", () => {
    const plan = planMissingDays(stay, [day("a", 1, "2037-01-04", true), day("b", 2, "2037-01-06", true)], hasContent);
    expect(plan.insert).toEqual([{ date: "2037-01-05", day_number: 2 }, { date: "2037-01-07", day_number: 4 }]);
    expect(plan.created).toBe(2);
  });

  it("only renumbers existing days, and only when they have to move", () => {
    const plan = planMissingDays(stay, [day("a", 1, "2037-01-04", true), day("b", 2, "2037-01-06", true)], hasContent);
    expect(plan.renumber).toEqual([{ id: "b", day_number: 3 }]);
  });

  it("does nothing when no day is missing", () => {
    const days = stay.map((d, i) => day(`d${i}`, i + 1, d));
    expect(planMissingDays(stay, days, hasContent)).toEqual({ renumber: [], insert: [], created: 0 });
  });

  it("keeps days outside the stay, planned or not", () => {
    const before = day("before", 1, "2037-01-01");
    const after = day("after", 2, "2037-02-01", true);
    const plan = planMissingDays(["2037-01-04"], [before, after], hasContent);
    expect(plan.insert).toEqual([{ date: "2037-01-04", day_number: 2 }]);
    expect(plan.renumber).toEqual([{ id: "after", day_number: 3 }]);
  });

  it("gives an empty undated day a date before adding another", () => {
    const plan = planMissingDays(["2037-01-04", "2037-01-05"], [day("blank", 1, null)], hasContent);
    expect(plan.renumber).toEqual([{ id: "blank", day_number: 1, date: "2037-01-04" }]);
    expect(plan.insert).toEqual([{ date: "2037-01-05", day_number: 2 }]);
    expect(plan.created).toBe(2);
  });

  it("never takes a planned undated day, and leaves it after the dated ones", () => {
    const plan = planMissingDays(["2037-01-04"], [day("plan", 1, null, true)], hasContent);
    expect(plan.insert).toEqual([{ date: "2037-01-04", day_number: 1 }]);
    expect(plan.renumber).toEqual([{ id: "plan", day_number: 2 }]);
  });

  it("gives every day a distinct number", () => {
    const plan = planMissingDays(stay, [day("x", 1, null, true), day("a", 2, "2037-01-07"), day("b", 3, "2037-01-04", true)], hasContent);
    const unchanged = [1, 2, 3].filter((n) => !plan.renumber.some((r) => ["x", "a", "b"][n - 1] === r.id));
    const numbers = [...plan.renumber.map((r) => r.day_number), ...plan.insert.map((r) => r.day_number), ...unchanged];
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(Math.max(...numbers)).toBe(5);
  });
});

describe("the itinerary tab", () => {
  const cities = [{ id: "tokyo", name: "Tokyo" }, { id: "kyoto", name: "Kyoto" }, { id: "osaka", name: "Osaka" }];
  it("groups days by city in route order, with leftovers last", () => {
    const groups = groupDaysByCity([{ id: "1", city_id: "kyoto" }, { id: "2", city_id: "tokyo" }, { id: "3", city_id: null }, { id: "4", city_id: "gone" }], cities);
    expect(groups.map((g) => [g.name, g.days.map((d) => d.id)])).toEqual([["Tokyo", ["2"]], ["Kyoto", ["1"]], ["No city yet", ["3", "4"]]]);
  });

  it("writes a stop's time", () => {
    expect(stopTime("09:00:00", "10:30:00")).toBe("09:00 – 10:30");
    expect(stopTime("09:00", null)).toBe("09:00");
    expect(stopTime(null, null)).toBe("");
  });
});

describe("duplicate places", () => {
  const p = (id: string, name: string, city_id = "tokyo", lat: number | null = null, lng: number | null = null) => ({ id, name, city_id, lat, lng });
  const groups = (list: ReturnType<typeof p>[]) => findDuplicatePlaces(list).map((g) => g.map((x) => x.id));

  it("flags the same name written differently", () => {
    expect(groups([p("a", "Senso-ji"), p("b", "SENSOJI"), p("c", "Sensō-ji"), p("d", "Tokyo Tower")])).toEqual([["a", "b", "c"]]);
  });

  it("flags a longer name and a one-letter typo", () => {
    expect(groups([p("a", "Blue Mosque"), p("b", "Blue Mosque Istanbul")])).toEqual([["a", "b"]]);
    expect(groups([p("a", "Kinkakuji"), p("b", "Kinkakuj")])).toEqual([["a", "b"]]);
  });

  it("leaves short names that only share a word", () => {
    expect(groups([p("a", "Park"), p("b", "Ueno Park")])).toEqual([]);
    expect(groups([p("a", "Ueno Park"), p("b", "Yoyogi Park")])).toEqual([]);
  });

  it("leaves names that differ only by a label", () => {
    expect(groups([p("a", "Terminal 1"), p("b", "Terminal 2")])).toEqual([]);
    expect(groups([p("a", "Hotel Plaza A"), p("b", "Hotel Plaza B")])).toEqual([]);
  });

  it("doesn't flag across cities", () => {
    expect(groups([p("a", "Starbucks", "tokyo"), p("b", "Starbucks", "kyoto")])).toEqual([]);
  });

  it("treats pins far apart as different branches", () => {
    expect(groups([p("a", "Starbucks", "tokyo", 35.66, 139.7), p("b", "Starbucks", "tokyo", 35.7, 139.77)])).toEqual([]);
    expect(groups([p("a", "Starbucks", "tokyo", 35.66, 139.7), p("b", "Starbucks", "tokyo", 35.6601, 139.7001)])).toEqual([["a", "b"]]);
  });

  const blank = { status: "want", rating: null, notes: null, lat: null, lng: null, address: null, url: null, cost_estimate: null, cost_currency: null, opening_hours: null, cover_path: null };

  it("keeps visit history whichever place is kept", () => {
    const visited = { ...blank, status: "visited", rating: 4 };
    expect(mergedPlacePatch(blank, [visited])).toMatchObject({ status: "visited", rating: 4 });
    expect(mergedPlacePatch(visited, [blank])).toMatchObject({ status: "visited", rating: 4 });
    expect(mergedPlacePatch({ ...blank, status: "planned", rating: 2 }, [{ ...blank, rating: 5 }])).toMatchObject({ status: "planned", rating: 5 });
  });

  it("fills blanks without overwriting, and combines notes", () => {
    const kept = { ...blank, address: "1 Main St", notes: "Go early" };
    const other = { ...blank, address: "2 Side St", url: "https://x.test", notes: "Go early" };
    expect(mergedPlacePatch(kept, [other])).toMatchObject({ address: "1 Main St", url: "https://x.test", notes: "Go early" });
    expect(mergedPlacePatch(kept, [{ ...other, notes: "Closed Mondays" }]).notes).toBe("Go early\n\nClosed Mondays");
  });

  it("takes a pin and a cost whole, never half from each", () => {
    const patch = mergedPlacePatch({ ...blank, lat: 1, cost_estimate: null, cost_currency: "USD" }, [{ ...blank, lat: 2, lng: 3, cost_estimate: 10, cost_currency: "JPY" }]);
    expect(patch).toMatchObject({ lat: 2, lng: 3, cost_estimate: 10, cost_currency: "JPY" });
  });

  it("counts what hangs off each place, and suggests keeping the richest", () => {
    const links = placeLinks([{ place_id: "a" }, { place_id: "b" }, { place_id: "b" }, { place_id: null }], [{ place_id: "a" }, { place_id: null }]);
    expect(links).toEqual({ a: { stops: 1, memories: 1 }, b: { stops: 2, memories: 0 } });
    expect(keeperFor([{ id: "c", status: "want" }, { id: "b", status: "want" }], { b: { stops: 2, memories: 0 } }).id).toBe("b");
    expect(keeperFor([{ id: "b", status: "want" }, { id: "v", status: "visited" }], { b: { stops: 2, memories: 0 } }).id).toBe("v");
  });
});

describe("estimates", () => {
  const e = (id: string, kind: string, category: string, amount_base: number, city_id: string | null) => ({ id, kind, category, amount_base, city_id }) as Expense;
  const cities = [{ id: "tokyo", name: "Tokyo" }, { id: "kyoto", name: "Kyoto" }];

  it("groups by city and category, with country-level costs apart", () => {
    const groups = estimateGroups([e("1", "planned", "flights", 900, null), e("2", "planned", "food", 100, "tokyo"), e("3", "planned", "food", 50, "tokyo"), e("4", "planned", "accommodation", 300, "tokyo"), e("5", "actual", "food", 999, "tokyo")], cities);
    expect(groups.map((g) => [g.name, g.total])).toEqual([["Tokyo", 450], ["Kyoto", 0], ["Country-level costs", 900]]);
    expect(groups[0]!.categories.map((c) => [c.category, c.total, c.items.length])).toEqual([["accommodation", 300, 1], ["food", 150, 2]]);
    expect(groups[2]!.cityId).toBeNull();
  });

  it("never loses an estimate whose city was removed", () => {
    expect(estimateGroups([e("1", "planned", "food", 10, "gone")], cities).at(-1)).toMatchObject({ total: 10 });
  });

  it("leaves spending out of the estimates", () => {
    expect(estimateGroups([e("1", "actual", "food", 10, null)], cities).every((g) => g.total === 0)).toBe(true);
  });
});

describe("places left for next time", () => {
  const places = [{ name: "Sheki", status: "want", city_name: "Sheki" }, { name: "Baku Old City", status: "visited", city_name: "Baku" }, { name: "Maiden Tower", status: "planned", city_name: "Baku" }, { name: "Sheki", status: "planned", city_name: "Baku" }, { name: "Quba", status: "want" }];

  it("groups what's left by city, each name once", () => {
    expect(nextVisitGroups(places, [])).toEqual([{ name: "Sheki", places: ["Sheki"] }, { name: "Baku", places: ["Maiden Tower"] }, { name: "Other places", places: ["Quba"] }]);
  });

  it("keeps names already in the notes that aren't on offer", () => {
    expect(nextVisitGroups(places, ["Sheki", "Lahij", "Baku Old City", "Lahij"]).at(-1)).toEqual({ name: "Added by you", places: ["Lahij", "Baku Old City"] });
  });
});
