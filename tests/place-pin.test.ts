import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSupabase } from "@/lib/supabase/server";
import { pickPin, placeQuery } from "@/lib/place-pin";
import type { GeoResult } from "@/lib/server/geocode";

vi.mock("server-only", () => ({}));

const { findPlacePin } = await import("@/lib/server/geocode");

const TOKYO = { lat: 35.68, lng: 139.76 };
const ISTANBUL = { lat: 41.01, lng: 28.97 };

function result(name: string, lat: number, lng: number): GeoResult {
  return { id: name, name, label: name, lat, lng, countryCode: "JP", city: null, address: `${name} address`, kind: null };
}

describe("placeQuery", () => {
  it.each([
    ["Hagia Sophia", "Hagia Sophia"],
    ["Senso-ji temple", "Senso-ji temple"],
    ["Topkapı Palace", "Topkapı Palace"],
    ["Walk around Gion", "Gion"],
    ["Dinner in Trastevere", "Trastevere"],
    ["Dinner at Sukiyabashi Jiro", "Sukiyabashi Jiro"],
    ["Lunch @ Roscioli", "Roscioli"],
    ["Baklava at Karaköy Güllüoğlu", "Karaköy Güllüoğlu"],
    ["Galata Tower at sunset", "Galata Tower"],
    ["Colosseum & Roman Forum", "Colosseum"],
    ["Shibuya Crossing & dinner", "Shibuya Crossing"],
    ["Land at Haneda, activate JR Pass", "Haneda"],
    ["Day trip to Nikko", "Nikko"],
    ["Visit Tokyo Tower", "Tokyo Tower"],
    ["Moon Cafe at the Park", "Moon Cafe at the Park"],
  ])("searches for the place in %s", (name, query) => {
    expect(placeQuery(name)).toBe(query);
  });

  it.each(["Lunch", "Free time", "Check in at hotel", "Breakfast at hotel", "Museum", "Flight to Bali", "Bosphorus ferry to Kadıköy", "Rome → Tokyo", "  "])(
    "finds no place in %j",
    (name) => {
      expect(placeQuery(name)).toBeNull();
    },
  );
});

describe("pickPin", () => {
  it("accepts a name that differs only in spelling marks and hyphens", () => {
    expect(pickPin("Senso-ji", TOKYO, [result("Sensō-ji", 35.713, 139.796)])).toMatchObject({ full: true, result: { name: "Sensō-ji" } });
    expect(pickPin("Kinkakuji", { lat: 35.01, lng: 135.77 }, [result("Kinkaku-ji", 35.04, 135.73)])).toMatchObject({ full: true });
    expect(pickPin("Topkapi Palace", ISTANBUL, [result("Topkapı Palace", 41.01, 28.98)])).toMatchObject({ full: true });
  });

  it("skips namesakes far from the city but keeps day trips", () => {
    expect(pickPin("Old Town", { lat: 41.72, lng: 44.79 }, [result("Old Town", 48.426, -123.371)])).toBeNull();
    expect(pickPin("Mount Fuji", TOKYO, [result("Mount Fuji", 35.363, 138.731)])).toMatchObject({ full: true });
  });

  it("skips results that only share a generic word", () => {
    expect(pickPin("Unknown Cafe", TOKYO, [result("Cafe Tokyo", 35.68, 139.76)])).toBeNull();
    expect(pickPin("Blue Mosque", ISTANBUL, [result("Sultan Mosque", 41.0, 28.97)])).toBeNull();
    expect(pickPin("Old Town", TOKYO, [result("Old Street", 35.68, 139.76)])).toBeNull();
    expect(pickPin("Mount Fuji", TOKYO, [result("Fuji Television", 35.627, 139.775)])).toBeNull();
    expect(pickPin("Galata Tower", ISTANBUL, [result("Galata Bridge", 41.02, 28.97)])).toBeNull();
  });

  it("lets a name go without its kind only when nothing else is added, and calls that loose", () => {
    expect(pickPin("Narikala Fortress", { lat: 41.72, lng: 44.79 }, [result("Narikala", 41.688, 44.809)])).toMatchObject({ full: false, result: { name: "Narikala" } });
    expect(pickPin("Senso-ji temple", TOKYO, [result("Sensō-ji", 35.713, 139.796)])).toMatchObject({ full: false });
    expect(pickPin("Tsukiji Market", TOKYO, [result("Tsukiji Outer Market", 35.665, 139.77)])).toMatchObject({ full: true });
  });

  it("prefers a result with every word over a higher-ranked loose one", () => {
    const pick = pickPin("Mount Fuji", TOKYO, [result("Fuji", 35.549, 139.748), result("Mount Fuji", 35.363, 138.731)]);
    expect(pick).toMatchObject({ full: true, result: { name: "Mount Fuji" } });
  });

  it("judges by name alone when the city has no coordinates", () => {
    expect(pickPin("Gion", { lat: null, lng: null }, [result("Gion", 35.005, 135.778)])).toMatchObject({ result: { name: "Gion" } });
  });
});

describe("findPlacePin", () => {
  afterEach(() => vi.unstubAllGlobals());

  const client = (city: { name: string; lat: number | null; lng: number | null; trip_countries: { country_code: string } }) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: city, error: null }) }) }) }) }) as unknown as ServerSupabase;
  const supabase = client({ name: "Tokyo", lat: 35.68, lng: 139.76, trip_countries: { country_code: "JP" } });

  const photon = (name: string, lng: number, lat: number, countrycode = "JP") => ({
    geometry: { coordinates: [lng, lat] },
    properties: { name, city: "Tokyo", country: "Japan", countrycode, osm_id: 1, osm_type: "N" },
  });
  const nominatim = (name: string, lat: string, lon: string) => ({ place_id: 1, name, display_name: `${name}, Japan`, lat, lon, address: { country_code: "jp" } });

  it("searches by place and city, and returns the pin with an address", async () => {
    const fetchMock = vi.fn(async (_url: URL) => Response.json({ features: [photon("Tokyo Tower", 139.746, 35.658)] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(findPlacePin(supabase, "city", "Visit Tokyo Tower")).resolves.toEqual({ lat: 35.658, lng: 139.746, address: "Tokyo, Japan" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0]![0];
    expect(url.searchParams.get("q")).toBe("Tokyo Tower, Tokyo");
    expect(url.searchParams.get("lat")).toBe("35.68");
  });

  it("searches without the city when that finds nothing, for a day trip", async () => {
    const fetchMock = vi.fn(async (url: URL) =>
      Response.json({ features: url.searchParams.get("q")?.includes("Tokyo") ? [photon("Fuji", 139.748, 35.549)] : [photon("Mount Fuji", 138.731, 35.363)] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(findPlacePin(supabase, "city", "Mount Fuji")).resolves.toMatchObject({ lat: 35.363, lng: 138.731 });
    expect(fetchMock.mock.calls.map(([url]) => url.searchParams.get("q"))).toEqual(["Mount Fuji, Tokyo", "Mount Fuji"]);
  });

  it("doesn't let a border hide a place that is in the city", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: URL) => Response.json({ features: [photon("Vatican Museums", 12.455, 41.905, "VA")] })));
    const rome = client({ name: "Rome", lat: 41.9, lng: 12.5, trip_countries: { country_code: "IT" } });
    await expect(findPlacePin(rome, "city", "Vatican Museums")).resolves.toMatchObject({ lat: 41.905, lng: 12.455 });
  });

  it("uses the country as the only guard when the city has no coordinates", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => (url.hostname.startsWith("photon") ? Response.json({ features: [photon("Gion", 8.8, 47.3, "CH")] }) : Response.json([]))));
    await expect(findPlacePin(client({ name: "Kyoto", lat: null, lng: null, trip_countries: { country_code: "JP" } }), "city", "Gion")).resolves.toBeNull();
  });

  it("doesn't call the geocoder for a name that is no place", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(findPlacePin(supabase, "city", "Lunch")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the second geocoder when the first is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => (url.hostname.startsWith("photon") ? new Response("busy", { status: 503 }) : Response.json([nominatim("Sukiyabashi Jiro", "35.673", "139.764")]))));
    await expect(findPlacePin(supabase, "city", "Sukiyabashi Jiro")).resolves.toEqual({ lat: 35.673, lng: 139.764, address: "Sukiyabashi Jiro, Japan" });
  });

  it("keeps the first search's loose match when the second search fails", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        if (calls++ === 0) return Response.json({ features: [photon("Sensō-ji", 139.796, 35.713)] });
        throw new Error("network down");
      }),
    );
    await expect(findPlacePin(supabase, "city", "Senso-ji temple")).resolves.toMatchObject({ lat: 35.713, lng: 139.796 });
  });

  it("answers null instead of failing the save when both geocoders are down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(findPlacePin(supabase, "city", "Hagia Sophia")).resolves.toBeNull();
  });
});
