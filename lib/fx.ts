import "server-only";
import type { FxRates } from "@/lib/money";
import { USER_AGENT } from "@/lib/config";

const lastKnown = new Map<string, FxRates>();

/**
 * Approximate USD-based snapshot (late 2026), used ONLY when the live API and the in-memory
 * last-known rates are both unavailable. The UI labels these as approximate and lets you override.
 */
const SNAPSHOT_PER_USD: Record<string, number> = {"USD": 1, "EUR": 0.92, "GBP": 0.78, "AZN": 1.7, "TRY": 34.5, "JPY": 150, "CHF": 0.88, "CAD": 1.37, "AUD": 1.52, "NZD": 1.66, "CNY": 7.2, "HKD": 7.8, "SGD": 1.34, "KRW": 1380, "THB": 35.5, "VND": 25300, "IDR": 15800, "MYR": 4.6, "PHP": 57, "INR": 84, "AED": 3.67, "SAR": 3.75, "QAR": 3.64, "GEL": 2.72, "RUB": 95, "KZT": 480, "UZS": 12700, "PLN": 4, "CZK": 23.2, "HUF": 365, "RON": 4.6, "BGN": 1.8, "SEK": 10.6, "NOK": 10.8, "DKK": 6.9, "ISK": 138, "MXN": 19.5, "BRL": 5.5, "ARS": 950, "CLP": 930, "COP": 4100, "PEN": 3.75, "ZAR": 18, "EGP": 48.5, "MAD": 9.9, "KES": 129, "TZS": 2700, "ILS": 3.7, "JOD": 0.71, "LKR": 300, "NPR": 134, "TWD": 32};

function snapshotRates(base: string): FxRates | null {
  const b = SNAPSHOT_PER_USD[base];
  if (!b) return null;
  const rates: Record<string, number> = {};
  for (const [code, perUsd] of Object.entries(SNAPSHOT_PER_USD)) rates[code] = perUsd / b;
  return { base, rates, updatedAt: null, stale: true, approximate: true };
}

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
    return cached ? { ...cached, stale: true } : snapshotRates(code);
  }
}
