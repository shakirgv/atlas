"use client";
import { useMemo, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { estimateGroups, type EstimateGroup } from "@/lib/budget";
import type { CityVM, CountryVM } from "@/lib/data";
import { EXPENSE_CATEGORY_ICON } from "@/lib/icons";
import { EXPENSE_CATEGORY_META, formatMoney } from "@/lib/money";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { EmptyState } from "@/components/common/empty-state";
import { SectionTitle } from "@/components/common/page-header";
import { ExpenseRow } from "@/components/budget/expense-row";
import { ExpenseSheet } from "@/components/forms/expense-sheet";
import { useWorkspace } from "@/components/shell/workspace";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";

function Tile({ label, value, note, children }: { label: string; value: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="num break-words font-display text-2xl font-semibold">{value}</p>
      {note && <p className="num mt-0.5 text-xs text-muted">{note}</p>}
      {children}
    </div>
  );
}

function EstimateCard({ group, money, onAdd, onEdit }: { group: EstimateGroup; money: (n: number) => string; onAdd: () => void; onEdit: (e: Expense) => void }) {
  const countryLevel = group.cityId === null;
  return (
    <section className="card p-4" aria-label={group.name}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{group.name}</h3>
          {countryLevel && <p className="text-xs text-muted">Costs not tied to one city, such as international flights.</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {group.total > 0 && <span className="num text-sm font-medium">{money(group.total)}</span>}
          <Button size="sm" variant="secondary" onClick={onAdd} aria-label={`Add estimate for ${group.name}`}>
            <Plus /> Add
          </Button>
        </div>
      </div>
      {group.categories.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {group.categories.map(({ category, total, items }) => {
            const key = category as ExpenseCategory;
            const Icon = EXPENSE_CATEGORY_ICON[key] ?? EXPENSE_CATEGORY_ICON.other;
            const meta = EXPENSE_CATEGORY_META[key] ?? EXPENSE_CATEGORY_META.other;
            return (
              <li key={category}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `${meta.color}22` }}>
                    <Icon className="size-3.5" style={{ color: meta.color }} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                  <span className="num shrink-0">{money(total)}</span>
                </div>
                <ul className="ml-9 mt-1 flex flex-col">
                  {items.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => onEdit(e)} className="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm text-muted hover:bg-ink/[0.03] hover:text-ink">
                        <span className="min-w-0 truncate">{e.title || meta.label}</span>
                        <span className="num shrink-0 text-xs">{money(Number(e.amount_base))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The cap, what I expect to spend and what I have spent are three different numbers, so each gets its own tile. */
export function BudgetTab({ country, cities, expenses, baseCurrency }: { country: CountryVM; cities: CityVM[]; expenses: Expense[]; baseCurrency: string }) {
  const ws = useWorkspace();
  const [editing, setEditing] = useState<Expense | null>(null);
  const money = (n: number) => formatMoney(n, baseCurrency);
  const spent = expenses.filter((e) => e.kind === "actual");
  const spentTotal = spent.reduce((s, e) => s + Number(e.amount_base), 0);
  const estimated = expenses.filter((e) => e.kind === "planned").reduce((s, e) => s + Number(e.amount_base), 0);
  const cap = Number(country.budget ?? 0);
  const groups = useMemo(() => estimateGroups(expenses, cities), [expenses, cities]);
  const addEstimate = (group: EstimateGroup) =>
    ws.openQuickAdd({ kind: "expense", tripCountryId: country.id, preset: { kind: "planned", cityId: group.cityId, category: group.cityId ? "food" : "flights" } });
  const left = cap - estimated;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Budget cap" value={cap ? money(cap) : "Not set"} note={cap ? undefined : "Set it under Edit details"} />
        <Tile label="Estimated costs" value={money(estimated)} note={cap && estimated ? (left >= 0 ? `${money(left)} under the cap` : `${money(-left)} over the cap`) : undefined} />
        <Tile label="Spent" value={money(spentTotal)} note={cap ? `${Math.round((spentTotal / cap) * 100)}% of the cap` : undefined}>
          {cap > 0 && <Progress className="mt-2" value={(spentTotal / cap) * 100} color={spentTotal > cap ? "var(--danger)" : "var(--visited)"} />}
        </Tile>
      </div>
      <div className="mt-6">
        <SectionTitle>Estimated costs</SectionTitle>
        <div className="grid items-start gap-4 lg:grid-cols-2" data-testid="estimate-groups">
          {groups.map((g) => (
            <EstimateCard key={g.cityId ?? "country"} group={g} money={money} onAdd={() => addEstimate(g)} onEdit={setEditing} />
          ))}
        </div>
      </div>
      <div className="mt-6">
        <SectionTitle action={<Button size="sm" onClick={() => ws.openQuickAdd({ kind: "expense", tripCountryId: country.id })}><Plus /> Add expense</Button>}>Spent</SectionTitle>
        {spent.length ? (
          <ul className="card divide-y divide-border px-4">
            {spent.map((e) => (
              <ExpenseRow key={e.id} e={e} base={baseCurrency} />
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={Wallet} title="Nothing spent yet" description="Log what you spend here as you go." />
        )}
      </div>
      {editing && <ExpenseSheet open onOpenChange={(o) => !o && setEditing(null)} expense={editing} />}
    </>
  );
}
