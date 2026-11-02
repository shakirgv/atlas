import { describe, expect, it } from "vitest";
import { computeRecap, onThisDay, recapEntry, recapSlides, recapYears, yearsAgoIfAnniversary, type RecapInput } from "@/lib/recap";

const stay = (id: string, code: string, arrive: string | null, depart: string | null, status = "visited") => ({ id, code, name: code, flag: "", status, arrive, depart });
const stop = (id: string, stayId: string, name: string, lat: number, lng: number, arrive: string, mode: string | null = "flight", kind: "city" | "country" = "city") => ({ key: id, kind, id, tripCountryId: stayId, name, lat, lng, arrive, mode });

const input: RecapInput = {
  today: "2026-06-15",
  stays: [
    stay("old-it", "IT", "2025-03-01", "2025-03-05"),
    stay("tr", "TR", "2026-01-10", "2026-01-14"),
    stay("it", "IT", "2026-02-01", "2026-02-10"),
    stay("it2", "IT", "2026-03-01", "2026-03-02"),
    stay("jp", "JP", "2026-06-10", "2026-07-20"),
    stay("future", "BR", "2026-12-01", "2026-12-10", "planned"),
    stay("wish", "NO", "2026-02-01", "2026-02-05", "wishlist"),
    stay("nodate", "PE", null, null),
  ],
  stops: [
    stop("rome-old", "old-it", "Rome", 41.9, 12.5, "2025-03-01"),
    stop("ist", "tr", "Istanbul", 41.0, 29.0, "2026-01-10"),
    stop("rome", "it", "Rome", 41.9, 12.5, "2026-02-01"),
    stop("flo", "it", "Florence", 43.8, 11.3, "2026-02-06", "train"),
    stop("tyo", "jp", "Tokyo", 35.7, 139.7, "2026-06-10"),
    stop("kyo", "jp", "Kyoto", 35.0, 135.8, "2026-07-01", "train"),
  ],
  places: [
    { id: "p1", name: "Colosseum", cityId: "rome", status: "visited", rating: 5 },
    { id: "p2", name: "Pantheon", cityId: "rome", status: "visited", rating: 4 },
    { id: "p3", name: "Uffizi", cityId: "flo", status: "visited", rating: null },
    { id: "p4", name: "Trevi", cityId: "rome", status: "planned", rating: 5 },
    { id: "p5", name: "Old place", cityId: "rome-old", status: "visited", rating: 5 },
  ],
  expenses: [
    { date: "2026-01-10", kind: "actual", category: "food", amount_base: 100 },
    { date: "2026-02-02", kind: "actual", category: "accommodation", amount_base: 500 },
    { date: "2026-02-02", kind: "actual", category: "food", amount_base: 50 },
    { date: "2026-02-03", kind: "actual", category: "fees", amount_base: 5 },
    { date: "2026-08-01", kind: "actual", category: "food", amount_base: 9999 },
    { date: "2026-03-01", kind: "planned", category: "food", amount_base: 7777 },
    { date: "2025-03-02", kind: "actual", category: "food", amount_base: 40 },
  ],
  memories: [
    { id: "m1", date: "2026-01-11", title: "Short", body: "Short one." },
    { id: "m2", date: "2026-02-02", title: "Long", body: "A **much** longer memory about Rome, with `markdown` in it." },
    { id: "m3", date: "2025-03-02", title: "Older and longest", body: "x".repeat(500) },
    { id: "m4", date: "2026-09-01", title: "Future", body: "y".repeat(900) },
  ],
  photos: [
    { id: "ph1", url: "u1", thumbUrl: "t1", date: "2026-02-02", caption: null, linked: "other" },
    { id: "ph2", url: "u2", thumbUrl: "t2", date: "2026-02-03", caption: null, linked: "memory" },
    { id: "ph3", url: "u3", thumbUrl: "t3", date: "2026-02-04", caption: null, linked: "cover" },
    { id: "ph4", url: "u4", thumbUrl: "t4", date: "2025-03-02", caption: null, linked: "memory" },
    { id: "ph5", url: "u5", thumbUrl: "t5", date: "2027-01-01", caption: null, linked: "cover" },
  ],
};

const s2026 = computeRecap(input, 2026);

describe("which years exist", () => {
  it("lists years with things that happened, newest first", () => {
    expect(recapYears(input)).toEqual([2026, 2025]);
  });
  it("ignores future, planned and wishlist data", () => {
    expect(recapYears({ ...input, stays: [stay("f", "BR", "2030-01-01", "2030-01-02")], expenses: [{ date: "2019-01-01", kind: "planned", category: "food", amount_base: 1 }], memories: [], photos: [] })).toEqual([]);
  });
});

describe("countries", () => {
  it("counts each country once and leaves out future and wishlist stays", () => {
    expect(s2026.countries.map((c) => c.code)).toEqual(["TR", "IT", "JP"]);
  });
  it("separates new from revisited", () => {
    expect(s2026.newCountries).toBe(2);
    expect(s2026.revisited).toBe(1);
    expect(s2026.countries.find((c) => c.code === "IT")!.isNew).toBe(false);
  });
  it("treats everything as new over all time, and includes undated-free stays only", () => {
    const all = computeRecap(input, "all");
    expect(all.newCountries).toBe(all.countries.length);
    expect(all.countries.map((c) => c.code)).not.toContain("PE");
  });
});

describe("days", () => {
  it("counts only days that have passed, inside the year", () => {
    // TR 5 + IT 10 + IT 2 + JP 10-15 June 6 = 23
    expect(s2026.daysOnRoad).toBe(23);
  });
  it("counts an overlapping day once", () => {
    const overlap = computeRecap({ ...input, stays: [stay("a", "TR", "2026-01-01", "2026-01-05"), stay("b", "IT", "2026-01-05", "2026-01-06")] }, 2026);
    expect(overlap.daysOnRoad).toBe(6);
  });
  it("splits a stay across new year", () => {
    const span = { ...input, today: "2027-02-01", stays: [stay("a", "TR", "2026-12-30", "2027-01-02")], stops: [] };
    expect(computeRecap(span, 2026).daysOnRoad).toBe(2);
    expect(computeRecap(span, 2027).daysOnRoad).toBe(2);
    expect(recapYears(span)).toContain(2026);
  });
  it("finds the busiest month", () => {
    expect(s2026.months.slice(0, 7)).toEqual([5, 10, 2, 0, 0, 6, 0]);
    expect(s2026.busiestMonth).toBe(1);
  });
});

describe("route", () => {
  it("runs in arrival order and leaves out what hasn't happened", () => {
    expect(s2026.route.map((r) => r.name)).toEqual(["Istanbul", "Rome", "Florence", "Tokyo"]);
  });
  it("lists cities once", () => {
    expect(s2026.cities).toEqual(["Istanbul", "Rome", "Florence", "Tokyo"]);
  });
  it("sums great-circle legs", () => {
    // Istanbul-Rome ~1370, Rome-Florence ~240, Florence-Tokyo ~9700.
    expect(s2026.distanceKm).toBeGreaterThan(11000);
    expect(s2026.distanceKm).toBeLessThan(11700);
  });
});

describe("stays", () => {
  it("finds the longest, by days inside the period", () => {
    expect(s2026.longestStay).toMatchObject({ name: "IT", days: 10 });
  });
  it("reports the most visited only when somewhere was returned to", () => {
    expect(s2026.mostVisited).toMatchObject({ name: "IT", visits: 2 });
    expect(computeRecap({ ...input, stays: [stay("a", "TR", "2026-01-01", "2026-01-02")] }, 2026).mostVisited).toBeNull();
  });
});

describe("places", () => {
  it("counts visited places in cities of that year", () => {
    expect(s2026.placesVisited).toBe(3);
  });
  it("ranks the top rated, skipping unrated", () => {
    expect(s2026.topPlaces).toEqual([{ name: "Colosseum", rating: 5 }, { name: "Pantheon", rating: 4 }]);
  });
});

describe("money", () => {
  const m = s2026.money!;
  it("adds up only actual spending in the past of that year", () => {
    expect(m.total).toBe(655);
  });
  it("averages over days on the road", () => {
    expect(m.perDay).toBeCloseTo(655 / 23, 2);
  });
  it("finds the top category and priciest day", () => {
    expect(m.topCategory).toEqual({ category: "accommodation", total: 500 });
    expect(m.priciestDay).toEqual({ date: "2026-02-02", total: 550 });
  });
  it("reports fees", () => {
    expect(m.fees).toBe(5);
  });
  it("is absent without spending", () => {
    expect(computeRecap({ ...input, expenses: [] }, 2026).money).toBeNull();
  });
});

describe("photos and memories", () => {
  it("counts photos of the period", () => {
    expect(s2026.photoCount).toBe(3);
  });
  it("prefers covers, then memory photos", () => {
    expect(s2026.mosaic.map((p) => p.id)).toEqual(["ph3", "ph2", "ph1"]);
  });
  it("picks the longest memory of the period, as plain text", () => {
    expect(s2026.favoriteMemory).toMatchObject({ id: "m2", excerpt: "A much longer memory about Rome, with markdown in it." });
  });
  it("cuts a very long memory", () => {
    const fav = computeRecap(input, 2025).favoriteMemory!;
    expect(fav.id).toBe("m3");
    expect(fav.excerpt.length).toBeLessThanOrEqual(261);
  });
});

describe("slides", () => {
  it("gives a rich year at least 8 slides (spec)", () => {
    const slides = recapSlides(s2026);
    expect(slides.length).toBeGreaterThanOrEqual(8);
    expect(slides[0]).toBe("intro");
    expect(slides.at(-1)).toBe("closing");
  });
  it("skips slides without data", () => {
    const sparse = computeRecap({ ...input, stays: [], stops: [], expenses: [], memories: [], places: [] }, 2026);
    expect(recapSlides(sparse)).toEqual(["intro", "photos", "closing"]);
  });
  it("shows nothing at all for an empty year", () => {
    expect(recapSlides(computeRecap(input, 2010))).toEqual([]);
  });
});

describe("dashboard entry", () => {
  const years = [2026, 2025];
  it("is prominent in December for this year", () => {
    expect(recapEntry("2026-12-01", years)).toEqual({ year: 2026, prominent: true });
    expect(recapEntry("2026-12-31", years)).toEqual({ year: 2026, prominent: true });
  });
  it("is prominent in January for last year", () => {
    expect(recapEntry("2027-01-31", years)).toEqual({ year: 2026, prominent: true });
  });
  it("is a small link the rest of the year", () => {
    expect(recapEntry("2026-11-30", years)).toEqual({ year: 2025, prominent: false });
    expect(recapEntry("2027-02-01", years)).toEqual({ year: 2026, prominent: false });
  });
  it("falls back when the season's year has no data", () => {
    expect(recapEntry("2026-12-05", [2024])).toEqual({ year: 2024, prominent: false });
  });
  it("is absent without any data", () => {
    expect(recapEntry("2026-06-01", [])).toBeNull();
  });
});

describe("on this day", () => {
  const memory = (id: string, date: string, title: string | null = "T", body: string | null = null) => ({ id, date, title, body, place: "Rome", thumbUrl: null });
  const photo = (id: string, date: string, memoryId: string | null = null) => ({ id, date, caption: null, place: null, thumbUrl: "t", url: "u", memoryId });

  it("matches the same day in earlier years, a day either way", () => {
    expect(yearsAgoIfAnniversary("2025-06-15", "2026-06-15")).toBe(1);
    expect(yearsAgoIfAnniversary("2025-06-14", "2026-06-15")).toBe(1);
    expect(yearsAgoIfAnniversary("2025-06-16", "2026-06-15")).toBe(1);
    expect(yearsAgoIfAnniversary("2020-06-15", "2026-06-15")).toBe(6);
  });
  it("doesn't match other days or this year", () => {
    expect(yearsAgoIfAnniversary("2025-06-17", "2026-06-15")).toBeNull();
    expect(yearsAgoIfAnniversary("2026-06-15", "2026-06-15")).toBeNull();
    expect(yearsAgoIfAnniversary("2026-06-14", "2026-06-15")).toBeNull();
    expect(yearsAgoIfAnniversary("2027-06-15", "2026-06-15")).toBeNull();
  });
  it("works across new year", () => {
    // 1 January 2026 is a day from 31 December 2025, so a year ago on 31 December 2026.
    expect(yearsAgoIfAnniversary("2026-01-01", "2026-12-31")).toBe(1);
    expect(yearsAgoIfAnniversary("2025-01-01", "2026-12-31")).toBe(2);
    // 31 December 2025 is a day from 1 January 2026, so a year ago on 1 January 2027.
    expect(yearsAgoIfAnniversary("2025-12-31", "2027-01-01")).toBe(1);
  });
  it("copes with 29 February", () => {
    expect(yearsAgoIfAnniversary("2024-02-29", "2025-02-28")).toBe(1);
    expect(yearsAgoIfAnniversary("2023-03-01", "2024-02-29")).toBe(1);
  });
  it("shows at most three, most recent year first", () => {
    const list = onThisDay([memory("a", "2020-06-15"), memory("b", "2025-06-15"), memory("c", "2023-06-15"), memory("d", "2022-06-15")], [], "2026-06-15");
    expect(list.map((i) => i.id)).toEqual(["b", "c", "d"]);
  });
  it("puts the exact day first within a year", () => {
    const list = onThisDay([memory("near", "2025-06-14"), memory("exact", "2025-06-15")], [], "2026-06-15");
    expect(list.map((i) => i.id)).toEqual(["exact", "near"]);
  });
  it("doesn't repeat a memory through its photos", () => {
    const list = onThisDay([memory("m", "2025-06-15")], [photo("p1", "2025-06-15", "m"), photo("p2", "2025-06-15")], "2026-06-15");
    expect(list.map((i) => `${i.kind}:${i.id}`)).toEqual(["memory:m", "photo:p2"]);
  });
  it("is empty when nothing matches", () => {
    expect(onThisDay([memory("a", "2025-01-01")], [photo("b", "2025-02-02")], "2026-06-15")).toEqual([]);
  });
  it("falls back to the text for an untitled memory", () => {
    expect(onThisDay([memory("a", "2025-06-15", null, "**Bold** start")], [], "2026-06-15")[0]!.title).toBe("Bold start");
  });
});
