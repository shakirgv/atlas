import "server-only";
import { getRates } from "@/lib/fx";
import { planSpend, summarizeCash } from "@/lib/cash";
import { rateToBase, round2 } from "@/lib/money";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { CashTransaction, CashWallet } from "@/lib/types";

/** Wallets, transactions and totals. Empty, not an error, when migration 003 has not been applied. */
export async function loadCash(supabase: ServerSupabase, baseCurrency: string) {
  const [{ data: wallets }, { data: txs }] = await Promise.all([
    supabase.from("cash_wallets").select("*").order("created_at"),
    supabase.from("cash_transactions").select("*"),
  ]);
  const list = (wallets ?? []) as CashWallet[];
  const transactions = (txs ?? []) as CashTransaction[];
  const feeIds = transactions.flatMap((t) => (t.fee_expense_id ? [t.fee_expense_id] : []));
  const [fees, rates] = await Promise.all([
    feeIds.length ? supabase.from("expenses").select("amount_base").in("id", feeIds) : Promise.resolve({ data: [] as { amount_base: number }[] }),
    list.length ? getRates(baseCurrency) : Promise.resolve(null),
  ]);
  const feesPaid = (fees.data ?? []).reduce((sum, e) => sum + Number(e.amount_base), 0);
  return summarizeCash(list, transactions, { rates, baseCurrency, feesPaid });
}

/** Mid-market price of one `unit` in `pay`, or null when no rate is available. */
export async function midMarket(unit: string, pay: string) {
  if (unit === pay) return 1;
  return rateToBase(await getRates(pay), unit);
}

/** Inserts a fee as a normal expense, converted to the base currency like any other. */
export async function insertFeeExpense(
  supabase: ServerSupabase,
  plan: { title: string; category: "fees"; kind: "actual"; payment_method: "card"; amount: number; currency: string; date: string; trip_id: string; trip_country_id: string | null } | null,
) {
  if (!plan) return null;
  const { data: settings } = await supabase.from("settings").select("base_currency").maybeSingle();
  const base = settings?.base_currency ?? "USD";
  const rate = plan.currency === base ? 1 : rateToBase(await getRates(base), plan.currency);
  if (!rate) throw new Error(`No exchange rate for ${plan.currency}. Enter the fee in ${base}.`);
  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...plan, fx_rate: rate, amount_base: round2(plan.amount * rate) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** The wallet for a currency, created on first use. */
export async function walletForCurrency(supabase: ServerSupabase, userId: string, currency: string) {
  const { data: existing } = await supabase.from("cash_wallets").select("id").eq("currency", currency).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase.from("cash_wallets").insert({ user_id: userId, currency }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Keeps an expense and its spend transaction in step: creates, updates, moves or removes the
 * transaction so the wallet always matches what the expense says. Call after saving an expense.
 */
export async function syncExpenseSpend(supabase: ServerSupabase, expense: { id: string; payment_method: string; wallet_id: string | null; kind: string; amount: number; date: string; title: string | null }) {
  const plan = planSpend(expense);
  const { data: existing } = await supabase.from("cash_transactions").select("id").eq("expense_id", expense.id).eq("type", "spend").maybeSingle();
  const { error } = plan
    ? existing
      ? await supabase.from("cash_transactions").update(plan).eq("id", existing.id)
      : await supabase.from("cash_transactions").insert(plan)
    : existing
      ? await supabase.from("cash_transactions").delete().eq("id", existing.id)
      : { error: null };
  if (error) throw new Error(error.message);
}
