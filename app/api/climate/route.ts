import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";
import { getClimate } from "@/lib/server/weather";
import { climateKey } from "@/lib/climate";

const Points = z
  .string()
  .max(800)
  .transform((s) => s.split(";").filter(Boolean))
  .pipe(
    z
      .array(
        z
          .string()
          .regex(/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/, "Invalid point")
          .transform((p) => p.split(",").map(Number) as [number, number])
          .refine(([lat, lng]) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180, "Invalid point"),
      )
      .min(1)
      .max(40),
  );

/** GET /api/climate?points=13.8,100.5;64.1,-21.9 — monthly normals per point (null when unavailable). */
export async function GET(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  try {
    const points = Points.parse(new URL(req.url).searchParams.get("points") ?? "");
    const entries = await Promise.all(points.map(async ([lat, lng]) => [climateKey(lat, lng), await getClimate(lat, lng)] as const));
    return NextResponse.json({ results: Object.fromEntries(entries) }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return apiError(e);
  }
}
