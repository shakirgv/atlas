"use client";
import { useState } from "react";
import { Banknote, CalendarClock, ChartPie, Coins, PiggyBank, Plus, Receipt, Target, TrendingUp, Wallet } from "lucide-react";
import type { BudgetSummary } from "@/lib/budget";
import type { CashSummary } from "@/lib/cash";
import { CashTab } from "@/components/cash/cash-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Expense } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CategoryDonut, CumulativeSpend, DonutLegend, PlannedVsActual } from "@/components/charts/charts";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { CountUp, PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { ExpenseSheet } from "@/components/forms/expense-sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { useWorkspace } from "@/components/shell/workspace";
import { ExpenseTable } from "./expense-table";

type Opt = { id: string; name: string; flag: string; trip_id: string };

export function BudgetView({
  expenses,
  summary: s,
  countries,
  baseCurrency,
  cash,
  allTrips,
  defaultTripId,
  initialTab,
}: {
  expenses: Expense[];
  summary: BudgetSummary;
  countries: Opt[];
  cities: { id: string; name: string; trip_country_id: string }[];
  trips: { id: string; title: string }[];
  baseCurrency: string;
  cash: CashSummary;
  allTrips: { id: string; title: string }[];
  defaultTripId: string | null;
  initialTab: "overview" | "cash";
}) {
  const ws = useWorkspace();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [spendFrom, setSpendFrom] = useState<{ id: string; currency: string } | null>(null);
  const changeTab = (v: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", v);
    window.history.replaceState(null, "", url);
  };
  const money = (n: number) => formatMoney(n, baseCurrency);
  const cards = [
    { label: "Total budget", value: s.totalBudget, icon: Target, tone: "var(--ink)", hint: s.totalBudget ? "Trip total or country caps" : "Not set" },
    { label: "Planned", value: s.planned, icon: CalendarClock, tone: "var(--planned)", hint: "Upcoming costs" },
    { label: "Spent", value: s.spent, icon: Receipt, tone: "var(--visited)", hint: s.totalBudget ? `${Math.round((s.spent / s.totalBudget) * 100)}% of budget` : "So far" },
    { label: "Remaining", value: s.remaining, icon: PiggyBank, tone: s.remaining < 0 ? "var(--danger)" : "var(--accent)", hint: s.totalBudget ? (s.remaining < 0 ? "Over budget" : "Left to spend") : "Set a budget" },
    { label: "Average per day", value: s.avgPerDay, icon: TrendingUp, tone: "var(--wishlist)", hint: s.daysElapsed ? `Over ${s.daysElapsed} days` : "Trip not started" },
    { label: "Remaining per day", value: s.remainingPerDay ?? 0, icon: Coins, tone: "var(--visited)", hint: s.daysRemaining ? `${s.daysRemaining} days left` : "—" },
  ];
  const capped = s.byCountry.filter((c) => c.cap > 0);
  const donut = s.byCategory.map((c) => ({ category: c.category, value: c.actual }));

  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Track"
        title="Budget"
        description={`All amounts in ${baseCurrency}, converted at the rate of each expense.`}
        actions={
          <Button onClick={() => ws.openQuickAdd("expense")}>
            <Plus /> Add expense
          </Button>
        }
      />
      <Tabs defaultValue={initialTab} onValueChange={changeTab}>
        <TabsList aria-label="Budget sections">
          <TabsTrigger value="overview">
            <ChartPie /> Overview
          </TabsTrigger>
          <TabsTrigger value="cash">
            <Banknote /> Cash
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cash">
          <CashTab cash={cash} baseCurrency={baseCurrency} trips={allTrips} defaultTripId={defaultTripId} onSpend={(w) => setSpendFrom({ id: w.id, currency: w.currency })} />
        </TabsContent>
        <TabsContent value="overview" className="flex flex-col gap-6">
      {!expenses.length && !s.totalBudget ? (
        <EmptyState
          icon={Wallet}
          title="Start tracking your money"
          description="Log planned costs before you go and spending on the road — in any currency."
          action={
            <Button onClick={() => ws.openQuickAdd("expense")}>
              <Plus /> Add your first expense
            </Button>
          }
        />
      ) : (
        <>
          <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map((c) => (
              <StaggerItem key={c.label}>
                <div className="card flex h-full flex-col gap-2 p-4">
                  <div className="flex items-center gap-2 text-[13px] text-muted">
                    <c.icon className="size-4" style={{ color: c.tone }} /> {c.label}
                  </div>
                  <CountUp value={c.value} format={(n) => money(n)} className={cn("num font-display text-[24px] font-semibold leading-none", c.label === "Remaining" && c.value < 0 && "text-danger")} />
                  <span className="text-xs text-muted">{c.hint}</span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          <div className="grid gap-4 lg:grid-cols-12">
            <section className="card p-5 lg:col-span-4" aria-label="Spending by category">
              <h2 className="mb-3 text-xl font-semibold">By category</h2>
              <CategoryDonut
                data={donut}
                currency={baseCurrency}
                height={200}
                center={
                  <div>
                    <p className="text-xs text-muted">Spent</p>
                    <p className="num font-display text-xl font-semibold">{formatMoney(s.spent, baseCurrency, { compact: s.spent >= 100000 })}</p>
                  </div>
                }
              />
              <div className="mt-4">
                <DonutLegend data={donut} currency={baseCurrency} />
              </div>
            </section>
            <section className="card p-5 lg:col-span-8" aria-label="Planned vs spent per country">
              <h2 className="mb-3 text-xl font-semibold">Planned vs spent per country</h2>
              <PlannedVsActual data={s.byCountry.filter((c) => c.actual || c.planned).map((c) => ({ name: c.name, flag: c.flag, planned: c.planned, actual: c.actual }))} currency={baseCurrency} />
            </section>
            <section className="card p-5 lg:col-span-8" aria-label="Cumulative spend">
              <h2 className="mb-3 text-xl font-semibold">Spending over time</h2>
              <CumulativeSpend data={s.cumulative} currency={baseCurrency} budget={s.totalBudget || undefined} />
            </section>
            <section className="card p-5 lg:col-span-4" aria-label="Country budget caps">
              <h2 className="mb-3 text-xl font-semibold">Country caps</h2>
              {capped.length ? (
                <ul className="flex flex-col gap-4">
                  {capped.map((c) => {
                    const pct = (c.actual / c.cap) * 100;
                    return (
                      <li key={c.id}>
                        <div className="mb-1.5 flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {c.flag} {c.name}
                          </span>
                          <span className={cn("num text-xs", pct > 100 ? "font-semibold text-danger" : "text-muted")}>
                            {money(c.actual)} / {money(c.cap)}
                          </span>
                        </div>
                        <Progress value={pct} color={pct > 100 ? "var(--danger)" : pct > 85 ? "var(--planned)" : "var(--visited)"} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">Give a country a budget cap (Country → Edit) to track it here.</p>
              )}
            </section>
          </div>

          <ExpenseTable expenses={expenses} countries={countries} base={baseCurrency} onEdit={setEditing} />
        </>
      )}
        </TabsContent>
      </Tabs>
      {editing && <ExpenseSheet open onOpenChange={(o) => !o && setEditing(null)} expense={editing} />}
      {spendFrom && <ExpenseSheet open onOpenChange={(o) => !o && setSpendFrom(null)} cashFrom={spendFrom} />}
    </PageTransition>
  );
}
