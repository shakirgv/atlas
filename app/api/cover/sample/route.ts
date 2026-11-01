import { NextResponse } from "next/server";
import { apiUser } from "@/lib/server/api";
import { coverQueries, findWikiImage, storeCover, type CoverKind } from "@/lib/cover";

/** POST /api/cover/sample — fill covers for the sample trip's countries, cities and places (best effort). */
export async function POST() {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;
  const { data: trips } = await supabase.from("trips").select("id").eq("is_sample", true);
  const tripIds = (trips ?? []).map((t) => t.id);
  if (!tripIds.length) return NextResponse.json({ ok: true, stored: 0 });
  const { data: tcs } = await supabase.from("trip_countries").select("id, cover_path").in("trip_id", tripIds);
  const { data: cities } = await supabase.from("cities").select("id, cover_path").in("trip_country_id", (tcs ?? []).map((t) => t.id));
  const { data: places } = await supabase.from("places").select("id, cover_path").in("city_id", (cities ?? []).map((c) => c.id));
  const jobs: [CoverKind, string][] = [
    ...(tcs ?? []).filter((r) => !r.cover_path).map((r) => ["country", r.id] as [CoverKind, string]),
    ...(cities ?? []).filter((r) => !r.cover_path).map((r) => ["city", r.id] as [CoverKind, string]),
    ...(places ?? []).filter((r) => !r.cover_path).map((r) => ["place", r.id] as [CoverKind, string]),
  ];
  let stored = 0;
  const deadline = Date.now() + 50_000;
  for (const [kind, id] of jobs) {
    if (Date.now() > deadline) break;
    try {
      const q = await coverQueries(supabase, kind, id);
      if (!q) continue;
      const hit = await findWikiImage(q.queries);
      if (!hit) continue;
      await storeCover(supabase, user.id, kind, id, hit);
      stored++;
    } catch {
      // Keep going; gradients are the fallback.
    }
  }
  return NextResponse.json({ ok: true, stored });
}
