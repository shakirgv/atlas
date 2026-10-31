import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";
import { getRates } from "@/lib/fx";

/** GET /api/fx?base=USD — latest rates (24h cache, last-known fallback). */
export async function GET(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  try {
    const base = z.string().regex(/^[A-Z]{3}$/).parse(new URL(req.url).searchParams.get("base") ?? "USD");
    const rates = await getRates(base);
    if (!rates) return NextResponse.json({ error: "Rates unavailable" }, { status: 503 });
    return NextResponse.json(rates);
  } catch (e) {
    return apiError(e);
  }
}
