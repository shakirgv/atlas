import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Trip } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/vault", () => ({ getVaultState: async () => ({ hasPin: false, unlocked: false, pinLength: null, lockedUntil: null }) }));

const { loadGraph } = await import("@/lib/data");
const { signPhotoPaths } = await import("@/lib/storage");

const ROWS: Record<string, Record<string, unknown>[]> = {
  trip_countries: [{ id: "tc", trip_id: "t", country_code: "TR", status: "planned" }],
  cities: [{ id: "c", trip_country_id: "tc", status: "planned" }],
  places: [{ id: "p", city_id: "c" }],
  itinerary_days: [{ id: "d", trip_country_id: "tc" }],
  itinerary_items: [{ id: "i", day_id: "d" }],
  memories: [{ id: "m", trip_id: "t" }],
  photos: [{ id: "ph", entity_type: "memory", entity_id: "m", path: "u/p.webp", thumb_path: null }],
  documents: [{ id: "doc" }],
};

/** Calls started together answer together, so `steps` counts how many rounds a page had to wait for. */
function fakeClient(token: string | null) {
  const stats = { steps: 0, signed: [] as string[] };
  let round: (() => void)[] | null = null;
  const track = async <T>(result: () => T) => {
    await new Promise<void>((resolve) => {
      if (!round) {
        const current: (() => void)[] = (round = []);
        stats.steps++;
        setTimeout(() => {
          round = null;
          current.forEach((answer) => answer());
        }, 1);
      }
      round.push(resolve);
    });
    return result();
  };
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "in", "eq", "neq", "order", "limit"]) chain[method] = () => chain;
    chain.then = (done: (r: unknown) => unknown, failed: (e: unknown) => unknown) => track(() => ({ data: ROWS[table] ?? [], error: null, count: 0 })).then(done, failed);
    return chain;
  };
  const client = {
    from: query,
    auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) },
    storage: {
      from: () => ({
        createSignedUrls: (paths: string[]) =>
          track(() => {
            stats.signed.push(...paths);
            return { data: paths.map((path) => ({ path, signedUrl: `https://x/${path}?token=${crypto.randomUUID()}` })) };
          }),
      }),
    },
  };
  return { client: client as unknown as ServerSupabase, stats };
}

const trip = { id: "t", title: "Trip", cover_path: "u/cover.webp" } as unknown as Trip;

describe("loadGraph", () => {
  it("loads a full page in four rounds, however many tables it needs", async () => {
    const { client, stats } = fakeClient("graph");
    const g = await loadGraph(client, [trip], ["t"], { days: true, places: true, expenses: true, memories: true, documents: true, bookings: true, entries: true, photoCount: true, receipts: true });
    expect(stats.steps).toBeLessThanOrEqual(4);
    expect(g.items.map((i) => i.id)).toEqual(["i"]);
    expect(g.places.map((p) => p.id)).toEqual(["p"]);
    expect(g.memories[0]?.photos.map((p) => p.id)).toEqual(["ph"]);
    expect(g.trips[0]?.cover_url).toContain("u/cover.webp");
  });

  it("asks for nothing under an empty trip list", async () => {
    const { client, stats } = fakeClient("empty");
    const g = await loadGraph(client, [trip], [], { days: true, places: true, expenses: true, memories: true });
    expect(stats.steps).toBe(0);
    expect(g.countries).toEqual([]);
  });
});

describe("signPhotoPaths", () => {
  beforeEach(() => vi.useRealTimers());

  it("hands the same link back to the same session, without asking again", async () => {
    const { client, stats } = fakeClient("reuse");
    const first = await signPhotoPaths(client, ["reuse/a.webp"]);
    const second = await signPhotoPaths(client, ["reuse/a.webp", "reuse/b.webp"]);
    expect(second["reuse/a.webp"]).toBe(first["reuse/a.webp"]);
    expect(stats.signed).toEqual(["reuse/a.webp", "reuse/b.webp"]);
  });

  it("never gives one session a link made for another", async () => {
    const owner = fakeClient("owner-session");
    const other = fakeClient("other-session");
    const mine = await signPhotoPaths(owner.client, ["shared/a.webp"]);
    const theirs = await signPhotoPaths(other.client, ["shared/a.webp"]);
    expect(theirs["shared/a.webp"]).not.toBe(mine["shared/a.webp"]);
    expect(other.stats.signed).toEqual(["shared/a.webp"]);
  });

  it("keeps the service-role client apart from signed-in sessions", async () => {
    const session = fakeClient("some-session");
    const service = fakeClient(null);
    await signPhotoPaths(session.client, ["split/a.webp"]);
    await signPhotoPaths(service.client, ["split/a.webp"]);
    expect(service.stats.signed).toEqual(["split/a.webp"]);
  });

  it("signs again once half the link's life has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { client, stats } = fakeClient("expiry");
    await signPhotoPaths(client, ["old/a.webp"]);
    vi.setSystemTime(Date.now() + 29 * 60 * 1000);
    await signPhotoPaths(client, ["old/a.webp"]);
    expect(stats.signed).toHaveLength(1);
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    await signPhotoPaths(client, ["old/a.webp"]);
    expect(stats.signed).toHaveLength(2);
  });
});
