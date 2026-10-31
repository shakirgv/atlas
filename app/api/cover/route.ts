import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";
import { coverQueries, findWikiImage, isAllowedImageUrl, storeCover } from "@/lib/cover";

const body = z.object({
  kind: z.enum(["trip", "country", "city", "place"]),
  id: z.uuid(),
  /** Optional explicit query (otherwise derived from the entity). */
  query: z.string().trim().min(1).max(200).optional(),
  /** Phase 2 picker: a specific upload.wikimedia.org image. */
  candidate: z
    .object({ url: z.url(), thumb: z.string().optional(), title: z.string().max(300), attribution: z.string().max(600) })
    .optional(),
  /** Skip when the entity already has a cover (auto-fetch on create). */
  onlyIfEmpty: z.boolean().optional(),
});

const TABLE = { trip: "trips", country: "trip_countries", city: "cities", place: "places" } as const;

/** POST /api/cover — find a Wikipedia image for an entity and store it as its cover. */
export async function POST(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  try {
    const input = body.parse(await req.json());
    const { supabase, user } = auth;
    if (input.onlyIfEmpty) {
      const { data } = await supabase.from(TABLE[input.kind]).select("cover_path").eq("id", input.id).maybeSingle();
      if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (data.cover_path) return NextResponse.json({ ok: true, skipped: true });
    }
    let candidate = input.candidate ?? null;
    if (candidate) {
      if (!isAllowedImageUrl(candidate.url)) return NextResponse.json({ error: "Image host not allowed" }, { status: 400 });
      candidate = { ...candidate, thumb: candidate.thumb ?? candidate.url };
    } else {
      const derived = await coverQueries(supabase, input.kind, input.id);
      if (!derived) return NextResponse.json({ error: "Not found" }, { status: 404 });
      candidate = await findWikiImage(input.query ? [input.query, ...derived.queries] : derived.queries);
    }
    if (!candidate) return NextResponse.json({ ok: false, found: false });
    const stored = await storeCover(supabase, user.id, input.kind, input.id, { ...candidate, thumb: candidate.thumb ?? candidate.url });
    return NextResponse.json({ ok: true, found: true, path: stored.path });
  } catch (e) {
    return apiError(e, 502);
  }
}
