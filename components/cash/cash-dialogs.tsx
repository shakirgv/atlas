"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWallet, recordCashEntry, recordExchange, recordWithdrawal, updateWallet } from "@/actions/cash";
import { costOverMid, costSentence, effectiveRate, totalPaid, type WalletView } from "@/lib/cash";
import { todayIso } from "@/lib/dates";
import { CURRENCIES, formatMoney, rateToBase } from "@/lib/money";
import { useRates } from "@/hooks/use-rates";
import { SubmitButton } from "@/components/forms/form-bits";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

export type TripOpt = { id: string; title: string };

const num = (s: string) => Number(s.replace(",", ".")) || 0;

function CurrencySelect({ id, value, onChange, label }: { id?: string; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {(CURRENCIES as readonly string[]).includes(value) ? null : <option value={value}>{value}</option>}
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </NativeSelect>
  );
}

function TripField({ trips, value, onChange, needed }: { trips: TripOpt[]; value: string; onChange: (v: string) => void; needed: boolean }) {
  if (!needed) return null;
  return (
    <Field label="Trip for the fee" htmlFor="cash-trip" hint="The fee is recorded as an expense on this trip.">
      <NativeSelect id="cash-trip" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Pick a trip</option>
        {trips.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

/** Effective rate against mid-market, updated as I type. */
function RateNote({ paid, paidCurrency, received, receivedCurrency, fee, feeCurrency }: { paid: number; paidCurrency: string; received: number; receivedCurrency: string; fee: number; feeCurrency: string }) {
  const { rates } = useRates(paidCurrency, paidCurrency !== receivedCurrency);
  const mid = rateToBase(rates, receivedCurrency);
  const effective = effectiveRate(totalPaid({ paid, paidCurrency, receivedCurrency, fee, feeCurrency, mid }), received);
  if (!effective) return null;
  const sentence = costSentence(costOverMid(effective, mid));
  return (
    <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
      <span className="num">
        1 {paidCurrency} = {(1 / effective).toFixed(1 / effective < 10 ? 4 : 2)} {receivedCurrency}
      </span>
      <span className="text-muted"> {fee > 0 ? "with the fee" : "effective rate"}</span>
      <br />
      <span className={sentence ? "font-medium" : "text-muted"}>{sentence ?? "No mid-market rate to compare with right now."}</span>
      {sentence && rates?.approximate && <span className="text-muted"> Compared with an approximate rate.</span>}
    </p>
  );
}

type Common = { open: boolean; onOpenChange: (o: boolean) => void };

function Shell({ open, onOpenChange, title, description, formId, pending, submit, children }: Common & { title: string; description?: string; formId: string; pending: boolean; submit: string; children: React.ReactNode }) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton form={formId} pending={pending}>
            {submit}
          </SubmitButton>
        </>
      }
    >
      {children}
    </ResponsiveDialog>
  );
}

export function WithdrawDialog({ wallet, baseCurrency, trips, defaultTripId, ...common }: Common & { wallet: WalletView; baseCurrency: string; trips: TripOpt[]; defaultTripId: string | null }) {
  const [pending, start] = useTransition();
  const [received, setReceived] = useState("");
  const [charged, setCharged] = useState("");
  const [cardCurrency, setCardCurrency] = useState(baseCurrency);
  const [fee, setFee] = useState("");
  const [feeCurrency, setFeeCurrency] = useState(baseCurrency);
  const [date, setDate] = useState(todayIso());
  const [tripId, setTripId] = useState(defaultTripId ?? "");
  const hasFee = num(fee) > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await recordWithdrawal({ wallet_id: wallet.id, date, received, charged, charged_currency: cardCurrency, fee, fee_currency: hasFee ? feeCurrency : null, trip_id: hasFee ? tripId : null });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Added ${formatMoney(num(received), wallet.currency)} to your wallet`);
      common.onOpenChange(false);
    });
  };

  return (
    <Shell {...common} title={`Withdraw ${wallet.currency}`} description="Getting cash isn't an expense. Only the fee is, and spending the cash later." formId="withdraw-form" pending={pending} submit="Save withdrawal">
      <form id="withdraw-form" onSubmit={submit} className="flex flex-col gap-4 pb-2">
        <Field label={`Cash received (${wallet.currency})`} htmlFor="w-received">
          <Input id="w-received" autoFocus inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="20000" required />
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="Charged on my card" htmlFor="w-charged">
            <Input id="w-charged" inputMode="decimal" value={charged} onChange={(e) => setCharged(e.target.value)} placeholder="150" required />
          </Field>
          <Field label="Currency" htmlFor="w-card-cur">
            <CurrencySelect id="w-card-cur" label="Card currency" value={cardCurrency} onChange={(v) => { setCardCurrency(v); setFeeCurrency(v); }} />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="ATM or bank fee" htmlFor="w-fee" hint="Leave empty if there was none.">
            <Input id="w-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Currency" htmlFor="w-fee-cur">
            <CurrencySelect id="w-fee-cur" label="Fee currency" value={feeCurrency} onChange={setFeeCurrency} />
          </Field>
        </div>
        <RateNote paid={num(charged)} paidCurrency={cardCurrency} received={num(received)} receivedCurrency={wallet.currency} fee={num(fee)} feeCurrency={feeCurrency} />
        <Field label="Date" htmlFor="w-date">
          <Input id="w-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <TripField trips={trips} value={tripId} onChange={setTripId} needed={hasFee} />
      </form>
    </Shell>
  );
}

export function ExchangeDialog({ wallet, wallets, trips, defaultTripId, ...common }: Common & { wallet: WalletView; wallets: WalletView[]; trips: TripOpt[]; defaultTripId: string | null }) {
  const [pending, start] = useTransition();
  const [fromId, setFromId] = useState(wallet.id);
  const [fromAmount, setFromAmount] = useState("");
  const [toCurrency, setToCurrency] = useState(wallets.find((w) => w.id !== wallet.id)?.currency ?? (wallet.currency === "USD" ? "EUR" : "USD"));
  const [toAmount, setToAmount] = useState("");
  const [fee, setFee] = useState("");
  const [feeCurrency, setFeeCurrency] = useState(wallet.currency);
  const [date, setDate] = useState(todayIso());
  const [tripId, setTripId] = useState(defaultTripId ?? "");
  const from = wallets.find((w) => w.id === fromId) ?? wallet;
  const hasFee = num(fee) > 0;
  const newWallet = !wallets.some((w) => w.currency === toCurrency);
  const overdraw = num(fromAmount) > from.balance;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await recordExchange({ from_wallet_id: fromId, from_amount: fromAmount, to_currency: toCurrency, to_amount: toAmount, date, fee, fee_currency: hasFee ? feeCurrency : null, trip_id: hasFee ? tripId : null });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Exchanged ${formatMoney(num(fromAmount), from.currency)} into ${formatMoney(num(toAmount), toCurrency)}`);
      common.onOpenChange(false);
    });
  };

  return (
    <Shell {...common} title="Exchange cash" description="Moves money between two wallets. Only a fee counts as an expense." formId="exchange-form" pending={pending} submit="Save exchange">
      <form id="exchange-form" onSubmit={submit} className="flex flex-col gap-4 pb-2">
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="I gave" htmlFor="x-from" hint={overdraw ? `More than the ${formatMoney(from.balance, from.currency)} in this wallet. It will go negative.` : undefined}>
            <Input id="x-from" autoFocus inputMode="decimal" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} required />
          </Field>
          <Field label="From wallet" htmlFor="x-from-w">
            <NativeSelect id="x-from-w" value={fromId} onChange={(e) => { setFromId(e.target.value); setFeeCurrency(wallets.find((w) => w.id === e.target.value)?.currency ?? feeCurrency); }}>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.currency}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="I got" htmlFor="x-to" hint={newWallet ? `A ${toCurrency} wallet will be created.` : undefined}>
            <Input id="x-to" inputMode="decimal" value={toAmount} onChange={(e) => setToAmount(e.target.value)} required />
          </Field>
          <Field label="To wallet" htmlFor="x-to-c">
            <CurrencySelect id="x-to-c" label="To currency" value={toCurrency} onChange={setToCurrency} />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="Fee (optional)" htmlFor="x-fee">
            <Input id="x-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Currency" htmlFor="x-fee-c">
            <CurrencySelect id="x-fee-c" label="Fee currency" value={feeCurrency} onChange={setFeeCurrency} />
          </Field>
        </div>
        {from.currency !== toCurrency ? <RateNote paid={num(fromAmount)} paidCurrency={from.currency} received={num(toAmount)} receivedCurrency={toCurrency} fee={num(fee)} feeCurrency={feeCurrency} /> : <p className="text-sm text-danger" role="alert">Pick two different currencies.</p>}
        <Field label="Date" htmlFor="x-date">
          <Input id="x-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <TripField trips={trips} value={tripId} onChange={setTripId} needed={hasFee} />
      </form>
    </Shell>
  );
}

/** "Received" adds an amount; "Adjust" sets the balance to what I counted and records the difference. */
export function EntryDialog({ wallet, mode, ...common }: Common & { wallet: WalletView; mode: "received" | "adjustment" }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());
  const counted = mode === "adjustment";
  const diff = counted && value !== "" ? num(value) - wallet.balance : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await recordCashEntry({ wallet_id: wallet.id, type: mode, date, amount: counted ? (diff ?? 0) : value, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(counted ? "Balance updated" : "Added to your wallet");
      common.onOpenChange(false);
    });
  };

  return (
    <Shell {...common} title={counted ? `Adjust ${wallet.currency}` : `Received ${wallet.currency}`} description={counted ? `Current balance: ${formatMoney(wallet.balance, wallet.currency)}` : "Change, a refund or a friend paying you back."} formId="entry-form" pending={pending} submit="Save">
      <form id="entry-form" onSubmit={submit} className="flex flex-col gap-4 pb-2">
        <Field label={counted ? "What I counted" : "Amount"} htmlFor="e-amount" hint={diff !== null ? `A difference of ${diff > 0 ? "+" : ""}${formatMoney(diff, wallet.currency)}` : undefined}>
          <Input id="e-amount" autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="e-date">
            <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Note" htmlFor="e-note">
            <Input id="e-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </form>
    </Shell>
  );
}

/** New wallet, or edit the label and low-balance alert of an existing one. */
export function WalletDialog({ wallet, baseCurrency, taken, ...common }: Common & { wallet?: WalletView | null; baseCurrency: string; taken: string[] }) {
  const [pending, start] = useTransition();
  const first = [baseCurrency, ...CURRENCIES].find((c) => !taken.includes(c)) ?? "USD";
  const [currency, setCurrency] = useState(wallet?.currency ?? first);
  const [label, setLabel] = useState(wallet?.label ?? "");
  const [alert, setAlert] = useState(wallet?.low_balance_alert != null ? String(wallet.low_balance_alert) : "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = wallet ? await updateWallet(wallet.id, { label, low_balance_alert: alert }) : await createWallet({ currency, label, low_balance_alert: alert });
      if (!res.ok) return void toast.error(res.error);
      common.onOpenChange(false);
    });
  };

  return (
    <Shell {...common} title={wallet ? `${wallet.currency} wallet` : "New wallet"} description={wallet ? undefined : "One wallet per currency."} formId="wallet-form" pending={pending} submit={wallet ? "Save" : "Create wallet"}>
      <form id="wallet-form" onSubmit={submit} className="flex flex-col gap-4 pb-2">
        {!wallet && (
          <Field label="Currency" htmlFor="wallet-cur">
            <NativeSelect id="wallet-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.filter((c) => !taken.includes(c)).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
        <Field label="Label (optional)" htmlFor="wallet-label">
          <Input id="wallet-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Travel pouch" />
        </Field>
        <Field label="Warn me below (optional)" htmlFor="wallet-alert" hint="Shows a low-balance chip on the wallet.">
          <Input id="wallet-alert" inputMode="decimal" value={alert} onChange={(e) => setAlert(e.target.value)} />
        </Field>
      </form>
    </Shell>
  );
}
