import { beforeEach, describe, expect, it, vi } from "vitest";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

type Call = { table: string; op: string; patch?: Record<string, unknown>; filter: Record<string, unknown> };
let calls: Call[];
let failOn: ((c: Call) => boolean) | null;
let places: Record<string, unknown>[];

function client() {
  const from = (table: string) => {
    const call: Call = { table, op: "select", filter: {} };
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: (patch: Record<string, unknown>) => ((call.op = "update"), (call.patch = patch), chain),
      delete: () => ((call.op = "delete"), chain),
      in: (col: string, v: unknown) => ((call.filter[col] = v), chain),
      eq: (col: string, v: unknown) => ((call.filter[col] = v), chain),
      order: () => chain,
      limit: () => chain,
      then: (done: (r: unknown) => unknown) => {
        calls.push(call);
        if (failOn?.(call)) return Promise.resolve({ data: null, error: { message: "boom" } }).then(done);
        if (table === "places" && call.op === "select") return Promise.resolve({ data: places, error: null }).then(done);
        if (table === "photos" && call.op === "select") {
          const rows = call.filter.entity_id === A ? [{ order_index: 4 }] : [{ id: "ph1" }, { id: "ph2" }];
          return Promise.resolve({ data: rows, error: null }).then(done);
        }
        return Promise.resolve({ data: [{ id: "x" }], error: null }).then(done);
      },
    };
    return chain;
  };
  return { from };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ supabase: client(), user: { id: "u" } }) }));
const cleanup = vi.fn();
vi.mock("@/lib/storage", () => ({ cleanupEntityPhotos: cleanup }));

const { mergePlaces } = await import("@/actions/places");

const place = (id: string, extra: Record<string, unknown> = {}) => ({ id, city_id: "tokyo", name: id, status: "want", rating: null, notes: null, lat: null, lng: null, address: null, url: null, cost_estimate: null, cost_currency: null, opening_hours: null, cover_path: null, ...extra });
const writes = () => calls.filter((c) => c.op !== "select");
const key = (c: Call) => `${c.table}.${c.op}`;

beforeEach(() => {
  calls = [];
  failOn = null;
  cleanup.mockClear();
  places = [place(A), place(B, { status: "visited", rating: 5 })];
});

describe("merging places", () => {
  it("moves itinerary links and memories to the kept place", async () => {
    const res = await mergePlaces(A, [B]);
    expect(res).toMatchObject({ ok: true, data: { stops: 1, memories: 1, photos: 2 } });
    expect(calls.find((c) => key(c) === "itinerary_items.update")).toMatchObject({ patch: { place_id: A }, filter: { place_id: [B] } });
    expect(calls.find((c) => key(c) === "memories.update")).toMatchObject({ patch: { place_id: A }, filter: { place_id: [B] } });
  });

  it("carries the visit and rating over to the kept place", async () => {
    await mergePlaces(A, [B]);
    expect(calls.find((c) => key(c) === "places.update")).toMatchObject({ patch: { status: "visited", rating: 5 }, filter: { id: A } });
  });

  it("appends photos after the kept place's own and leaves their files alone", async () => {
    await mergePlaces(A, [B]);
    const moved = calls.filter((c) => key(c) === "photos.update");
    expect(moved.map((c) => c.patch)).toEqual([{ entity_id: A, order_index: 5 }, { entity_id: A, order_index: 6 }]);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("deletes the duplicates last, so a link can never be cut", async () => {
    await mergePlaces(A, [B]);
    const order = writes().map(key);
    expect(order.at(-1)).toBe("places.delete");
    expect(order.indexOf("places.delete")).toBeGreaterThan(order.indexOf("itinerary_items.update"));
    expect(order.indexOf("places.delete")).toBeGreaterThan(order.indexOf("memories.update"));
    expect(order.indexOf("places.delete")).toBeGreaterThan(order.lastIndexOf("photos.update"));
    expect(calls.find((c) => key(c) === "places.delete")?.filter).toEqual({ id: [B] });
  });

  it("deletes nothing when moving a link fails", async () => {
    for (const table of ["itinerary_items", "memories", "photos"]) {
      calls = [];
      failOn = (c) => c.table === table && c.op === "update";
      const res = await mergePlaces(A, [B]);
      expect(res.ok).toBe(false);
      expect(calls.some((c) => key(c) === "places.delete")).toBe(false);
    }
  });

  it("refuses places in different cities", async () => {
    places = [place(A), place(B, { city_id: "kyoto" })];
    expect(await mergePlaces(A, [B])).toMatchObject({ ok: false, error: "Only places in the same city can be merged." });
    expect(writes()).toEqual([]);
  });

  it("refuses when a place is gone, or merged into itself", async () => {
    places = [place(A)];
    expect((await mergePlaces(A, [B])).ok).toBe(false);
    expect((await mergePlaces(A, [A])).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("merges several at once", async () => {
    places = [place(A), place(B), place(C)];
    await mergePlaces(A, [B, C, B]);
    expect(calls.find((c) => key(c) === "places.delete")?.filter).toEqual({ id: [B, C] });
  });
});
