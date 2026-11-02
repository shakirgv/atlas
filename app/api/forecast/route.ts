import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";
import { getForecast } from "@/lib/server/weather";

const Query = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

/** GET /api/forecast?lat=13.8&lng=100.5 — daily forecast (days is null when unavailable). */
export async function GET(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  try {
    const sp = new URL(req.url).searchParams;
    const { lat, lng } = Query.parse({ lat: sp.get("lat"), lng: sp.get("lng") });
    return NextResponse.json({ days: await getForecast(lat, lng) }, { headers: { "Cache-Control": "private, max-age=1800" } });
  } catch (e) {
    return apiError(e);
  }
}
