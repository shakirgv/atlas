import { describe, expect, it } from "vitest";
import { clusterStops, clusterView, CLUSTER_RADIUS, frameView, MAX_ZOOM, searchRoute, visibleRect } from "@/lib/map-view";

const [W, H] = [960, 500];
const FULL = visibleRect(null, W, H);

describe("visible part of the map", () => {
  it("is the map itself before the box is measured, or when the shapes match", () => {
    expect(FULL).toEqual({ x0: 0, y0: 0, x1: W, y1: H });
    expect(visibleRect({ w: 1920, h: 1000 }, W, H)).toEqual(FULL);
  });
  it("adds even space above and below in a tall box", () => {
    expect(visibleRect({ w: 960, h: 1000 }, W, H)).toEqual({ x0: 0, y0: -250, x1: 960, y1: 750 });
  });
  it("adds even space at the sides in a wide box", () => {
    expect(visibleRect({ w: 2000, h: 500 }, W, H)).toEqual({ x0: -520, y0: 0, x1: 1480, y1: 500 });
  });
});

describe("framing", () => {
  it("centres on the points when there's room to", () => {
    const v = frameView([{ x: 400, y: 200 }, { x: 500, y: 300 }], FULL, W, H, { maxK: 3 });
    expect(v.k).toBeCloseTo(500 / 240, 3);
    expect(450 * v.k + v.x).toBeCloseTo(W / 2, 1);
    expect(250 * v.k + v.y).toBeCloseTo(H / 2, 1);
  });
  it("never leaves space past the map's edge once the map is bigger than the view", () => {
    const v = frameView([{ x: 2, y: 2 }, { x: 10, y: 10 }], FULL, W, H, { maxK: 5 });
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });
  it("uses the whole box: a tall one lets a narrow route zoom in further than the map's own shape would", () => {
    const pts = [{ x: 470, y: 100 }, { x: 490, y: 400 }];
    expect(frameView(pts, visibleRect({ w: 960, h: 1000 }, W, H), W, H).k).toBeGreaterThan(frameView(pts, FULL, W, H).k);
  });
  it("centres the map when it's smaller than the view", () => {
    const r = visibleRect({ w: 960, h: 1000 }, W, H);
    expect(frameView([{ x: 0, y: 100 }, { x: 960, y: 200 }], r, W, H)).toEqual({ k: 1, x: 0, y: 0 });
  });
  it("respects the zoom limits", () => {
    expect(frameView([{ x: 480, y: 250 }], FULL, W, H, { pad: 1, maxK: 4 }).k).toBe(4);
    expect(frameView([{ x: 0, y: 0 }, { x: W, y: H }], FULL, W, H, { minK: 2 }).k).toBe(2);
  });
});

describe("clustering", () => {
  const stops = [
    { id: "a", x: 100, y: 100 },
    { id: "b", x: 108, y: 100 },
    { id: "c", x: 112, y: 104 },
    { id: "d", x: 400, y: 300 },
  ];
  it("groups nearby stops at low zoom and leaves far ones alone", () => {
    expect(clusterStops(stops, 1).map((x) => x.members.map((m) => m.id))).toEqual([["a", "b", "c"], ["d"]]);
  });
  it("places a group at the middle of its stops", () => {
    const [c] = clusterStops(stops, 1);
    expect(c!.x).toBeCloseTo(320 / 3, 5);
    expect(c!.y).toBeCloseTo(304 / 3, 5);
  });
  it("splits as you zoom in", () => {
    expect(clusterStops(stops, 2.5).map((x) => x.members.length)).toEqual([1, 2, 1]);
    expect(clusterStops(stops, 6).every((x) => x.members.length === 1)).toBe(true);
  });
  it("keeps every stop exactly once at any zoom", () => {
    for (const k of [1, 1.5, 3, 7, MAX_ZOOM]) expect(clusterStops(stops, k).flatMap((c) => c.members.map((m) => m.id)).sort()).toEqual(["a", "b", "c", "d"]);
  });
  it("uses the distance on screen", () => {
    const pair = [{ x: 0, y: 0 }, { x: CLUSTER_RADIUS - 1, y: 0 }];
    expect(clusterStops(pair, 1)).toHaveLength(1);
    expect(clusterStops(pair, 2)).toHaveLength(2);
  });
  it("handles no stops", () => {
    expect(clusterStops([], 1)).toEqual([]);
  });
});

describe("clicking a cluster", () => {
  it("frames its stops, far enough in to split them", () => {
    const members = [{ x: 400, y: 200 }, { x: 412, y: 200 }];
    const v = clusterView(members, FULL, W, H, 1);
    expect(clusterStops(members, v.k)).toHaveLength(2);
    expect(406 * v.k + v.x).toBeCloseTo(W / 2, 1);
  });
  it("always moves closer, up to the limit, even for stops in one spot", () => {
    const same = [{ x: 400, y: 200 }, { x: 400, y: 200 }];
    expect(clusterView([{ x: 0, y: 0 }, { x: W, y: H }], FULL, W, H, 2).k).toBeCloseTo(3.6, 5);
    expect(clusterView(same, FULL, W, H, MAX_ZOOM).k).toBe(MAX_ZOOM);
  });
});

describe("route search", () => {
  const route = [{ name: "Türkiye" }, { name: "Italy" }, { name: "São Tomé and Príncipe" }, { name: "Ireland" }];
  it("keeps the original route numbers", () => {
    expect(searchRoute(route, "ire").map((r) => [r.n, r.country.name])).toEqual([[4, "Ireland"]]);
    expect(searchRoute(route, "ita").map((r) => r.n)).toEqual([2]);
  });
  it("ignores case, accents and surrounding space", () => {
    expect(searchRoute(route, "  TURK ").map((r) => r.n)).toEqual([1]);
    expect(searchRoute(route, "sao tome").map((r) => r.n)).toEqual([3]);
  });
  it("shows everything for an empty search, in order", () => {
    expect(searchRoute(route, "").map((r) => r.n)).toEqual([1, 2, 3, 4]);
  });
  it("finds nothing when nothing matches", () => {
    expect(searchRoute(route, "narnia")).toEqual([]);
  });
});
