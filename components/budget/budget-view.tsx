"use client";
import { useState } from "react";
import { Banknote, CalendarClock, ChartPie, Coins, Flag, PiggyBank, Plus, Receipt, Target, TrendingUp, Wallet } from "lucide-react";
import { totalOfCaps, type BudgetSummary } from "@/lib/budget";
import type { CashSummary } from "@/lib/cash";
import { CashTab } from "@/components/cash/cash-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Expense, PhotoView } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { CategoryDonut, CumulativeSpend, DonutLegend, PlannedVsActual } from "@/components/charts/charts";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { CountUp, PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { ExpenseSheet } from "@/components/forms/expense-sheet";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/shell/workspace";
import { CountryCaps } from "./country-caps";
import { ExpenseTable } from "./expense-table";

type Opt = { id: string; name: string; flag: string; trip_id: string };

/** Full size until the longest figure would outgrow its card, then only as small as that length needs. */
const fitFigure = (length: number) => `min(24px, calc(100cqi / ${(length * 0.6).toFixed(1)}))`;

export function BudgetView({
  expenses,
  summary: s,
  countries,
  cities,
  baseCurrency,
  receipts,
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
  receipts: Record<string, PhotoView[]>;
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
  const cappedCount = s.byCountry.filter((c) => c.cap > 0).length;
  const cards = [
    { label: "Total budget", value: s.totalBudget, icon: Target, tone: "var(--ink)", hint: s.totalBudget ? "Trip total or country caps" : "Not set" },
    { label: "Total budget cap", value: totalOfCaps(s.byCountry), icon: Flag, tone: "var(--wishlist)", hint: cappedCount ? `${cappedCount} of ${s.byCountry.length} ${s.byCountry.length === 1 ? "country" : "countries"}` : "No caps set" },
    { label: "Planned", value: s.planned, icon: CalendarClock, tone: "var(--planned)", hint: "Upcoming costs" },
    { label: "Spent", value: s.spent, icon: Receipt, tone: "var(--visited)", hint: s.totalBudget ? `${Math.round((s.spent / s.totalBudget) * 100)}% of budget` : "So far" },
    { label: "Remaining", value: s.remaining, icon: PiggyBank, tone: s.remaining < 0 ? "var(--danger)" : "var(--accent)", hint: s.totalBudget ? (s.remaining < 0 ? "Over budget" : "Left to spend") : "Set a budget" },
    { label: "Average per day", value: s.avgPerDay, icon: TrendingUp, tone: "var(--wishlist)", hint: s.daysElapsed ? `Over ${s.daysElapsed} days` : "Trip not started" },
    { label: "Remaining per day", value: s.remainingPerDay ?? 0, icon: Coins, tone: "var(--visited)", hint: s.daysRemaining ? `${s.daysRemaining} days left` : "—" },
  ];
  const longestFigure = Math.max(...cards.map((c) => money(c.value).length));
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
          <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-12">
            {cards.map((c, i) => (
              <StaggerItem key={c.label} className={cn(i < 4 ? "lg:col-span-3" : "lg:col-span-4", i === cards.length - 1 && "max-lg:col-span-2")}>
                <div className="card flex h-full flex-col gap-2 p-4">
                  <div className="flex items-center gap-2 text-[13px] text-muted">
                    <c.icon className="size-4 shrink-0" style={{ color: c.tone }} /> {c.label}
                  </div>
                  <div className="@container">
                    <div style={{ fontSize: fitFigure(longestFigure) }}>
                      <CountUp value={c.value} format={(n) => money(n)} className={cn("num block whitespace-nowrap font-display font-semibold leading-none", c.label === "Remaining" && c.value < 0 && "text-danger")} />
                    </div>
                  </div>
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
                    <p className="num font-display text-lg font-semibold">{formatMoney(s.spent, baseCurrency, { compact: s.spent >= 10000 })}</p>
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
              <CumulativeSpend data={s.cumulative} currency={baseCurrency} budget={s.totalBudget || undefined} height={320} />
            </section>
            <section className="card p-5 lg:col-span-4" aria-label="Country budget caps">
              <h2 className="mb-3 text-xl font-semibold">Country caps</h2>
              <CountryCaps countries={s.byCountry} currency={baseCurrency} />
            </section>
          </div>

          <ExpenseTable expenses={expenses} countries={countries} cities={cities} base={baseCurrency} receipts={receipts} userId={ws.userId} onEdit={setEditing} />
        </>
      )}
        </TabsContent>
      </Tabs>
      {editing && <ExpenseSheet open onOpenChange={(o) => !o && setEditing(null)} expense={editing} receiptCount={receipts[editing.id]?.length ?? 0} />}
      {spendFrom && <ExpenseSheet open onOpenChange={(o) => !o && setSpendFrom(null)} cashFrom={spendFrom} />}
    </PageTransition>
  );
}
