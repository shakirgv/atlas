"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { fmtRange } from "@/lib/dates";
import { REQUIREMENT_META, type EntryRow } from "@/lib/entry";
import { FilterChip } from "@/components/ui/misc";
import { EmptyState } from "@/components/common/empty-state";
import { EntryReadyChip, EntryStatusChip, EntryWarningChip } from "./entry-chips";

type Filter = "all" | "attention" | "ready" | "to_apply" | "applied";

const FILTERS: { value: Filter; label: string; test: (r: EntryRow) => boolean }[] = [
  { value: "all", label: "All", test: () => true },
  { value: "attention", label: "Needs attention", test: (r) => r.warnings.some((w) => w.level !== "info") },
  { value: "ready", label: "Ready", test: (r) => r.ready },
  { value: "to_apply", label: "To apply", test: (r) => r.status === "to_apply" },
  { value: "applied", label: "Applied", test: (r) => r.status === "applied" },
];

/** Documents tab "Visas & entry": every trip country, most urgent first (the order comes from `entryOverview`). */
export function EntryTable({ rows, showTrip }: { rows: EntryRow[]; showTrip?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  if (!rows.length) {
    return <EmptyState icon={ShieldCheck} title="No countries yet" description="Add countries to a trip to track what you need to enter each one." />;
  }
  const active = FILTERS.find((f) => f.value === filter)!;
  const visible = rows.filter(active.test);
  return (
    <div className="flex flex-col gap-4">
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Filter countries">
        {FILTERS.map((f) => (
          <FilterChip key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label} <span className="num text-xs opacity-60">{rows.filter(f.test).length}</span>
          </FilterChip>
        ))}
      </div>
      {visible.length ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="hidden border-b border-border text-left text-xs text-muted md:table-header-group">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Country</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Dates</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Requirement</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Status</th>
                <th scope="col" className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r) => (
                <tr key={r.tripCountryId} className="relative flex flex-col gap-1.5 px-4 py-3 hover:bg-ink/[0.03] md:table-row md:p-0 dark:hover:bg-white/[0.03]">
                  <td className="md:px-4 md:py-3">
                    <Link href={`/countries/${r.tripCountryId}?tab=entry`} className="flex items-center gap-2.5 font-medium after:absolute after:inset-0">
                      <span className="text-xl leading-none">{r.flag}</span>
                      <span className="min-w-0">
                        <span className="block truncate">{r.name}</span>
                        {showTrip && <span className="block truncate text-xs font-normal text-muted">{r.tripTitle}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="text-xs text-muted md:px-2 md:py-3 md:text-sm md:text-ink">{fmtRange(r.arrive, r.depart)}</td>
                  <td className="text-xs text-muted md:px-2 md:py-3 md:text-sm md:text-ink">{REQUIREMENT_META[r.type].label}</td>
                  <td className="md:px-2 md:py-3">
                    <span className="flex flex-wrap gap-1">
                      <EntryStatusChip status={r.status} />
                      {r.ready && <EntryReadyChip />}
                      {r.warnings.map((w) => (
                        <EntryWarningChip key={w.id} warning={w} />
                      ))}
                    </span>
                  </td>
                  <td className="absolute right-3 top-3 md:static md:pr-3">
                    <ChevronRight className="size-4 text-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-muted">Nothing matches this filter.</p>
      )}
    </div>
  );
}
