"use client";
import { BudgetView } from "@/components/budget/budget-view";
import { WorkspaceProvider, type Workspace } from "@/components/shell/workspace";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import { summarizeBudget } from "@/lib/budget";
import { COUNTRIES } from "@/lib/countries";
import type { CountryVM } from "@/lib/data";
import type { Expense, Trip } from "@/lib/types";

const WORKSPACE: Workspace = {
  userId: "u",
  email: null,
  settings: null,
  baseCurrency: "AZN",
  displayName: "",
  trips: [],
  activeTripId: "t",
  isAll: false,
  countries: [],
  cities: [],
  vault: { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null },
  sharingEnabled: false,
};

const TRIPS = [{ id: "t", total_budget: 1000000, start_date: "2037-01-01", end_date: "2047-01-01" }] as Trip[];
const CAPS = [10000, 5000, 20000, 15000];
const CASH = { wallets: [], cashOnHand: 0, unconverted: [], feesPaid: 0 };

const spend = (id: string, trip_country_id: string, amount_base: number) => ({ id, trip_country_id, amount_base, kind: "actual", category: "food", date: "2037-02-01", title: id, amount: amount_base, currency: "AZN" }) as Expense;

export function BudgetPreview({ caps }: { caps: "all" | "few" | "none" }) {
  const countries = COUNTRIES.map((c, i) => ({ id: c.cca2, name: c.name, flag: c.flag, trip_id: "t", budget: caps === "none" || (caps === "few" && i % 40) ? null : CAPS[i % CAPS.length] })) as unknown as CountryVM[];
  // One country over its cap and one close to it, deep in the list, so the shortened list has to bring them up.
  const expenses = caps === "none" ? [] : [spend("over", countries[120].id, 26000), spend("near", countries[200].id, 18000)];
  return (
    <WorkspaceProvider value={{ ...WORKSPACE, openQuickAdd: () => {}, openPalette: () => {} }}>
      <TooltipProvider>
        <ConfirmProvider>
          <main className="mx-auto w-full max-w-[1280px] p-4 md:p-8">
            <BudgetView
              expenses={expenses}
              summary={summarizeBudget(expenses, TRIPS, countries)}
              countries={countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag, trip_id: c.trip_id }))}
              cities={[]}
              trips={[{ id: "t", title: "World Tour 2037" }]}
              baseCurrency="AZN"
              cash={CASH}
              receipts={{}}
              allTrips={[{ id: "t", title: "World Tour 2037" }]}
              defaultTripId="t"
              initialTab="overview"
            />
          </main>
        </ConfirmProvider>
      </TooltipProvider>
    </WorkspaceProvider>
  );
}
