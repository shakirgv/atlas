import { rateToBase, round2, type FxRates } from "@/lib/money";
import type { CashTransaction, CashTxType, CashWallet } from "@/lib/types";

/** Rate precision kept in the database: numeric(18, 8). */
const round8 = (n: number) => Math.round(n * 1e8) / 1e8;

export const CASH_TX_META: Record<CashTxType, { label: string }> = {
  withdrawal: { label: "ATM withdrawal" },
  exchange_in: { label: "Exchange in" },
  exchange_out: { label: "Exchange out" },
  spend: { label: "Spend" },
  received: { label: "Received" },
  adjustment: { label: "Adjustment" },
};

/** Balance = sum of signed transaction amounts, in the wallet's currency. */
export function walletBalance(txs: { amount: number | string }[]) {
  return round2(txs.reduce((sum, t) => sum + Number(t.amount), 0));
}

/** Units of the paying currency per one unit received. */
export function effectiveRate(paid: number, received: number) {
  return received > 0 && paid > 0 ? round8(paid / received) : null;
}

/** Percent paid above the mid-market rate (negative means better than mid-market). */
export function costOverMid(effective: number | null | undefined, mid: number | null | undefined) {
  return effective && mid ? Math.round((effective / mid - 1) * 1000) / 10 : null;
}

/** Everything the cash cost me in the paying currency. A fee in the received currency converts at mid-market. */
export function totalPaid(i: { paid: number; paidCurrency: string; receivedCurrency: string; fee?: number | null; feeCurrency?: string | null; mid?: number | null }) {
  const fee = i.fee ?? 0;
  if (!fee) return i.paid;
  if (i.feeCurrency === i.paidCurrency) return round2(i.paid + fee);
  if (i.feeCurrency === i.receivedCurrency && i.mid) return round2(i.paid + fee * i.mid);
  return i.paid;
}

/** "You paid 2.8% over the mid-market rate." */
export function costSentence(pct: number | null) {
  if (pct === null) return null;
  if (Math.abs(pct) < 0.05) return "You paid about the mid-market rate.";
  return pct > 0 ? `You paid ${pct}% over the mid-market rate.` : `You paid ${Math.abs(pct)}% under the mid-market rate.`;
}

type FeeInput = { fee?: number | null; feeCurrency?: string | null; date: string; tripId?: string | null; tripCountryId?: string | null; title: string };
export type FeeExpensePlan = { title: string; category: "fees"; kind: "actual"; payment_method: "card"; amount: number; currency: string; date: string; trip_id: string; trip_country_id: string | null };

function planFee(i: FeeInput): FeeExpensePlan | null {
  if (!i.fee || i.fee <= 0) return null;
  if (!i.feeCurrency) throw new Error("Pick a currency for the fee.");
  if (!i.tripId) throw new Error("Pick a trip so the fee can be recorded as an expense.");
  return { title: i.title, category: "fees", kind: "actual", payment_method: "card", amount: round2(i.fee), currency: i.feeCurrency, date: i.date, trip_id: i.tripId, trip_country_id: i.tripCountryId ?? null };
}

export type WithdrawalInput = {
  walletId: string;
  walletCurrency: string;
  date: string;
  received: number;
  charged: number;
  chargedCurrency: string;
  fee?: number | null;
  feeCurrency?: string | null;
  note?: string | null;
  tripId?: string | null;
  tripCountryId?: string | null;
};

/**
 * Getting cash is not an expense: only a fee becomes one (spending the cash is the expense).
 * `mid` is the mid-market price of one wallet unit in the card currency.
 */
export function planWithdrawal(i: WithdrawalInput, mid: number | null) {
  const paid = totalPaid({ paid: i.charged, paidCurrency: i.chargedCurrency, receivedCurrency: i.walletCurrency, fee: i.fee, feeCurrency: i.feeCurrency, mid });
  return {
    tx: {
      wallet_id: i.walletId,
      type: "withdrawal" as const,
      date: i.date,
      amount: round2(i.received),
      counter_amount: round2(i.charged),
      counter_currency: i.chargedCurrency,
      fee_amount: i.fee ? round2(i.fee) : null,
      fee_currency: i.fee ? (i.feeCurrency ?? null) : null,
      effective_rate: effectiveRate(paid, i.received),
      mid_market_rate: mid ? round8(mid) : null,
      note: i.note ?? null,
    },
    feeExpense: planFee({ ...i, title: "ATM fee" }),
  };
}

export type ExchangeInput = {
  fromWalletId: string;
  fromCurrency: string;
  fromAmount: number;
  toWalletId: string;
  toCurrency: string;
  toAmount: number;
  date: string;
  fee?: number | null;
  feeCurrency?: string | null;
  note?: string | null;
  tripId?: string | null;
  tripCountryId?: string | null;
};

/** A linked pair (money moves between wallets, no expense). `mid` prices one "to" unit in the "from" currency. */
export function planExchange(i: ExchangeInput, mid: number | null) {
  if (i.fromWalletId === i.toWalletId) throw new Error("Pick two different wallets.");
  const paid = totalPaid({ paid: i.fromAmount, paidCurrency: i.fromCurrency, receivedCurrency: i.toCurrency, fee: i.fee, feeCurrency: i.feeCurrency, mid });
  const shared = { date: i.date, effective_rate: effectiveRate(paid, i.toAmount), mid_market_rate: mid ? round8(mid) : null, note: i.note ?? null };
  return {
    out: {
      ...shared,
      wallet_id: i.fromWalletId,
      type: "exchange_out" as const,
      amount: -round2(i.fromAmount),
      counter_amount: round2(i.toAmount),
      counter_currency: i.toCurrency,
      fee_amount: i.fee ? round2(i.fee) : null,
      fee_currency: i.fee ? (i.feeCurrency ?? null) : null,
    },
    in: { ...shared, wallet_id: i.toWalletId, type: "exchange_in" as const, amount: round2(i.toAmount), counter_amount: round2(i.fromAmount), counter_currency: i.fromCurrency },
    feeExpense: planFee({ ...i, title: "Exchange fee" }),
  };
}

type ExpenseLike = { id: string; payment_method?: string | null; wallet_id?: string | null; kind: string; amount: number | string; date: string; title?: string | null };

/**
 * The spend transaction an expense should have: spending cash takes it out of the wallet, once.
 * A planned expense hasn't happened yet and a card payment never touches cash, so both give null.
 */
export function planSpend(e: ExpenseLike) {
  if (e.payment_method !== "cash" || !e.wallet_id || e.kind !== "actual") return null;
  return { wallet_id: e.wallet_id, type: "spend" as const, date: e.date, amount: -round2(Number(e.amount)), expense_id: e.id, note: e.title ?? null };
}

export type WalletView = CashWallet & { balance: number; lastActivity: string | null; low: boolean; baseValue: number | null; transactions: CashTransaction[] };

export type CashSummary = {
  wallets: WalletView[];
  /** Sum of every convertible wallet, in the base currency. */
  cashOnHand: number;
  /** Currencies left out of `cashOnHand` because no rate was available. */
  unconverted: string[];
  feesPaid: number;
};

export function summarizeCash(wallets: CashWallet[], txs: CashTransaction[], ctx: { rates: FxRates | null; baseCurrency: string; feesPaid: number }): CashSummary {
  const views = wallets.map((w) => {
    const transactions = txs.filter((t) => t.wallet_id === w.id).sort((a, b) => b.date.localeCompare(a.date, "en") || b.created_at.localeCompare(a.created_at, "en"));
    const balance = walletBalance(transactions);
    const rate = w.currency === ctx.baseCurrency ? 1 : rateToBase(ctx.rates, w.currency);
    return {
      ...w,
      transactions,
      balance,
      lastActivity: transactions[0]?.date ?? null,
      low: w.low_balance_alert != null && balance < Number(w.low_balance_alert),
      baseValue: rate ? round2(balance * rate) : null,
    };
  });
  return {
    wallets: views,
    cashOnHand: round2(views.reduce((sum, w) => sum + (w.baseValue ?? 0), 0)),
    unconverted: views.filter((w) => w.baseValue === null && w.balance !== 0).map((w) => w.currency),
    feesPaid: round2(ctx.feesPaid),
  };
}
