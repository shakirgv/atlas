"use client";
import { useEffect, useState } from "react";
import { fetchRates } from "@/actions/expenses";
import type { FxRates } from "@/lib/money";

const memo = new Map<string, FxRates>();

/** Latest FX rates for the base currency (fetched once per session). */
export function useRates(base: string, enabled = true) {
  const [rates, setRates] = useState<FxRates | null>(() => memo.get(base) ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const cached = memo.get(base);
    if (cached) {
      const t = setTimeout(() => setRates(cached), 0);
      return () => clearTimeout(t);
    }
    let alive = true;
    void fetchRates(base).then((res) => {
      if (!alive) return;
      if (res.ok) {
        memo.set(base, res.data);
        setRates(res.data);
        setError(null);
      } else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [base, enabled]);
  return { rates, error };
}
