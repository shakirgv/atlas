"use client";
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cappedCountries, searchCountryBudgets, type BudgetSummary } from "@/lib/budget";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";

const COLLAPSED_ROWS = 5;

export function CountryCaps({ countries, currency }: { countries: BudgetSummary["byCountry"]; currency: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const capped = useMemo(() => cappedCountries(countries), [countries]);
  const money = (n: number) => formatMoney(n, currency);

  if (!capped.length) return <p className="text-sm text-muted">Give a country a budget cap (Country → Edit) to track it here.</p>;

  const searching = query.trim().length > 0;
  const rows = searching ? searchCountryBudgets(countries, query) : open ? capped : capped.slice(0, COLLAPSED_ROWS);

  return (
    <div className="flex flex-col gap-3">
      {countries.length > COLLAPSED_ROWS && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search countries" className="pl-9" aria-label="Search country caps" />
        </div>
      )}
      {rows.length ? (
        <ul className={cn("flex flex-col gap-3", (searching || open) && "max-h-80 overflow-y-auto pr-2")}>
          {rows.map((c) => {
            const pct = c.cap > 0 ? (c.actual / c.cap) * 100 : 0;
            return (
              <li key={c.id}>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                  <span className="min-w-0 font-medium">
                    {c.flag} {c.name}
                  </span>
                  {c.cap > 0 ? (
                    <span className={cn("num ml-auto text-xs", pct > 100 ? "font-semibold text-danger" : "text-muted")}>
                      {money(c.actual)} / {money(c.cap)}
                    </span>
                  ) : (
                    <span className="ml-auto text-xs text-muted">No cap set</span>
                  )}
                </div>
                {c.cap > 0 && <Progress value={pct} color={pct > 100 ? "var(--danger)" : pct > 85 ? "var(--planned)" : "var(--visited)"} />}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact icon={Search} title="No matches" description="No country in this budget has that name." />
      )}
      {!searching && capped.length > COLLAPSED_ROWS && (
        <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
          {open ? "Show less" : `Show all ${capped.length}`}
        </Button>
      )}
    </div>
  );
}
