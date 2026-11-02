import { describe, expect, it } from "vitest";
import { computeRecap } from "@/lib/recap";
import { buildMemoryView, buildRecapView, buildTripView, createRateLimiter, isLikelyBot, isShareValid, parseShareConfig, shareablePhotoIds, shareConfigSchema, type ShareConfig } from "@/lib/share";

const config = (over: Partial<ShareConfig> = {}): ShareConfig => ({ ...shareConfigSchema.parse({}), ...over });
const now = new Date("2027-01-15T12:00:00Z");

describe("token validity", () => {
  it("accepts a live link", () => {
    expect(isShareValid({ revoked_at: null, expires_at: "2027-01-16T00:00:00Z" }, now)).toBe(true);
  });
  it("accepts a link that never expires", () => {
    expect(isShareValid({ revoked_at: null, expires_at: null }, now)).toBe(true);
  });
  it("rejects an expired link", () => {
    expect(isShareValid({ revoked_at: null, expires_at: "2027-01-15T11:59:59Z" }, now)).toBe(false);
    expect(isShareValid({ revoked_at: null, expires_at: now.toISOString() }, now)).toBe(false);
  });
  it("rejects a revoked link, even an unexpired one", () => {
    expect(isShareValid({ revoked_at: "2027-01-01T00:00:00Z", expires_at: "2030-01-01T00:00:00Z" }, now)).toBe(false);
  });
  it("rejects a wrong token (no row)", () => {
    expect(isShareValid(null, now)).toBe(false);
    expect(isShareValid(undefined, now)).toBe(false);
  });
});

describe("defaults", () => {
  it("is private by default", () => {
    expect(config()).toEqual({ exact_locations: false, show_dates: true, include_itinerary: false, preview_image: true, excluded_photo_ids: [] });
  });
  it("falls back to the most private settings on bad stored config", () => {
    expect(parseShareConfig({ exact_locations: "yes" })).toEqual({ exact_locations: false, show_dates: false, include_itinerary: false, preview_image: false, excluded_photo_ids: [] });
    expect(parseShareConfig({}).show_dates).toBe(true);
  });
});

describe("views and bots", () => {
  it("doesn't count crawlers or link previews", () => {
    for (const ua of ["Googlebot/2.1", "facebookexternalhit/1.1", "WhatsApp/2.23", "TelegramBot", "Slackbot-LinkExpanding", "curl/8.0", "", null]) expect(isLikelyBot(ua), String(ua)).toBe(true);
  });
  it("counts a browser", () => {
    expect(isLikelyBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1")).toBe(false);
  });
});

describe("rate limit", () => {
  it("allows up to the limit, per key, per window", () => {
    const hit = createRateLimiter(2, 1000);
    expect([hit("a", 0), hit("a", 1), hit("a", 2)]).toEqual([true, true, false]);
    expect(hit("b", 3)).toBe(true);
    expect(hit("a", 1001)).toBe(true);
  });
});

// Rows as they come from the database: full of things a visitor must never get.
const SECRET = { budget: 987654, total_budget: 987654, notes: "SECRET-NOTE", address: "SECRET-STREET 1", user_id: "SECRET-USER", cover_path: "SECRET-PATH", path: "SECRET-PATH", thumb_path: "SECRET-PATH", reference_no: "SECRET-REF", file_path: "SECRET-PATH", opening_hours: "SECRET-HOURS", cost_estimate: 987654, taken_at: "2001-01-01T00:00:00Z" };
const city = { ...SECRET, id: "rome", trip_country_id: "it", name: "Rome", lat: 41.890251, lng: 12.492373 };
const place = { ...SECRET, id: "col", name: "Colosseum", lat: 41.8902, lng: 12.4922 };
const photo = (id: string, entity_id = "m1") => ({ ...SECRET, id, entity_id, width: 800, height: 600, caption: `cap-${id}`, lat: 41.890251, lng: 12.492373 });
const memory = { ...SECRET, id: "m1", date: "2026-05-02", title: "Lost in Monti", body: "Ivy walls.", mood: "x", trip_country_id: "it", city_id: "rome" };

const LEAKS = ["SECRET", "987654", "2001-01-01"];
const expectNoLeak = (view: unknown) => {
  const json = JSON.stringify(view);
  for (const s of LEAKS) expect(json, s).not.toContain(s);
};

describe("memory view", () => {
  const base = { memory, city, place, country: { code: "IT", name: "Italy" }, photos: [photo("a"), photo("b")] };

  it("contains nothing outside the whitelist", () => {
    const view = buildMemoryView({ ...base, config: config() });
    expectNoLeak(view);
    expect(Object.keys(view.photos[0]!).sort()).toEqual(["caption", "height", "id", "width"]);
  });
  it("is city-level by default: no place name, rounded coordinates", () => {
    const view = buildMemoryView({ ...base, config: config() });
    expect(view.placeLine).toBe("Rome, Italy");
    expect(view.points).toEqual([{ lat: 41.9, lng: 12.5 }]);
    expect(JSON.stringify(view)).not.toContain("Colosseum");
    expect(JSON.stringify(view)).not.toContain("41.89");
  });
  it("gives exact locations only when asked", () => {
    const view = buildMemoryView({ ...base, config: config({ exact_locations: true }) });
    expect(view.placeLine).toBe("Colosseum, Rome, Italy");
    expect(view.points[0]).toEqual({ lat: 41.890251, lng: 12.492373 });
  });
  it("can hide the date", () => {
    expect(buildMemoryView({ ...base, config: config() }).dateLine).toBe("02 May 2026");
    const hidden = buildMemoryView({ ...base, config: config({ show_dates: false }) });
    expect(hidden.dateLine).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain("2026");
  });
  it("leaves out unticked photos, everywhere", () => {
    const view = buildMemoryView({ ...base, config: config({ excluded_photo_ids: ["a"] }) });
    expect(view.photos.map((p) => p.id)).toEqual(["b"]);
    expect(view.coverId).toBe("b");
    expect([...shareablePhotoIds(view)]).toEqual(["b"]);
  });
  it("works with no city", () => {
    const view = buildMemoryView({ ...base, city: null, place: null, country: null, config: config() });
    expect(view.title).toBe("Lost in Monti");
    expect(view.points).toEqual([]);
    expect(view.placeLine).toBeNull();
  });
});

describe("trip view", () => {
  const base = {
    trip: { ...SECRET, title: "Italy", description: "A spring trip", start_date: "2026-05-01", end_date: "2026-05-10" },
    countries: [{ ...SECRET, id: "it", code: "IT", name: "Italy", flag: "F", arrive_date: "2026-05-01", depart_date: "2026-05-10" }],
    cities: [city],
    memories: [memory],
    photos: [photo("a"), photo("b")],
    days: [{ ...SECRET, id: "d1", trip_country_id: "it", title: "Ancient Rome", day_number: 1, date: "2026-05-02" }],
    items: [{ ...SECRET, day_id: "d1", title: "Colosseum tour", start_time: "09:00:00" }],
    cover: { id: "cover", attribution: "Photo by someone" },
  };

  it("contains nothing outside the whitelist", () => {
    expectNoLeak(buildTripView({ ...base, config: config({ include_itinerary: true, exact_locations: true }) }));
  });
  it("leaves the itinerary out unless asked", () => {
    const off = buildTripView({ ...base, config: config() });
    expect(off.sections[0]!.days).toEqual([]);
    expect(JSON.stringify(off)).not.toContain("Colosseum tour");
    const on = buildTripView({ ...base, config: config({ include_itinerary: true }) });
    expect(on.sections[0]!.days[0]).toEqual({ title: "Ancient Rome", date: "Sat, 02 May", stops: [{ time: "09:00", title: "Colosseum tour" }] });
  });
  it("rounds city points unless exact was chosen", () => {
    expect(buildTripView({ ...base, config: config() }).points).toEqual([{ lat: 41.9, lng: 12.5 }]);
    expect(buildTripView({ ...base, config: config({ exact_locations: true }) }).points).toEqual([{ lat: 41.890251, lng: 12.492373 }]);
  });
  it("hides every date when asked", () => {
    const view = buildTripView({ ...base, config: config({ show_dates: false, include_itinerary: true }) });
    expect(JSON.stringify(view)).not.toMatch(/2026|May/);
  });
  it("serves the cover and the allowed photos, nothing else", () => {
    const view = buildTripView({ ...base, config: config({ excluded_photo_ids: ["b"] }) });
    expect([...shareablePhotoIds(view)].sort()).toEqual(["a", "cover"]);
  });
});

describe("recap view", () => {
  const stats = computeRecap(
    {
      today: "2026-12-31",
      stays: [{ id: "it", code: "IT", name: "Italy", flag: "F", status: "visited", arrive: "2026-05-01", depart: "2026-05-10" }],
      stops: [
        { key: "a", kind: "city", id: "a", tripCountryId: "it", name: "Rome", lat: 41.890251, lng: 12.492373, arrive: "2026-05-01", mode: null },
        { key: "b", kind: "city", id: "b", tripCountryId: "it", name: "Florence", lat: 43.7696, lng: 11.2558, arrive: "2026-05-05", mode: "train" },
      ],
      places: [],
      expenses: [{ date: "2026-05-02", kind: "actual", category: "food", amount_base: 987654 }],
      memories: [{ id: "m1", date: "2026-05-02", title: "T", body: "Body text" }],
      photos: [{ id: "a", url: "SECRET-URL", thumbUrl: "SECRET-URL", date: "2026-05-02", caption: null, linked: "memory" }],
    },
    2026,
  );

  it("never contains money", () => {
    expect(stats.money?.total).toBe(987654);
    const view = buildRecapView(stats, [photo("a")], config());
    expectNoLeak(view);
    expect(JSON.stringify(view)).not.toMatch(/SECRET|money|spent|fees/i);
  });
  it("is city-level by default", () => {
    expect(buildRecapView(stats, [], config()).points).toEqual([{ lat: 41.9, lng: 12.5 }, { lat: 43.8, lng: 11.3 }]);
  });
  it("serves only mosaic photos that weren't unticked", () => {
    expect([...shareablePhotoIds(buildRecapView(stats, [photo("a"), photo("other")], config()))]).toEqual(["a"]);
    expect([...shareablePhotoIds(buildRecapView(stats, [photo("a")], config({ excluded_photo_ids: ["a"] })))]).toEqual([]);
  });
});
