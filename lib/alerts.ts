import { addMonths } from "date-fns";
import { daysUntil, fmtDate, isoDate, todayIso, toDate } from "@/lib/dates";
import type { CountryVM } from "@/lib/data";
import type { DocumentRow, Expense, Trip } from "@/lib/types";

export type Alert = { id: string; level: "danger" | "warning" | "info"; title: string; detail: string; href: string; kind: "passport" | "document" | "dates" | "budget" };

/** Passport must be valid 6 months after a trip's end date. */
export function passportWarnings(documents: DocumentRow[], trips: Trip[]): Alert[] {
  const today = todayIso();
  const out: Alert[] = [];
  for (const p of documents.filter((d) => d.type === "passport" && d.expiry_date)) {
    for (const t of trips.filter((t) => t.end_date && t.end_date >= today && t.status !== "completed")) {
      const needed = isoDate(addMonths(toDate(t.end_date)!, 6));
      if (p.expiry_date! < needed) {
        out.push({
          id: `passport-${p.id}-${t.id}`,
          level: "danger",
          kind: "passport",
          title: `${p.title} expires too soon for ${t.title}`,
          detail: `Expires ${fmtDate(p.expiry_date)} — many countries require 6 months after ${fmtDate(t.end_date)}.`,
          href: `/documents?open=${p.id}`,
        });
      }
    }
  }
  return out;
}

export function buildAlerts({ documents, trips, countries, expenses }: { documents: DocumentRow[]; trips: Trip[]; countries: CountryVM[]; expenses: Expense[] }): Alert[] {
  const alerts: Alert[] = [...passportWarnings(documents, trips)];
  for (const d of documents) {
    const n = daysUntil(d.expiry_date);
    if (n === null || n >= 90) continue;
    alerts.push({
      id: `doc-${d.id}`,
      level: n < 30 ? "danger" : "warning",
      kind: "document",
      title: n < 0 ? `${d.title} has expired` : `${d.title} expires in ${n} day${n === 1 ? "" : "s"}`,
      detail: `Expiry date ${fmtDate(d.expiry_date)}`,
      href: `/documents?open=${d.id}`,
    });
  }
  const undated = countries.filter((c) => c.status !== "visited" && (!c.arrive_date || !c.depart_date));
  if (undated.length) {
    alerts.push({
      id: "undated",
      level: "info",
      kind: "dates",
      title: undated.length === 1 ? `${undated[0]!.flag} ${undated[0]!.name} has no dates` : `${undated.length} countries have no dates`,
      detail: undated.slice(0, 4).map((c) => c.name).join(", ") + (undated.length > 4 ? "…" : ""),
      href: `/countries/${undated[0]!.id}?edit=1`,
    });
  }
  for (const c of countries) {
    const cap = Number(c.budget ?? 0);
    if (!cap) continue;
    const spent = expenses.filter((e) => e.trip_country_id === c.id && e.kind === "actual").reduce((s, e) => s + Number(e.amount_base), 0);
    if (spent > cap) {
      alerts.push({ id: `budget-${c.id}`, level: "warning", kind: "budget", title: `${c.flag} ${c.name} is over budget`, detail: `${Math.round((spent / cap) * 100)}% of the cap spent`, href: `/countries/${c.id}?tab=budget` });
    }
  }
  const rank = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => rank[a.level] - rank[b.level]);
}
