import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { summarizeBudget } from "@/lib/budget";
import { loadCash } from "@/lib/server/cash";
import { BudgetView } from "@/components/budget/budget-view";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage({ searchParams }: PageProps<"/budget">) {
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const [g, cash] = await Promise.all([loadGraph(supabase, scope.trips, scope.tripIds, { expenses: true, receipts: true }), loadCash(supabase, scope.baseCurrency)]);
  return (
    <BudgetView
      expenses={g.expenses}
      summary={summarizeBudget(g.expenses, g.trips, g.countries)}
      countries={g.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag, trip_id: c.trip_id }))}
      cities={g.cities.map((c) => ({ id: c.id, name: c.name, trip_country_id: c.trip_country_id }))}
      trips={g.trips.map((t) => ({ id: t.id, title: t.title }))}
      baseCurrency={scope.baseCurrency}
      cash={cash}
      receipts={g.receipts}
      allTrips={scope.trips.map((t) => ({ id: t.id, title: t.title }))}
      defaultTripId={scope.activeTrip?.id ?? null}
      initialTab={sp.tab === "cash" ? "cash" : "overview"}
    />
  );
}
