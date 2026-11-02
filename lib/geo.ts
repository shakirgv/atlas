import { geoInterpolate } from "d3-geo";
import { haversineKm } from "@/lib/utils";

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng) {
  return haversineKm(a, b);
}

/** Point halfway along the great-circle arc from a to b (the same arc d3-geo draws). */
export function arcMidpoint(a: LatLng, b: LatLng): LatLng {
  const [lng, lat] = geoInterpolate([a.lng, a.lat], [b.lng, b.lat])(0.5);
  return { lat, lng };
}

/** Sum of great-circle legs between consecutive points. */
export function pathDistanceKm(points: LatLng[]) {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += distanceKm(points[i - 1]!, points[i]!);
  return km;
}

/** Round to ~11 km (1 decimal) — used for cache keys and "city-level" public locations. */
export function roundCoord(n: number, decimals = 1) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
