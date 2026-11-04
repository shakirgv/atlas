import Link from "next/link";
import type { CityVM } from "@/lib/data";
import { fmtRange } from "@/lib/dates";
import { pluralize } from "@/lib/utils";
import { FlagChip } from "@/components/common/flag";

const COLUMNS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_5.5rem_8rem]";

/** The compact view: one line per city, for scanning a long route. */
export function CitiesList({ cities, placeCounts, dayCounts }: { cities: CityVM[]; placeCounts: Record<string, number>; dayCounts: Record<string, number> }) {
  return (
    <div className="card overflow-hidden" data-testid="cities-list">
      <div aria-hidden className={`hidden gap-x-4 border-b border-border px-4 py-2.5 text-xs uppercase tracking-wider text-muted md:grid ${COLUMNS}`}>
        <span>City</span>
        <span>Country</span>
        <span>Dates</span>
        <span>Places</span>
        <span>Itinerary</span>
      </div>
      <ul className="divide-y divide-border">
        {cities.map((c) => (
          <li key={c.id}>
            <Link href={`/cities/${c.id}`} className={`grid grid-cols-1 items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-ink/[0.03] md:py-2.5 ${COLUMNS}`}>
              <span className="truncate font-medium">{c.name}</span>
              <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
                <FlagChip code={c.country_code} size="sm" />
                <span className="truncate">{c.country_name}</span>
              </span>
              <span className="num flex flex-wrap gap-x-3 text-sm text-muted md:contents">
                <span>{fmtRange(c.arrive_date, c.depart_date)}</span>
                <span>{pluralize(placeCounts[c.id] ?? 0, "place")}</span>
                <span>{pluralize(dayCounts[c.id] ?? 0, "itinerary day")}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
