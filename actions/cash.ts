"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { effectiveRate, planExchange, planWithdrawal, totalPaid, walletBalance } from "@/lib/cash";
import { round2 } from "@/lib/money";
import { insertFeeExpense, midMarket, walletForCurrency } from "@/lib/server/cash";
import { cashEntrySchema, cashTxPatchSchema, exchangeSchema, walletSchema, withdrawalSchema, type CashEntryInput, type CashTxPatch, type ExchangeInputRaw, type WalletInput, type WithdrawalInputRaw } from "@/lib/validation";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

export type WalletOption = { id: string; currency: string; label: string | null; balance: number };

/** For the expense form: wallets with their current balance (to warn before going negative). */
export async function listWalletOptions(): Promise<ActionResult<WalletOption[]>> {
  try {
    const { supabase } = await requireUser();
    const [wallets, txs] = await Promise.all([supabase.from("cash_wallets").select("id, currency, label").order("created_at"), supabase.from("cash_transactions").select("wallet_id, amount")]);
    return ok(must(wallets).map((w) => ({ ...w, balance: walletBalance(must(txs).filter((t) => t.wallet_id === w.id)) })));
  } catch (e) {
    return fail(e);
  }
}

export async function createWallet(input: WalletInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, user } = await requireUser();
    const d = walletSchema.parse(input);
    const { data: existing } = await supabase.from("cash_wallets").select("id").eq("currency", d.currency).maybeSingle();
    if (existing) throw new Error(`You already have a ${d.currency} wallet.`);
    const row = must(await supabase.from("cash_wallets").insert({ user_id: user.id, ...d }).select("id").single());
    refreshAll();
    return ok({ id: row.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateWallet(id: string, input: Pick<WalletInput, "label" | "low_balance_alert">): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const d = walletSchema.pick({ label: true, low_balance_alert: true }).parse(input);
    must(await supabase.from("cash_wallets").update(d).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Transactions go with the wallet. Expenses stay, because that money was still spent. */
export async function deleteWallet(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("cash_wallets").delete().eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function recordWithdrawal(input: WithdrawalInputRaw): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const d = withdrawalSchema.parse(input);
    const wallet = must(await supabase.from("cash_wallets").select("currency").eq("id", d.wallet_id).single());
    const mid = await midMarket(wallet.currency, d.charged_currency);
    const plan = planWithdrawal(
      {
        walletId: d.wallet_id,
        walletCurrency: wallet.currency,
        date: d.date,
        received: d.received,
        charged: d.charged,
        chargedCurrency: d.charged_currency,
        fee: d.fee,
        feeCurrency: d.fee_currency,
        note: d.note,
        tripId: d.trip_id,
        tripCountryId: d.trip_country_id,
      },
      mid,
    );
    const feeId = await insertFeeExpense(supabase, plan.feeExpense);
    const { error } = await supabase.from("cash_transactions").insert({ ...plan.tx, fee_expense_id: feeId });
    if (error) {
      // Never leave a fee behind without its withdrawal.
      if (feeId) await supabase.from("expenses").delete().eq("id", feeId);
      throw new Error(error.message);
    }
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function recordExchange(input: ExchangeInputRaw): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const d = exchangeSchema.parse(input);
    const from = must(await supabase.from("cash_wallets").select("currency").eq("id", d.from_wallet_id).single());
    const toWalletId = await walletForCurrency(supabase, user.id, d.to_currency);
    const mid = await midMarket(d.to_currency, from.currency);
    const plan = planExchange(
      {
        fromWalletId: d.from_wallet_id,
        fromCurrency: from.currency,
        fromAmount: d.from_amount,
        toWalletId,
        toCurrency: d.to_currency,
        toAmount: d.to_amount,
        date: d.date,
        fee: d.fee,
        feeCurrency: d.fee_currency,
        note: d.note,
        tripId: d.trip_id,
        tripCountryId: d.trip_country_id,
      },
      mid,
    );
    const feeId = await insertFeeExpense(supabase, plan.feeExpense);
    try {
      const out = must(await supabase.from("cash_transactions").insert({ ...plan.out, fee_expense_id: feeId }).select("id").single());
      const incoming = must(await supabase.from("cash_transactions").insert({ ...plan.in, linked_transaction_id: out.id }).select("id").single());
      must(await supabase.from("cash_transactions").update({ linked_transaction_id: incoming.id }).eq("id", out.id));
    } catch (e) {
      if (feeId) await supabase.from("expenses").delete().eq("id", feeId);
      throw e;
    }
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Money received, or a correction to what I counted. `amount` is signed for adjustments. */
export async function recordCashEntry(input: CashEntryInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const d = cashEntrySchema.parse(input);
    if (d.type === "received" && d.amount <= 0) throw new Error("Enter the amount you received.");
    must(await supabase.from("cash_transactions").insert({ wallet_id: d.wallet_id, type: d.type, date: d.date, amount: round2(d.amount), note: d.note }));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Inline edit. Linked records follow: a spend updates its expense, an exchange its other side's rate. */
export async function updateCashTransaction(id: string, patch: CashTxPatch): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const txId = z.uuid().parse(id);
    const d = cashTxPatchSchema.parse(patch);
    const tx = must(await supabase.from("cash_transactions").select("*").eq("id", txId).single());
    const update: { date?: string; note?: string | null; amount?: number; effective_rate?: number | null } = {};
    if (d.date !== undefined) update.date = d.date;
    if (d.note !== undefined) update.note = d.note;

    if (d.amount !== undefined) {
      const size = round2(Math.abs(d.amount));
      if (tx.type === "spend" || tx.type === "exchange_out") update.amount = -size;
      else if (tx.type === "adjustment") update.amount = round2(d.amount);
      else update.amount = size;
      if (tx.type !== "adjustment" && !size) throw new Error("Enter an amount.");

      if (tx.type === "withdrawal" && tx.counter_amount && tx.counter_currency) {
        const wallet = must(await supabase.from("cash_wallets").select("currency").eq("id", tx.wallet_id).single());
        const paid = totalPaid({ paid: Number(tx.counter_amount), paidCurrency: tx.counter_currency, receivedCurrency: wallet.currency, fee: tx.fee_amount ? Number(tx.fee_amount) : null, feeCurrency: tx.fee_currency, mid: tx.mid_market_rate ? Number(tx.mid_market_rate) : null });
        update.effective_rate = effectiveRate(paid, size);
      }
      if ((tx.type === "exchange_in" || tx.type === "exchange_out") && tx.linked_transaction_id) {
        const paid = tx.type === "exchange_out" ? size : Number(tx.counter_amount);
        const got = tx.type === "exchange_in" ? size : Number(tx.counter_amount);
        const rate = effectiveRate(paid, got);
        update.effective_rate = rate;
        must(await supabase.from("cash_transactions").update({ counter_amount: size, effective_rate: rate }).eq("id", tx.linked_transaction_id));
      }
      if (tx.type === "spend" && tx.expense_id) {
        const expense = must(await supabase.from("expenses").select("fx_rate").eq("id", tx.expense_id).single());
        must(await supabase.from("expenses").update({ amount: size, amount_base: round2(size * Number(expense.fx_rate)) }).eq("id", tx.expense_id));
      }
    }
    if (tx.type === "spend" && tx.expense_id && d.date !== undefined) {
      must(await supabase.from("expenses").update({ date: d.date }).eq("id", tx.expense_id));
    }
    if (tx.linked_transaction_id && d.date !== undefined) {
      must(await supabase.from("cash_transactions").update({ date: d.date }).eq("id", tx.linked_transaction_id));
    }
    must(await supabase.from("cash_transactions").update(update).eq("id", txId));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Removes a transaction with everything tied to it: the other side of an exchange, its fee, or a spend's expense. */
export async function deleteCashTransaction(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const txId = z.uuid().parse(id);
    const tx = must(await supabase.from("cash_transactions").select("id, linked_transaction_id, expense_id, fee_expense_id").eq("id", txId).single());
    const linked = tx.linked_transaction_id ? must(await supabase.from("cash_transactions").select("id, fee_expense_id").eq("id", tx.linked_transaction_id).maybeSingle()) : null;
    const expenseIds = [tx.expense_id, tx.fee_expense_id, linked?.fee_expense_id].filter((x): x is string => Boolean(x));
    must(await supabase.from("cash_transactions").delete().in("id", [tx.id, ...(linked ? [linked.id] : [])]));
    if (expenseIds.length) must(await supabase.from("expenses").delete().in("id", expenseIds));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
