import type { ExpenseCategory } from "@/lib/types";

/** Currencies offered in pickers (ISO 4217). AZN included on purpose. */
export const CURRENCIES = [
  "USD", "EUR", "GBP", "AZN", "TRY", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "HKD", "SGD", "KRW",
  "THB", "VND", "IDR", "MYR", "PHP", "INR", "AED", "SAR", "QAR", "GEL", "RUB", "KZT", "UZS", "PLN",
  "CZK", "HUF", "RON", "BGN", "SEK", "NOK", "DKK", "ISK", "MXN", "BRL", "ARS", "CLP", "COP", "PEN",
  "ZAR", "EGP", "MAD", "KES", "TZS", "ILS", "JOD", "LKR", "NPR", "TWD",
] as const;

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number | null | undefined, currency = "USD", opts: { compact?: boolean; decimals?: number } = {}) {
  const value = Number(amount ?? 0);
  const digits = opts.decimals ?? (opts.compact ? 1 : Math.abs(value) >= 1000 ? 0 : 2);
  const key = `${currency}-${opts.compact ? "c" : "f"}-${digits}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: opts.compact ? "compact" : "standard",
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
      });
    } catch {
      f = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
    }
    formatters.set(key, f);
  }
  return f.format(value);
}

export function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type FxRates = { base: string; rates: Record<string, number>; updatedAt: string | null; stale: boolean; approximate?: boolean };

/** Rate that converts 1 unit of `currency` into the base currency. */
export function rateToBase(rates: FxRates | null, currency: string): number | null {
  if (!rates) return null;
  if (currency === rates.base) return 1;
  const r = rates.rates[currency];
  if (!r) return null;
  return 1 / r;
}

export const EXPENSE_CATEGORY_META: Record<ExpenseCategory, { label: string; color: string }> = {
  flights: { label: "Flights", color: "#7C8DB5" },
  accommodation: { label: "Accommodation", color: "#0E7C7B" },
  food: { label: "Food", color: "#E8532F" },
  transport: { label: "Transport", color: "#F2A93B" },
  activities: { label: "Activities", color: "#2CC4B8" },
  shopping: { label: "Shopping", color: "#C46A9A" },
  visa: { label: "Visa", color: "#8A6E4B" },
  insurance: { label: "Insurance", color: "#5A6B8C" },
  fees: { label: "Fees", color: "#B0654A" },
  other: { label: "Other", color: "#9AA0A8" },
};
