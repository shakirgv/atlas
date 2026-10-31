"use client";
import { useEffect, useRef, useState } from "react";
import type { GeoResult } from "@/app/api/geocode/route";

export type { GeoResult };

/** Debounced (350ms) search-as-you-type against /api/geocode. */
export function useGeocode(
  query: string,
  opts: { layer?: "city" | "any"; country?: string | null; near?: { lat: number; lng: number } | null; enabled?: boolean } = {},
) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const { layer = "any", country, near, enabled = true } = opts;
  const lat = near?.lat;
  const lng = near?.lng;

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 2) {
      abort.current?.abort();
      const t = setTimeout(() => {
        setResults([]);
        setLoading(false);
        setError(null);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      try {
        const sp = new URLSearchParams({ q, layer });
        if (country) sp.set("country", country);
        if (lat !== undefined && lng !== undefined) {
          sp.set("lat", String(lat));
          sp.set("lng", String(lng));
        }
        const res = await fetch(`/api/geocode?${sp}`, { signal: ctrl.signal });
        const json = (await res.json()) as { results?: GeoResult[]; error?: string };
        setResults(json.results ?? []);
        setError(json.error ?? (res.ok ? null : "Search failed"));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Search is unavailable right now.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, layer, country, lat, lng, enabled]);

  return { results, loading, error };
}
