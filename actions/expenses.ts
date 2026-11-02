"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { expenseSchema, type ExpenseInput } from "@/lib/validation";
import { round2 } from "@/lib/money";
import { getRates } from "@/lib/fx";
import { syncExpenseSpend, walletForCurrency } from "@/lib/server/cash";
import { cleanupEntityPhotos } from "@/lib/storage";
import type { ServerSupabase } from "@/lib/supabase/server";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { FxRatesResult } from "@/lib/action-types";
import type { ActionResult } from "@/lib/types";

/** A cash payment needs a wallet in the expense's currency: the chosen one, or one created for it. */
async function resolveWallet(supabase: ServerSupabase, userId: string, d: { payment_method: string; wallet_id: string | null; currency: string }) {
  if (d.payment_method !== "cash") return null;
  if (!d.wallet_id) return walletForCurrency(supabase, userId, d.currency);
  const wallet = must(await supabase.from("cash_wallets").select("currency").eq("id", d.wallet_id).single());
  if (wallet.currency !== d.currency) throw new Error(`Pick a ${d.currency} wallet for a ${d.currency} expense.`);
  return d.wallet_id;
}

export async function createExpense(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, user } = await requireUser();
    const d = expenseSchema.parse(input);
    const wallet_id = await resolveWallet(supabase, user.id, d);
    const amount = round2(d.amount);
    const row = must(
      await supabase
        .from("expenses")
        .insert({ ...d, wallet_id, amount, amount_base: round2(d.amount * d.fx_rate) })
        .select("id")
        .single(),
    );
    await syncExpenseSpend(supabase, { id: row.id, payment_method: d.payment_method, wallet_id, kind: d.kind, amount, date: d.date, title: d.title });
    refreshAll();
    return ok({ id: row.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const d = expenseSchema.parse(input);
    const expenseId = z.uuid().parse(id);
    const wallet_id = await resolveWallet(supabase, user.id, d);
    const amount = round2(d.amount);
    must(
      await supabase
        .from("expenses")
        .update({ ...d, wallet_id, amount, amount_base: round2(d.amount * d.fx_rate) })
        .eq("id", expenseId),
    );
    await syncExpenseSpend(supabase, { id: expenseId, payment_method: d.payment_method, wallet_id, kind: d.kind, amount, date: d.date, title: d.title });
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const expenseId = z.uuid().parse(id);
    // The spend goes with its expense, so the wallet gets the money back. A deleted fee no longer shows on its withdrawal.
    must(await supabase.from("cash_transactions").delete().eq("expense_id", expenseId).eq("type", "spend"));
    must(await supabase.from("cash_transactions").update({ fee_amount: null, fee_currency: null }).eq("fee_expense_id", expenseId));
    must(await supabase.from("expenses").delete().eq("id", expenseId));
    await cleanupEntityPhotos(supabase, [expenseId]);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Latest rates for the client's live "≈ $12.40" preview. */
export async function fetchRates(base: string): Promise<FxRatesResult> {
  try {
    await requireUser();
    const rates = await getRates(z.string().regex(/^[A-Z]{3}$/).parse(base));
    return rates ? { ok: true, data: rates } : { ok: false, error: "Exchange rates are unavailable. Enter a manual rate." };
  } catch (e) {
    return fail(e);
  }
}
