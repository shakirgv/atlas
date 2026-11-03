/** The part of the map's coordinate space the element shows, which is more than the map when their shapes differ. */
export type MapRect = { x0: number; y0: number; x1: number; y1: number };
export type MapView = { k: number; x: number; y: number };
type Point = { x: number; y: number };

export const MAX_ZOOM = 14;
/** Numbered markers are 16 units across and keep that size at any zoom, so this leaves them a small gap. */
export const CLUSTER_RADIUS = 20;

/** With "meet" scaling, a box of a different shape shows spare space around the W × H map, split evenly. */
export function visibleRect(box: { w: number; h: number } | null, W: number, H: number): MapRect {
  if (!box) return { x0: 0, y0: 0, x1: W, y1: H };
  const scale = Math.min(box.w / W, box.h / H);
  const [visW, visH] = [box.w / scale, box.h / scale];
  return { x0: (W - visW) / 2, y0: (H - visH) / 2, x1: (W + visW) / 2, y1: (H + visH) / 2 };
}

/** Same rule as d3-zoom's translate limit: no space past the map's edge, and centred once it's smaller than the view. */
function clampAxis(target: number, lo: number, hi: number, size: number) {
  const min = hi - size;
  return min > lo ? (lo + hi - size) / 2 : Math.min(lo, Math.max(min, target));
}

/** Zoom transform that frames the points, with padding. Rounded so the server and the browser agree on it. */
export function frameView(points: Point[], rect: MapRect, W: number, H: number, { pad = 70, minK = 1, maxK = MAX_ZOOM }: { pad?: number; minK?: number; maxK?: number } = {}): MapView {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.max(minK, Math.min(maxK, Math.min((rect.x1 - rect.x0) / (x1 - x0 + pad * 2), (rect.y1 - rect.y0) / (y1 - y0 + pad * 2))));
  const x = clampAxis((rect.x0 + rect.x1) / 2 - ((x0 + x1) / 2) * k, rect.x0, rect.x1, W * k);
  const y = clampAxis((rect.y0 + rect.y1) / 2 - ((y0 + y1) / 2) * k, rect.y0, rect.y1, H * k);
  return { k: Math.round(k * 10000) / 10000, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
}

export type StopCluster<T> = { x: number; y: number; members: T[] };

/**
 * Groups markers that would touch at zoom `k`. Each stop joins the first group within reach, in route order,
 * so the same stops and zoom always give the same groups. Positions are map units; markers keep their size on screen.
 */
export function clusterStops<T extends Point>(stops: T[], k: number, radius = CLUSTER_RADIUS): StopCluster<T>[] {
  const clusters: StopCluster<T>[] = [];
  for (const stop of stops) {
    const near = clusters.find((c) => Math.hypot(c.x - stop.x, c.y - stop.y) * k < radius);
    if (!near) {
      clusters.push({ x: stop.x, y: stop.y, members: [stop] });
      continue;
    }
    near.members.push(stop);
    near.x += (stop.x - near.x) / near.members.length;
    near.y += (stop.y - near.y) / near.members.length;
  }
  return clusters;
}

/** Where clicking a cluster goes: framing its stops, and always closer in, so repeated clicks keep splitting it. */
export function clusterView(members: Point[], rect: MapRect, W: number, H: number, currentK: number): MapView {
  return frameView(members, rect, W, H, { pad: 40, minK: Math.min(MAX_ZOOM, currentK * 1.8) });
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Numbers the route first and filters second, so a result keeps its place in the route. Ignores accents and case. */
export function searchRoute<T extends { name: string }>(countries: T[], query: string) {
  const q = fold(query);
  return countries.map((country, i) => ({ country, n: i + 1 })).filter((row) => fold(row.country.name).includes(q));
}
