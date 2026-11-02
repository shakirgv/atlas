"use client";
import { useEffect, useMemo, useState } from "react";
import { climateKey, type ClimateMonth, type ForecastDay } from "@/lib/climate";

const climateMemo = new Map<string, ClimateMonth[]>();
const forecastMemo = new Map<string, ForecastDay[]>();

/**
 * Monthly normals for a list of points, fetched from the browser so an unreachable weather API can
 * never slow down or break a page. Results are kept for the session; failures are retried on the
 * next mount. `failed` means at least one point has no data.
 */
export function useClimate(points: { lat: number; lng: number }[]) {
  const query = useMemo(() => Array.from(new Set(points.map((p) => climateKey(p.lat, p.lng)))).sort().join(";"), [points]);
  const [settled, setSettled] = useState<{ query: string; failed: boolean } | null>(null);

  useEffect(() => {
    const missing = query.split(";").filter((k) => k && !climateMemo.has(k));
    if (!missing.length) return;
    let alive = true;
    fetch(`/api/climate?points=${encodeURIComponent(missing.join(";"))}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<{ results: Record<string, ClimateMonth[] | null> }>;
      })
      .then(({ results }) => {
        for (const [k, v] of Object.entries(results)) if (v) climateMemo.set(k, v);
        if (alive) setSettled({ query, failed: missing.some((k) => !results[k]) });
      })
      .catch(() => {
        if (alive) setSettled({ query, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [query]);

  const keys = query.split(";").filter(Boolean);
  const data: Record<string, ClimateMonth[] | undefined> = {};
  for (const k of keys) data[k] = climateMemo.get(k);
  const complete = keys.every((k) => data[k]);
  const done = settled?.query === query;
  return { data, loading: !complete && !done, failed: !complete && done && Boolean(settled?.failed) };
}

/** Daily forecast for one point. Pass `enabled = false` when it is not needed. */
export function useForecast(lat: number, lng: number, enabled: boolean) {
  const key = climateKey(lat, lng);
  const [settled, setSettled] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || forecastMemo.has(key)) return;
    let alive = true;
    fetch(`/api/forecast?lat=${lat}&lng=${lng}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ days: ForecastDay[] | null }>) : { days: null }))
      .catch(() => ({ days: null }))
      .then(({ days }) => {
        if (days) forecastMemo.set(key, days);
        if (alive) setSettled(key);
      });
    return () => {
      alive = false;
    };
  }, [key, lat, lng, enabled]);

  const days = enabled ? (forecastMemo.get(key) ?? null) : null;
  return { days, loading: enabled && !days && settled !== key, failed: enabled && !days && settled === key };
}
