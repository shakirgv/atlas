import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";
import { geocode, type GeoResult } from "@/lib/server/geocode";

export type { GeoResult };

const params = z.object({
  q: z.string().trim().min(2).max(200),
  layer: z.enum(["city", "any"]).default("any"),
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  lat: z.coerce.number<string>().min(-90).max(90).optional(),
  lng: z.coerce.number<string>().min(-180).max(180).optional(),
});

/** GET /api/geocode?q=&layer=city&country=JP&lat=&lng= — Photon with Nominatim fallback. */
export async function GET(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  try {
    const sp = new URL(req.url).searchParams;
    const input = params.parse({
      q: sp.get("q"),
      layer: sp.get("layer") ?? undefined,
      country: sp.get("country") ?? undefined,
      lat: sp.get("lat") ?? undefined,
      lng: sp.get("lng") ?? undefined,
    });
    try {
      return NextResponse.json({ results: await geocode(input) });
    } catch {
      return NextResponse.json({ results: [], error: "Search is unavailable right now. You can still type a name." }, { status: 200 });
    }
  } catch (e) {
    return apiError(e);
  }
}
