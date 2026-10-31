import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";
import { commonsCandidates, coverQueries } from "@/lib/cover";

const params = z.object({
  kind: z.enum(["trip", "country", "city", "place"]),
  id: z.uuid(),
  q: z.string().trim().max(200).optional(),
});

/** GET /api/cover/candidates — up to 8 Wikimedia Commons images for the cover picker. */
export async function GET(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const input = params.parse({ kind: url.searchParams.get("kind"), id: url.searchParams.get("id"), q: url.searchParams.get("q") || undefined });
    let query = input.q;
    if (!query) {
      const derived = await coverQueries(auth.supabase, input.kind, input.id);
      query = derived?.label;
    }
    if (!query) return NextResponse.json({ candidates: [] });
    const candidates = await commonsCandidates(query);
    return NextResponse.json({ query, candidates });
  } catch (e) {
    return apiError(e, 502);
  }
}
