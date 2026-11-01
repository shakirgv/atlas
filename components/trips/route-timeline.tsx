"use client";
import { useMemo } from "react";
import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { fmtShort, toDate, todayIso } from "@/lib/dates";
import { GEO_STATUS_META } from "@/lib/status";
import type { CountryVM } from "@/lib/data";
import { Tooltip } from "@/components/ui/tooltip";

/** Countries as a horizontal date bar across the trip's date span. */
export function RouteTimeline({ countries }: { countries: CountryVM[] }) {
  const dated = countries.filter((c) => c.arrive_date && c.depart_date);
  const span = useMemo(() => {
    if (!dated.length) return null;
    const start = dated.map((c) => c.arrive_date!).sort()[0]!;
    const end = dated.map((c) => c.depart_date!).sort().pop()!;
    const total = differenceInCalendarDays(toDate(end)!, toDate(start)!) + 1;
    return { start, end, total };
  }, [dated]);

  if (!span) {
    return <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">Set country dates to see the route on a timeline.</p>;
  }
  const pos = (iso: string) => (differenceInCalendarDays(toDate(iso)!, toDate(span.start)!) / span.total) * 100;
  const today = todayIso();
  const todayPct = today >= span.start && today <= span.end ? pos(today) + 100 / span.total / 2 : null;
  const months: { label: string; pct: number }[] = [];
  const s = toDate(span.start)!;
  const cursor = new Date(s.getFullYear(), s.getMonth() + 1, 1);
  while (cursor <= toDate(span.end)!) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
    months.push({ label: cursor.toLocaleString("en-US", { month: "short" }), pct: pos(iso) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-14 rounded-xl bg-surface-2 ring-1 ring-border">
        {months.map((m) => (
          <div key={m.label + m.pct} className="absolute inset-y-0 border-l border-dashed border-border" style={{ left: `${m.pct}%` }}>
            <span className="absolute -top-5 -translate-x-1/2 text-[11px] text-muted">{m.label}</span>
          </div>
        ))}
        {dated.map((c) => {
          const left = pos(c.arrive_date!);
          const width = ((differenceInCalendarDays(toDate(c.depart_date!)!, toDate(c.arrive_date!)!) + 1) / span.total) * 100;
          const meta = GEO_STATUS_META[c.display];
          return (
            <Tooltip key={c.id} content={`${c.name} · ${fmtShort(c.arrive_date)} – ${fmtShort(c.depart_date)} · ${meta.label}`}>
              <Link
                href={`/countries/${c.id}`}
                className="absolute inset-y-2 flex items-center gap-1 overflow-hidden rounded-lg px-1.5 text-xs font-medium text-ink ring-1 ring-black/5 transition-transform hover:-translate-y-0.5"
                style={{ left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)`, background: meta.soft, borderLeft: `3px solid ${meta.color}` }}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="truncate max-sm:hidden">{c.name}</span>
              </Link>
            </Tooltip>
          );
        })}
        {todayPct !== null && (
          <div className="absolute -inset-y-1.5 w-0.5 rounded-full bg-accent" style={{ left: `${todayPct}%` }} aria-label="Today">
            <span className="absolute -bottom-5 -translate-x-1/2 text-[11px] font-medium text-accent">Today</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted">
        <span>{fmtShort(span.start)}</span>
        <span className="num">{span.total} days</span>
        <span>{fmtShort(span.end)}</span>
      </div>
    </div>
  );
}
