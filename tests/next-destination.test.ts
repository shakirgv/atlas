import { describe, expect, it } from "vitest";
import { typicalWeatherLabel } from "@/lib/climate";
import { isHomeCity, nextDestination } from "@/lib/next-destination";
import type { Stop } from "@/lib/route";

const stop = (id: string, arrive: string | null, depart: string | null, extra: Partial<Stop> = {}) =>
  ({ key: `city:${id}`, kind: "city", id, tripCountryId: "tc", countryCode: "IT", name: id, lat: 1, lng: 2, tz: "Europe/Rome", arrive, depart, ...extra }) as Stop;
const day = (date: string | null, city: string | null, tc = "tc") => ({ date, city_id: city, trip_country_id: tc });

describe("nextDestination", () => {
  const route = [stop("Rome", "2026-11-01", "2026-11-05"), stop("Florence", "2026-11-06", "2026-11-08"), stop("Tokyo", "2026-11-09", "2026-11-20")];

  it("skips the stop you're in and picks the next arrival", () => {
    expect(nextDestination(route, [], "2026-11-03")?.stop.name).toBe("Florence");
  });

  it("moves on once the arrival date is reached", () => {
    expect(nextDestination(route, [], "2026-11-06")?.stop.name).toBe("Tokyo");
  });

  it("doesn't count later days in today's stop as going somewhere", () => {
    expect(nextDestination(route, [day("2026-11-03", "Rome"), day("2026-11-04", "Rome"), day("2026-11-06", "Florence")], "2026-11-03")).toMatchObject({ stop: { name: "Florence" }, arrive: "2026-11-06" });
  });

  it("follows the itinerary when a city has no route dates", () => {
    const stops = [stop("Rome", "2026-11-01", "2026-11-05"), stop("Siena", null, null)];
    expect(nextDestination(stops, [day("2026-11-07", "Siena")], "2026-11-03")).toMatchObject({ stop: { name: "Siena" }, arrive: "2026-11-07" });
  });

  it("takes a day planned earlier than the route's arrival date", () => {
    expect(nextDestination(route, [day("2026-11-07", "Tokyo")], "2026-11-03")?.stop.name).toBe("Florence");
    expect(nextDestination(route, [day("2026-11-05", "Tokyo")], "2026-11-03")?.stop.name).toBe("Tokyo");
  });

  it("finds a return visit to a city left earlier", () => {
    const stops = [stop("Rome", "2026-11-01", "2026-11-02"), stop("Florence", "2026-11-03", "2026-11-05")];
    expect(nextDestination(stops, [day("2026-11-06", "Rome")], "2026-11-04")).toMatchObject({ stop: { name: "Rome" }, arrive: "2026-11-06" });
  });

  it("uses the country stop for a day with no city", () => {
    const country = stop("Japan", null, null, { key: "country:jp", kind: "country", id: "jp", tripCountryId: "jp" });
    expect(nextDestination([country], [day("2026-11-07", null, "jp")], "2026-11-03")?.stop.name).toBe("Japan");
  });

  it("is empty when nothing is ahead", () => {
    expect(nextDestination(route, [], "2026-12-01")).toBeNull();
    expect(nextDestination(route, [], "2026-11-15")).toBeNull();
  });
});

describe("isHomeCity", () => {
  const az = (name: string, kind: Stop["kind"] = "city") => ({ name, kind, countryCode: "AZ" });

  it("recognises Baku however it's spelled", () => {
    expect(isHomeCity(az("Baku"))).toBe(true);
    expect(isHomeCity(az("Bakı"))).toBe(true);
    expect(isHomeCity(az("BAKU"))).toBe(true);
  });

  it("doesn't confuse a city or country on Baku's clock with home", () => {
    expect(isHomeCity(az("Ganja"))).toBe(false);
    expect(isHomeCity(az("Azerbaijan", "country"))).toBe(false);
    expect(isHomeCity({ name: "Tbilisi", kind: "city", countryCode: "GE" })).toBe(false);
  });
});

describe("typicalWeatherLabel", () => {
  it("names the travel month", () => {
    expect(typicalWeatherLabel(11)).toBe("Typical November weather");
    expect(typicalWeatherLabel(1)).toBe("Typical January weather");
  });
});
