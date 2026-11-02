import { describe, expect, it } from "vitest";
import { buildPins, filterPins, photoBadges, pinYears, resolveLocation, type PinContext, type PhotoPin } from "@/lib/photo-pins";
import type { PhotoView } from "@/lib/types";

const ctx: PinContext = {
  memories: [
    { id: "m-place", trip_id: "t1", trip_country_id: "it", city_id: "rome", place_id: "colosseum", date: "2026-05-01", title: "Colosseum day" },
    { id: "m-city", trip_id: "t1", trip_country_id: "it", city_id: "rome", place_id: null, date: "2026-05-02", title: "Monti" },
    { id: "m-none", trip_id: "t1", trip_country_id: "it", city_id: null, place_id: null, date: "2025-05-03", title: null },
    { id: "m-nopin", trip_id: "t1", trip_country_id: "it", city_id: "nocoords", place_id: "placeless", date: "2026-05-04", title: null },
  ],
  places: [
    { id: "colosseum", city_id: "rome", lat: 41.89, lng: 12.49 },
    { id: "placeless", city_id: "nocoords", lat: null, lng: null },
  ],
  cities: [
    { id: "rome", trip_country_id: "it", lat: 41.9, lng: 12.5 },
    { id: "nocoords", trip_country_id: "it", lat: null, lng: null },
  ],
  countries: [{ id: "it", trip_id: "t1" }],
};

const photo = (id: string, entity_type: string, entity_id: string, extra: Partial<PhotoView> = {}) => ({ id, entity_type, entity_id, lat: null, lng: null, taken_at: null, caption: null, ...extra }) as PhotoView;

describe("location resolution", () => {
  it("prefers the photo's own GPS", () => {
    expect(resolveLocation(photo("a", "memory", "m-place", { lat: 1, lng: 2 }), ctx)).toEqual({ lat: 1, lng: 2, source: "gps" });
  });
  it("falls back to the linked place", () => {
    expect(resolveLocation(photo("a", "memory", "m-place"), ctx)).toEqual({ lat: 41.89, lng: 12.49, source: "place" });
  });
  it("then to the linked city", () => {
    expect(resolveLocation(photo("a", "memory", "m-city"), ctx)).toEqual({ lat: 41.9, lng: 12.5, source: "city" });
  });
  it("uses the place's city when the place has no coordinates", () => {
    const local: PinContext = { ...ctx, places: [{ id: "p", city_id: "rome", lat: null, lng: null }] };
    expect(resolveLocation(photo("a", "place", "p"), local)).toEqual({ lat: 41.9, lng: 12.5, source: "city" });
  });
  it("gives nothing when no link has coordinates", () => {
    expect(resolveLocation(photo("a", "memory", "m-none"), ctx)).toBeNull();
    expect(resolveLocation(photo("a", "memory", "m-nopin"), ctx)).toBeNull();
    expect(resolveLocation(photo("a", "trip", "t1"), ctx)).toBeNull();
    expect(resolveLocation(photo("a", "memory", "missing"), ctx)).toBeNull();
  });
  it("treats a coordinate of 0 as a real location", () => {
    expect(resolveLocation(photo("a", "trip", "t1", { lat: 0, lng: 0 }), ctx)).toEqual({ lat: 0, lng: 0, source: "gps" });
  });
  it("resolves photos attached directly to a place or city", () => {
    expect(resolveLocation(photo("a", "place", "colosseum"), ctx)?.source).toBe("place");
    expect(resolveLocation(photo("a", "city", "rome"), ctx)?.source).toBe("city");
  });
});

describe("pins and tray", () => {
  const { pins, unlocated } = buildPins(
    [photo("gps", "memory", "m-place", { lat: 41.8, lng: 12.4, taken_at: "2024-03-01T10:00:00Z" }), photo("city", "memory", "m-city", { caption: "Ivy" }), photo("none", "memory", "m-none")],
    ctx,
  );

  it("separates located photos from the tray", () => {
    expect(pins.map((p) => p.photo.id)).toEqual(["gps", "city"]);
    expect(unlocated.map((p) => p.photo.id)).toEqual(["none"]);
  });
  it("takes the year from the photo, then the memory", () => {
    expect(pins[0]!.year).toBe("2024");
    expect(pins[1]!.year).toBe("2026");
    expect(unlocated[0]!.year).toBe("2025");
  });
  it("carries the trip and country for filters", () => {
    expect(pins[1]).toMatchObject({ tripId: "t1", tripCountryId: "it", cityId: "rome", label: "Ivy" });
    expect(buildPins([photo("c", "city", "rome")], ctx).pins[0]).toMatchObject({ tripId: "t1", tripCountryId: "it" });
  });
  it("filters by trip, country and year", () => {
    expect(filterPins(pins, { year: "2024" }).map((p) => p.photo.id)).toEqual(["gps"]);
    expect(filterPins(pins, { trip: "other" })).toEqual([]);
    expect(filterPins(pins, { country: "it", trip: "t1" })).toHaveLength(2);
    expect(filterPins(pins, {})).toHaveLength(2);
  });
  it("lists years newest first without repeats", () => {
    expect(pinYears([{ year: "2024" }, { year: "2026" }, { year: "2024" }, { year: null }])).toEqual(["2026", "2024"]);
  });
});

describe("world map badges", () => {
  const cities = [{ id: "rome", name: "Rome", trip_country_id: "it", lat: 41.9, lng: 12.5 }];
  const countries = [{ id: "it", name: "Italy", anchor: [41.9, 12.5] as [number, number] }];
  const pin = (over: Partial<PhotoPin>) => ({ lat: 41.9, lng: 12.5, cityId: null, tripCountryId: null, ...over }) as PhotoPin;

  it("counts per city and per country", () => {
    const b = photoBadges([pin({ cityId: "rome", tripCountryId: "it" }), pin({ cityId: "rome", tripCountryId: "it" })], cities, countries);
    expect(b.cities).toEqual([{ key: "rome", lat: 41.9, lng: 12.5, count: 2, name: "Rome" }]);
    expect(b.countries[0]!.count).toBe(2);
  });
  it("attaches a GPS photo to a city it was taken next to", () => {
    const b = photoBadges([pin({ lat: 41.95, lng: 12.55 })], cities, countries);
    expect(b.cities[0]!.count).toBe(1);
    expect(b.countries[0]!.count).toBe(1);
  });
  it("does not invent a city for a far-away photo", () => {
    const b = photoBadges([pin({ lat: 35.6, lng: 139.6 })], cities, countries);
    expect(b.cities).toEqual([]);
    expect(b.countries).toEqual([]);
  });
});
