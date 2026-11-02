import { describe, expect, it } from "vitest";
import { costOverMid, costSentence, effectiveRate, planExchange, planSpend, planWithdrawal, summarizeCash, totalPaid, walletBalance } from "@/lib/cash";
import { expenseSchema, exchangeSchema, withdrawalSchema } from "@/lib/validation";
import type { CashTransaction, CashWallet } from "@/lib/types";

const withdraw = { walletId: "jpy", walletCurrency: "JPY", date: "2027-03-14", received: 20000, charged: 150, chargedCurrency: "USD", fee: 5, feeCurrency: "USD", tripId: "trip" };

describe("spec scenario: withdraw 20,000 JPY for 150 USD with a 5 USD fee, then spend 3,500 JPY", () => {
  const plan = planWithdrawal(withdraw, 0.0074);
  const spend = planSpend({ id: "exp", payment_method: "cash", wallet_id: "jpy", kind: "actual", amount: 3500, date: "2027-03-14", title: "Ramen" })!;

  it("leaves 16,500 JPY in the wallet", () => {
    expect(walletBalance([plan.tx, spend])).toBe(16500);
  });

  it("creates a 5 USD fee expense and no expense for the cash itself", () => {
    expect(plan.feeExpense).toMatchObject({ category: "fees", kind: "actual", amount: 5, currency: "USD", trip_id: "trip" });
    expect(Object.keys(plan)).toEqual(["tx", "feeExpense"]);
    expect(plan.tx).not.toHaveProperty("expense_id");
  });

  it("links the spend to its expense, once", () => {
    expect(spend).toMatchObject({ type: "spend", amount: -3500, expense_id: "exp", wallet_id: "jpy" });
  });

  it("stores what the cash really cost, fee included", () => {
    expect(plan.tx.effective_rate).toBe(0.00775);
    expect(costOverMid(plan.tx.effective_rate, plan.tx.mid_market_rate)).toBe(4.7);
  });
});

describe("double counting rules", () => {
  it("records no fee expense without a fee", () => {
    expect(planWithdrawal({ ...withdraw, fee: null }, 0.0074).feeExpense).toBeNull();
    expect(planWithdrawal({ ...withdraw, fee: 0 }, 0.0074).feeExpense).toBeNull();
  });

  it("needs a trip only when there is a fee to record", () => {
    expect(() => planWithdrawal({ ...withdraw, tripId: null }, null)).toThrow(/trip/i);
    expect(planWithdrawal({ ...withdraw, fee: null, tripId: null }, null).feeExpense).toBeNull();
  });

  it("takes cash out only for money actually spent in cash", () => {
    const base = { id: "e", wallet_id: "w", amount: 10, date: "2027-01-01" };
    expect(planSpend({ ...base, payment_method: "cash", kind: "actual" })).not.toBeNull();
    expect(planSpend({ ...base, payment_method: "card", kind: "actual" })).toBeNull();
    expect(planSpend({ ...base, payment_method: "other", kind: "actual" })).toBeNull();
    expect(planSpend({ ...base, payment_method: "cash", kind: "planned" })).toBeNull();
    expect(planSpend({ ...base, wallet_id: null, payment_method: "cash", kind: "actual" })).toBeNull();
  });
});

describe("exchange", () => {
  const input = { fromWalletId: "eur", fromCurrency: "EUR", fromAmount: 100, toWalletId: "jpy", toCurrency: "JPY", toAmount: 16000, date: "2027-03-14", fee: 2, feeCurrency: "EUR", tripId: "trip" };

  it("moves money between wallets with opposite signs", () => {
    const p = planExchange(input, 0.006);
    expect(p.out).toMatchObject({ wallet_id: "eur", type: "exchange_out", amount: -100, counter_amount: 16000, counter_currency: "JPY", fee_amount: 2 });
    expect(p.in).toMatchObject({ wallet_id: "jpy", type: "exchange_in", amount: 16000, counter_amount: 100, counter_currency: "EUR" });
    expect(p.in).not.toHaveProperty("fee_amount");
  });

  it("makes only the fee an expense, and counts it in the rate", () => {
    const p = planExchange(input, 0.006);
    expect(p.feeExpense).toMatchObject({ title: "Exchange fee", amount: 2, currency: "EUR", category: "fees" });
    expect(p.out.effective_rate).toBe(0.006375);
    expect(costOverMid(p.out.effective_rate, 0.006)).toBe(6.3);
  });

  it("refuses the same wallet on both sides", () => {
    expect(() => planExchange({ ...input, toWalletId: "eur" }, null)).toThrow(/different/i);
  });
});

describe("rates and fees", () => {
  it("computes the effective rate", () => {
    expect(effectiveRate(150, 20000)).toBe(0.0075);
    expect(effectiveRate(0, 20000)).toBeNull();
    expect(effectiveRate(150, 0)).toBeNull();
  });

  it("adds a fee in either currency, and ignores one it can't convert", () => {
    const base = { paid: 150, paidCurrency: "USD", receivedCurrency: "JPY", mid: 0.0075 };
    expect(totalPaid({ ...base, fee: 5, feeCurrency: "USD" })).toBe(155);
    expect(totalPaid({ ...base, fee: 220, feeCurrency: "JPY" })).toBe(151.65);
    expect(totalPaid({ ...base, fee: 5, feeCurrency: "EUR" })).toBe(150);
    expect(totalPaid({ ...base, fee: 220, feeCurrency: "JPY", mid: null })).toBe(150);
    expect(totalPaid({ ...base })).toBe(150);
  });

  it("reports cost against mid-market", () => {
    expect(costOverMid(0.00771, 0.0075)).toBe(2.8);
    expect(costOverMid(0.0074, 0.0075)).toBe(-1.3);
    expect(costOverMid(null, 0.0075)).toBeNull();
    expect(costOverMid(0.0075, null)).toBeNull();
    expect(costSentence(2.8)).toBe("You paid 2.8% over the mid-market rate.");
    expect(costSentence(-1.3)).toBe("You paid 1.3% under the mid-market rate.");
    expect(costSentence(0)).toBe("You paid about the mid-market rate.");
    expect(costSentence(null)).toBeNull();
  });
});

describe("summary", () => {
  const wallet = (id: string, currency: string, low: number | null = null) => ({ id, currency, label: null, low_balance_alert: low, user_id: "u", created_at: "" }) as CashWallet;
  const tx = (wallet_id: string, amount: number, date = "2027-01-01") => ({ wallet_id, amount, date, created_at: date }) as CashTransaction;
  const rates = { base: "USD", rates: { JPY: 100, EUR: 0.5 }, updatedAt: null, stale: false };

  it("converts balances to the base currency and totals them", () => {
    const s = summarizeCash([wallet("a", "JPY"), wallet("b", "USD")], [tx("a", 1000), tx("b", 20)], { rates, baseCurrency: "USD", feesPaid: 5 });
    expect(s.wallets[0]).toMatchObject({ balance: 1000, baseValue: 10 });
    expect(s.cashOnHand).toBe(30);
    expect(s.feesPaid).toBe(5);
    expect(s.unconverted).toEqual([]);
  });

  it("names currencies it could not convert instead of guessing", () => {
    const s = summarizeCash([wallet("a", "XYZ"), wallet("b", "USD")], [tx("a", 10), tx("b", 20)], { rates, baseCurrency: "USD", feesPaid: 0 });
    expect(s.cashOnHand).toBe(20);
    expect(s.unconverted).toEqual(["XYZ"]);
    expect(summarizeCash([wallet("b", "USD")], [tx("b", 20)], { rates: null, baseCurrency: "USD", feesPaid: 0 }).cashOnHand).toBe(20);
  });

  it("flags a low balance and tracks the last activity", () => {
    const s = summarizeCash([wallet("a", "USD", 50)], [tx("a", 60, "2027-01-01"), tx("a", -20, "2027-02-01")], { rates, baseCurrency: "USD", feesPaid: 0 });
    expect(s.wallets[0]).toMatchObject({ balance: 40, low: true, lastActivity: "2027-02-01" });
    expect(s.wallets[0]!.transactions[0]!.date).toBe("2027-02-01");
  });

  it("allows a negative balance (warned about, not blocked)", () => {
    expect(walletBalance([tx("a", 10), tx("a", -25)])).toBe(-15);
  });
});

describe("validation", () => {
  const expense = { trip_id: "11111111-1111-4111-8111-111111111111", date: "2027-01-01", category: "food", kind: "actual", amount: 10, currency: "EUR", fx_rate: 1 };

  it("defaults an expense to card", () => {
    expect(expenseSchema.parse(expense)).toMatchObject({ payment_method: "card", wallet_id: null });
    expect(() => expenseSchema.parse({ ...expense, payment_method: "crypto" })).toThrow();
  });

  it("accepts the new fees category", () => {
    expect(expenseSchema.parse({ ...expense, category: "fees" }).category).toBe("fees");
  });

  it("requires positive amounts on cash forms", () => {
    const w = { wallet_id: "11111111-1111-4111-8111-111111111111", date: "2027-01-01", received: 100, charged: 2, charged_currency: "USD" };
    expect(withdrawalSchema.parse(w).received).toBe(100);
    expect(() => withdrawalSchema.parse({ ...w, received: 0 })).toThrow();
    expect(() => withdrawalSchema.parse({ ...w, charged: -1 })).toThrow();
    expect(() => withdrawalSchema.parse({ ...w, fee: -1 })).toThrow();
    const x = { from_wallet_id: w.wallet_id, from_amount: 1, to_currency: "JPY", to_amount: 160, date: "2027-01-01" };
    expect(exchangeSchema.parse(x).to_currency).toBe("JPY");
    expect(() => exchangeSchema.parse({ ...x, to_currency: "yen" })).toThrow();
  });
});
