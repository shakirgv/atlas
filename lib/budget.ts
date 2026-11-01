import { differenceInCalendarDays } from "date-fns";
import { toDate, todayIso } from "@/lib/dates";
import type { CountryVM } from "@/lib/data";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseCategory, type Trip } from "@/lib/types";

export type BudgetSummary = {
  totalBudget: number;
  planned: number;
  spent: number;
  remaining: number;
  avgPerDay: number;
  remainingPerDay: number | null;
  daysElapsed: number;
  daysRemaining: number;
  byCategory: { category: ExpenseCategory; actual: number; planned: number }[];
  byCountry: { id: string; name: string; flag: string; actual: number; planned: number; cap: number }[];
  cumulative: { date: string; spent: number }[];
};

/** All money is already in the base currency (amount_base). */
export function summarizeBudget(expenses: Expense[], trips: Trip[], countries: CountryVM[]): BudgetSummary {
  const actual = expenses.filter((e) => e.kind === "actual");
  const plannedRows = expenses.filter((e) => e.kind === "planned");
  const spent = actual.reduce((s, e) => s + Number(e.amount_base), 0);
  const planned = plannedRows.reduce((s, e) => s + Number(e.amount_base), 0);
  const tripBudgets = trips.reduce((s, t) => s + Number(t.total_budget ?? 0), 0);
  const countryCaps = countries.reduce((s, c) => s + Number(c.budget ?? 0), 0);
  const totalBudget = tripBudgets || countryCaps;

  const today = todayIso();
  const starts = trips.map((t) => t.start_date).filter(Boolean) as string[];
  const ends = trips.map((t) => t.end_date).filter(Boolean) as string[];
  const start = starts.sort()[0] ?? actual.map((e) => e.date).sort()[0] ?? today;
  const end = ends.sort().pop() ?? null;
  const elapsedEnd = end && end < today ? end : today;
  const daysElapsed = start <= today ? Math.max(1, differenceInCalendarDays(toDate(elapsedEnd)!, toDate(start)!) + 1) : 0;
  const daysRemaining = end ? Math.max(0, differenceInCalendarDays(toDate(end)!, toDate(today > start ? today : start)!) + (today > start ? 0 : 1)) : 0;
  const remaining = totalBudget - spent;

  const byCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    actual: actual.filter((e) => e.category === category).reduce((s, e) => s + Number(e.amount_base), 0),
    planned: plannedRows.filter((e) => e.category === category).reduce((s, e) => s + Number(e.amount_base), 0),
  }));

  const byCountry = countries.map((c) => ({
    id: c.id,
    name: c.name,
    flag: c.flag,
    actual: actual.filter((e) => e.trip_country_id === c.id).reduce((s, e) => s + Number(e.amount_base), 0),
    planned: plannedRows.filter((e) => e.trip_country_id === c.id).reduce((s, e) => s + Number(e.amount_base), 0),
    cap: Number(c.budget ?? 0),
  }));

  const sorted = [...actual].sort((a, b) => a.date.localeCompare(b.date));
  const cumulative: { date: string; spent: number }[] = [];
  let running = 0;
  for (const e of sorted) {
    running += Number(e.amount_base);
    const last = cumulative[cumulative.length - 1];
    if (last && last.date === e.date) last.spent = running;
    else cumulative.push({ date: e.date, spent: running });
  }

  return {
    totalBudget,
    planned,
    spent,
    remaining,
    avgPerDay: daysElapsed ? spent / daysElapsed : 0,
    remainingPerDay: totalBudget && daysRemaining ? remaining / daysRemaining : null,
    daysElapsed,
    daysRemaining,
    byCategory,
    byCountry,
    cumulative,
  };
}
