import "server-only";
import { unstable_cache } from "next/cache";
import { USER_AGENT } from "@/lib/config";
import { aggregateDaily, type ClimateMonth, type ForecastDay } from "@/lib/climate";

const CLIMATE_YEARS = 5;
const THIRTY_DAYS = 30 * 86400;
const THREE_HOURS = 3 * 3600;

async function getJson(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return res.json();
}

/**
 * Throwing keeps failures out of the cache, so the next visit simply tries again. `lastYear` is an
 * argument so it becomes part of the cache key and the window moves on each new year.
 */
const cachedClimate = unstable_cache(
  async (lat: number, lng: number, lastYear: number): Promise<ClimateMonth[]> => {
    const q = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      start_date: `${lastYear - CLIMATE_YEARS + 1}-01-01`,
      end_date: `${lastYear}-12-31`,
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
      timezone: "UTC",
    });
    const json = await getJson(`https://archive-api.open-meteo.com/v1/archive?${q}`);
    const months = json?.daily ? aggregateDaily(json.daily) : null;
    if (!months) throw new Error("Open-Meteo: incomplete climate data");
    return months;
  },
  ["open-meteo-climate-v1"],
  { revalidate: THIRTY_DAYS },
);

const cachedForecast = unstable_cache(
  async (lat: number, lng: number): Promise<ForecastDay[]> => {
    const q = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "16",
    });
    const json = await getJson(`https://api.open-meteo.com/v1/forecast?${q}`);
    const d = json?.daily;
    if (!d?.time?.length) throw new Error("Open-Meteo: empty forecast");
    return (d.time as string[]).map((date, i) => ({
      date,
      code: d.weather_code[i] ?? -1,
      tmax: d.temperature_2m_max[i] ?? 0,
      tmin: d.temperature_2m_min[i] ?? 0,
      rainChance: d.precipitation_probability_max[i] ?? null,
    }));
  },
  ["open-meteo-forecast-v1"],
  { revalidate: THREE_HOURS },
);

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Monthly normals over the last five complete calendar years, or null when unavailable. */
export async function getClimate(lat: number, lng: number): Promise<ClimateMonth[] | null> {
  try {
    return await cachedClimate(round1(lat), round1(lng), new Date().getUTCFullYear() - 1);
  } catch {
    return null;
  }
}

/** Daily forecast for the next 16 days, or null when unavailable. */
export async function getForecast(lat: number, lng: number): Promise<ForecastDay[] | null> {
  try {
    return await cachedForecast(round1(lat), round1(lng));
  } catch {
    return null;
  }
}
