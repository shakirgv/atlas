import "server-only";
import type { FxRates } from "@/lib/money";
import { USER_AGENT } from "@/lib/config";

const lastKnown = new Map<string, FxRates>();

/**
 * Latest exchange rates for `base` from open.er-api.com (cached for 24h by Next).
 * Falls back to the last known rates in memory; returns null if never fetched.
 */
export async function getRates(base: string): Promise<FxRates | null> {
  const code = base.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${code}`, {
      next: { revalidate: 86400 },
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`FX ${res.status}`);
    const json = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (json.result !== "success" || !json.rates) throw new Error("FX payload");
    const rates: FxRates = { base: code, rates: json.rates, updatedAt: json.time_last_update_utc ?? null, stale: false };
    lastKnown.set(code, rates);
    return rates;
  } catch {
    const cached = lastKnown.get(code);
    return cached ? { ...cached, stale: true } : null;
  }
}
