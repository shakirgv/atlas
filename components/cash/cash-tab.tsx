"use client";
import { useState, useTransition } from "react";
import { ArrowDownUp, Banknote, ChevronDown, CircleAlert, Hand, Landmark, MoreHorizontal, Pencil, Plus, Receipt, Scale, ShoppingBag, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { deleteCashTransaction, deleteWallet, updateCashTransaction } from "@/actions/cash";
import { CASH_TX_META, costOverMid, costSentence, type CashSummary, type WalletView } from "@/lib/cash";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { CashTransaction, CashTxType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FilterChip } from "@/components/ui/misc";
import { EntryDialog, ExchangeDialog, WalletDialog, WithdrawDialog, type TripOpt } from "./cash-dialogs";

const signed = (n: number, currency: string) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatMoney(Math.abs(n), currency)}`;

const FILTERS: { value: string; label: string; types: CashTxType[] }[] = [
  { value: "withdrawal", label: "Withdrawals", types: ["withdrawal"] },
  { value: "exchange", label: "Exchanges", types: ["exchange_in", "exchange_out"] },
  { value: "spend", label: "Spending", types: ["spend"] },
  { value: "received", label: "Received", types: ["received"] },
  { value: "adjustment", label: "Adjustments", types: ["adjustment"] },
];

const DELETE_NOTE: Record<CashTxType, string> = {
  withdrawal: "Its fee expense is deleted too.",
  exchange_in: "The other side of the exchange and its fee expense are deleted too.",
  exchange_out: "The other side of the exchange and its fee expense are deleted too.",
  spend: "Its expense is deleted too.",
  received: "The wallet balance changes.",
  adjustment: "The wallet balance changes.",
};

function TxRow({ tx, currency }: { tx: CashTransaction; currency: string }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(Math.abs(Number(tx.amount))));
  const [date, setDate] = useState(tx.date);
  const [note, setNote] = useState(tx.note ?? "");
  const [pending, start] = useTransition();
  const type = tx.type as CashTxType;
  const pct = costOverMid(tx.effective_rate ? Number(tx.effective_rate) : null, tx.mid_market_rate ? Number(tx.mid_market_rate) : null);
  const detail = [
    tx.counter_amount && tx.counter_currency ? `${type === "withdrawal" ? "Card" : type === "exchange_in" ? "Gave" : "Got"} ${formatMoney(Number(tx.counter_amount), tx.counter_currency)}` : null,
    tx.fee_amount && tx.fee_currency ? `Fee ${formatMoney(Number(tx.fee_amount), tx.fee_currency)}` : null,
    tx.note,
  ].filter(Boolean);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      // An adjustment keeps its sign, so it edits the signed value.
      const res = await updateCashTransaction(tx.id, { amount: type === "adjustment" ? (Number(tx.amount) < 0 ? -Math.abs(Number(amount.replace(",", "."))) : amount) : amount, date, note });
      if (!res.ok) return void toast.error(res.error);
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <li className="py-2.5">
        <form onSubmit={save} className="flex flex-wrap items-center gap-2">
          <Input aria-label={`Amount in ${currency}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" autoFocus />
          <Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          <Input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="min-w-32 flex-1" />
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{CASH_TX_META[type]?.label ?? tx.type}</span>
          <span className="num text-xs text-muted">{fmtDate(tx.date, "dd MMM yyyy")}</span>
        </p>
        {detail.length > 0 && <p className="truncate text-xs text-muted">{detail.join(" · ")}</p>}
        {pct !== null && <p className="text-xs text-muted">{costSentence(pct)}</p>}
      </div>
      <span className={cn("num shrink-0 text-sm font-semibold", Number(tx.amount) > 0 && "text-visited")}>{signed(Number(tx.amount), currency)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="-my-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label="Transaction actions">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={async () => {
              if (!(await confirm({ title: "Delete this transaction?", description: DELETE_NOTE[type], confirmLabel: "Delete" }))) return;
              start(async () => {
                const res = await deleteCashTransaction(tx.id);
                if (!res.ok) toast.error(res.error);
              });
            }}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

type Action = "withdraw" | "exchange" | "received" | "adjustment" | "edit";

function WalletCard({ wallet, baseCurrency, onAction, onSpend, startOpen }: { wallet: WalletView; baseCurrency: string; onAction: (a: Action) => void; onSpend?: () => void; startOpen?: boolean }) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(Boolean(startOpen));
  const [filter, setFilter] = useState("all");
  const [, start] = useTransition();
  const active = FILTERS.find((f) => f.value === filter);
  const visible = active ? wallet.transactions.filter((t) => active.types.includes(t.type as CashTxType)) : wallet.transactions;
  const used = FILTERS.filter((f) => wallet.transactions.some((t) => f.types.includes(t.type as CashTxType)));
  const actions: { label: string; icon: typeof Landmark; run: () => void }[] = [
    { label: "Withdraw", icon: Landmark, run: () => onAction("withdraw") },
    { label: "Exchange", icon: ArrowDownUp, run: () => onAction("exchange") },
    ...(onSpend ? [{ label: "Spend", icon: ShoppingBag, run: onSpend }] : []),
    { label: "Received", icon: Hand, run: () => onAction("received") },
    { label: "Adjust", icon: Scale, run: () => onAction("adjustment") },
  ];

  return (
    <section className="card flex min-w-0 flex-col gap-3 p-5" aria-label={`${wallet.currency} wallet`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow truncate">{wallet.label ?? `${wallet.currency} cash`}</p>
          <p className={cn("num mt-1 font-display text-[32px] font-semibold leading-none", wallet.balance < 0 && "text-danger")}>{formatMoney(wallet.balance, wallet.currency)}</p>
          <p className="num mt-1 text-xs text-muted">
            {wallet.currency !== baseCurrency && wallet.baseValue !== null ? `≈ ${formatMoney(wallet.baseValue, baseCurrency)} · ` : ""}
            {wallet.lastActivity ? `Last activity ${fmtDate(wallet.lastActivity, "dd MMM")}` : "No activity yet"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label={`${wallet.currency} wallet actions`}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onAction("edit")}>
              <Pencil /> Label and alert
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={async () => {
                if (!(await confirm({ title: `Delete the ${wallet.currency} wallet?`, description: "Its transactions are deleted. Expenses stay in your budget.", confirmLabel: "Delete wallet" }))) return;
                start(async () => {
                  const res = await deleteWallet(wallet.id);
                  if (!res.ok) toast.error(res.error);
                });
              }}
            >
              <Trash2 /> Delete wallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {(wallet.low || wallet.balance < 0) && (
        <p className="inline-flex min-h-6 items-center gap-1 self-start rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium">
          <CircleAlert className="size-3 text-danger" /> {wallet.balance < 0 ? "Balance is negative" : `Below ${formatMoney(Number(wallet.low_balance_alert), wallet.currency)}`}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Wallet actions">
        {actions.map((a) => (
          <Button key={a.label} variant="secondary" size="sm" onClick={a.run}>
            <a.icon /> {a.label}
          </Button>
        ))}
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-9 items-center justify-between border-t border-border pt-2 text-sm font-medium text-ink/80 hover:text-ink">
        {wallet.transactions.length} transaction{wallet.transactions.length === 1 ? "" : "s"}
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          {used.length > 1 && (
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto" role="group" aria-label="Filter transactions">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
                All
              </FilterChip>
              {used.map((f) => (
                <FilterChip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
                  {f.label}
                </FilterChip>
              ))}
            </div>
          )}
          {visible.length ? (
            <ul className="divide-y divide-border">
              {visible.map((t) => (
                <TxRow key={t.id} tx={t} currency={wallet.currency} />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted">Nothing here yet.</p>
          )}
        </div>
      )}
    </section>
  );
}

/** Budget tab "Cash": one card per currency, plus what the cash is worth and what getting it cost. */
export function CashTab({ cash, baseCurrency, trips, defaultTripId, onSpend, startOpen }: { cash: CashSummary; baseCurrency: string; trips: TripOpt[]; defaultTripId: string | null; onSpend?: (wallet: WalletView) => void; startOpen?: boolean }) {
  const [dialog, setDialog] = useState<{ action: Action; wallet: WalletView } | null>(null);
  const [creating, setCreating] = useState(false);
  const close = (o: boolean) => !o && setDialog(null);
  const taken = cash.wallets.map((w) => w.currency);

  return (
    <div className="flex flex-col gap-4">
      {cash.wallets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-stretch">
          <div className="card flex flex-col gap-1 p-4">
            <span className="flex items-center gap-2 text-[13px] text-muted">
              <Banknote className="size-4 text-visited" /> Cash on hand
            </span>
            <span className="num font-display text-[24px] font-semibold leading-none">{formatMoney(cash.cashOnHand, baseCurrency)}</span>
            {cash.unconverted.length > 0 && <span className="text-xs text-muted">Without {cash.unconverted.join(", ")}: no rate right now</span>}
          </div>
          <div className="card flex flex-col gap-1 p-4">
            <span className="flex items-center gap-2 text-[13px] text-muted">
              <Receipt className="size-4 text-accent" /> Fees paid
            </span>
            <span className="num font-display text-[24px] font-semibold leading-none">{formatMoney(cash.feesPaid, baseCurrency)}</span>
          </div>
          <Button variant="secondary" onClick={() => setCreating(true)} className="col-span-2 h-auto min-h-11 sm:col-span-1">
            <Plus /> New wallet
          </Button>
        </div>
      )}
      {cash.wallets.length ? (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {cash.wallets.map((w) => (
            <WalletCard key={w.id} wallet={w} baseCurrency={baseCurrency} startOpen={startOpen} onAction={(action) => setDialog({ action, wallet: w })} onSpend={onSpend ? () => onSpend(w) : undefined} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Wallet} title="Track your cash" description="One wallet per currency: what you hold, what ATMs charge you and your real exchange rate." action={<Button onClick={() => setCreating(true)}><Plus /> Add a wallet</Button>} />
      )}
      {dialog?.action === "withdraw" && <WithdrawDialog open onOpenChange={close} wallet={dialog.wallet} baseCurrency={baseCurrency} trips={trips} defaultTripId={defaultTripId} />}
      {dialog?.action === "exchange" && <ExchangeDialog open onOpenChange={close} wallet={dialog.wallet} wallets={cash.wallets} trips={trips} defaultTripId={defaultTripId} />}
      {(dialog?.action === "received" || dialog?.action === "adjustment") && <EntryDialog open onOpenChange={close} wallet={dialog.wallet} mode={dialog.action} />}
      {dialog?.action === "edit" && <WalletDialog open onOpenChange={close} wallet={dialog.wallet} baseCurrency={baseCurrency} taken={taken} />}
      {creating && <WalletDialog open onOpenChange={setCreating} baseCurrency={baseCurrency} taken={taken} />}
    </div>
  );
}
