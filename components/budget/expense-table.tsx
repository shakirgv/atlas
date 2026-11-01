"use client";
import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download, MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteExpense, updateExpense } from "@/actions/expenses";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORY_META, formatMoney, round2 } from "@/lib/money";
import { EXPENSE_CATEGORY_ICON } from "@/lib/icons";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type SortKey = "date" | "title" | "category" | "amount_base";
type Opt = { id: string; name: string; flag?: string };

function toInput(e: Expense, patch: Partial<Expense> = {}) {
  const r = { ...e, ...patch };
  return {
    trip_id: r.trip_id,
    trip_country_id: r.trip_country_id,
    city_id: r.city_id,
    date: r.date,
    title: r.title,
    category: r.category as ExpenseCategory,
    kind: r.kind as "planned" | "actual",
    amount: Number(r.amount),
    currency: r.currency,
    fx_rate: Number(r.fx_rate),
    notes: r.notes,
  };
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Sort = { key: SortKey; dir: 1 | -1 };

function Th({ k, sort, onSort, children, className }: { k: SortKey; sort: Sort; onSort: (k: SortKey) => void; children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("px-3 py-3 font-medium", className)} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-ink">
        {children}
        {sort.key === k ? sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

export function ExpenseTable({ expenses, countries, base, onEdit }: { expenses: Expense[]; countries: Opt[]; base: string; onEdit: (e: Expense) => void }) {
  const confirm = useConfirm();
  const [, start] = useTransition();
  const [sort, setSort] = useState<Sort>({ key: "date", dir: -1 });
  const onSort = (k: SortKey) => setSort((s) => ({ key: k, dir: s.key === k ? ((s.dir * -1) as 1 | -1) : k === "date" || k === "amount_base" ? -1 : 1 }));
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("all");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<{ id: string; field: "title" | "amount" | "date" } | null>(null);
  const [draft, setDraft] = useState("");

  const rows = useMemo(() => {
    const list = expenses.filter(
      (e) =>
        (country === "all" || (country === "none" ? !e.trip_country_id : e.trip_country_id === country)) &&
        (category === "all" || e.category === category) &&
        (kind === "all" || e.kind === kind) &&
        (!from || e.date >= from) &&
        (!to || e.date <= to) &&
        (!q || `${e.title ?? ""} ${e.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    );
    return [...list].sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [expenses, country, category, kind, from, to, q, sort]);
  const total = rows.reduce((s, e) => s + Number(e.amount_base), 0);

  const save = (e: Expense, patch: Partial<Expense>) =>
    start(async () => {
      const res = await updateExpense(e.id, toInput(e, patch));
      if (!res.ok) toast.error(res.error);
    });

  const commitDraft = (e: Expense) => {
    if (!editing) return;
    const f = editing.field;
    setEditing(null);
    if (f === "title" && draft !== (e.title ?? "")) save(e, { title: draft });
    if (f === "amount") {
      const n = Number(draft.replace(",", "."));
      if (Number.isFinite(n) && n > 0 && n !== Number(e.amount)) save(e, { amount: round2(n) });
    }
    if (f === "date" && /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft !== e.date) save(e, { date: draft });
  };

  const exportCsv = () => {
    const name = new Map(countries.map((c) => [c.id, c.name]));
    const head = ["date", "title", "category", "kind", "amount", "currency", "fx_rate", `amount_${base}`, "country", "notes"];
    const lines = [head.join(",")].concat(
      rows.map((e) => [e.date, e.title, e.category, e.kind, e.amount, e.currency, e.fx_rate, e.amount_base, e.trip_country_id ? name.get(e.trip_country_id) : "", e.notes].map(csvCell).join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card overflow-hidden" aria-label="Expenses">
      <div className="flex flex-col gap-2 border-b border-border p-4">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search expenses" className="pl-9" aria-label="Search expenses" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className="lg:w-40">
              <option value="all">All countries</option>
              <option value="none">Whole trip</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {c.name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="lg:w-40">
              <option value="all">All categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_META[c].label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Kind" className="lg:w-40">
              <option value="all">Planned + spent</option>
              <option value="actual">Spent</option>
              <option value="planned">Planned</option>
            </NativeSelect>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="lg:w-40" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="lg:w-40" />
            <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
              <Download /> CSV
            </Button>
          </div>
        </div>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <Th k="date" sort={sort} onSort={onSort}>Date</Th>
                <Th k="title" sort={sort} onSort={onSort}>Expense</Th>
                <Th k="category" sort={sort} onSort={onSort}>Category</Th>
                <th className="px-3 py-3 font-medium">Kind</th>
                <th className="px-3 py-3 text-right font-medium">Amount</th>
                <Th k="amount_base" sort={sort} onSort={onSort} className="text-right">
                  {base}
                </Th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((e) => {
                const cat = e.category as ExpenseCategory;
                const Icon = EXPENSE_CATEGORY_ICON[cat] ?? EXPENSE_CATEGORY_ICON.other;
                const c = countries.find((x) => x.id === e.trip_country_id);
                const isEditing = (f: string) => editing?.id === e.id && editing.field === f;
                return (
                  <tr key={e.id} className="group hover:bg-ink/[0.02]">
                    <td className="num whitespace-nowrap px-3 py-2 text-muted">
                      {isEditing("date") ? (
                        <Input type="date" autoFocus value={draft} onChange={(ev) => setDraft(ev.target.value)} onBlur={() => commitDraft(e)} onKeyDown={(ev) => ev.key === "Enter" && commitDraft(e)} className="h-8 w-36" />
                      ) : (
                        <button type="button" onClick={() => (setEditing({ id: e.id, field: "date" }), setDraft(e.date))} className="hover:text-ink" aria-label="Edit date">
                          {fmtDate(e.date)}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing("title") ? (
                        <Input autoFocus value={draft} onChange={(ev) => setDraft(ev.target.value)} onBlur={() => commitDraft(e)} onKeyDown={(ev) => ev.key === "Enter" && commitDraft(e)} className="h-8" />
                      ) : (
                        <button type="button" onClick={() => (setEditing({ id: e.id, field: "title" }), setDraft(e.title ?? ""))} className="flex flex-col text-left" aria-label="Edit title">
                          <span className="font-medium">{e.title || EXPENSE_CATEGORY_META[cat]?.label}</span>
                          {c && <span className="text-xs text-muted">{c.flag} {c.name}</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <label className="relative inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium" style={{ background: `${EXPENSE_CATEGORY_META[cat]?.color}1f` }}>
                        <Icon className="size-3.5" style={{ color: EXPENSE_CATEGORY_META[cat]?.color }} />
                        {EXPENSE_CATEGORY_META[cat]?.label}
                        <select value={e.category} onChange={(ev) => save(e, { category: ev.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Change category">
                          {EXPENSE_CATEGORIES.map((x) => (
                            <option key={x} value={x}>
                              {EXPENSE_CATEGORY_META[x].label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => save(e, { kind: e.kind === "actual" ? "planned" : "actual" })}
                        className={cn("rounded-full px-2 py-1 text-xs font-medium", e.kind === "actual" ? "bg-visited-soft text-ink" : "bg-planned-soft text-ink")}
                        aria-label={`Kind: ${e.kind}. Click to toggle`}
                      >
                        {e.kind === "actual" ? "Spent" : "Planned"}
                      </button>
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2 text-right">
                      {isEditing("amount") ? (
                        <Input autoFocus inputMode="decimal" value={draft} onChange={(ev) => setDraft(ev.target.value)} onBlur={() => commitDraft(e)} onKeyDown={(ev) => ev.key === "Enter" && commitDraft(e)} className="ml-auto h-8 w-28 text-right" />
                      ) : (
                        <button type="button" onClick={() => (setEditing({ id: e.id, field: "amount" }), setDraft(String(e.amount)))} className="hover:text-accent" aria-label="Edit amount">
                          {formatMoney(Number(e.amount), e.currency)}
                        </button>
                      )}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2 text-right font-medium">{formatMoney(Number(e.amount_base), base)}</td>
                    <td className="px-2 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label="Expense actions">
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => onEdit(e)}>
                            <Pencil /> Edit all fields
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onSelect={async () => {
                              if (!(await confirm({ title: "Delete this expense?", confirmLabel: "Delete expense" }))) return;
                              start(async () => {
                                const res = await deleteExpense(e.id);
                                if (!res.ok) toast.error(res.error);
                                else toast.success("Expense deleted");
                              });
                            }}
                          >
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-surface-2">
              <tr>
                <td colSpan={5} className="px-3 py-3 text-sm text-muted">
                  {rows.length} {rows.length === 1 ? "expense" : "expenses"}
                </td>
                <td className="num px-3 py-3 text-right font-semibold">{formatMoney(total, base)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-muted">No expenses match these filters.</p>
      )}
    </section>
  );
}
