import Link from "next/link";
import { itineraryProgress, type ItineraryStats } from "@/lib/country-list";
import type { CountryVM } from "@/lib/data";
import { fmtRange } from "@/lib/dates";
import { pluralize } from "@/lib/utils";
import { FlagChip } from "@/components/common/flag";
import { Progress } from "@/components/ui/misc";

const COLUMNS = "md:grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,1.2fr)_5.5rem_minmax(0,1.2fr)]";

/** The compact view: one line per country, for scanning a long route. */
export function CountriesList({ countries, numbers, cityCounts, stats, showTrip }: { countries: CountryVM[]; numbers: Record<string, number>; cityCounts: Record<string, number>; stats: Record<string, ItineraryStats>; showTrip: boolean }) {
  return (
    <div className="card overflow-hidden" data-testid="countries-list">
      <div aria-hidden className={`hidden gap-x-4 border-b border-border px-4 py-2.5 text-xs uppercase tracking-wider text-muted md:grid ${COLUMNS}`}>
        <span>Route</span>
        <span>Country</span>
        <span>Dates</span>
        <span>Cities</span>
        <span>Itinerary</span>
      </div>
      <ul className="divide-y divide-border">
        {countries.map((c) => {
          const progress = itineraryProgress(c, stats[c.id]);
          return (
            <li key={c.id}>
              <Link href={`/countries/${c.id}`} className={`grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-ink/[0.03] md:gap-x-4 md:py-2.5 ${COLUMNS}`}>
                <span className="num text-sm text-muted">
                  <span className="sr-only">Route stop </span>
                  {numbers[c.id]}
                </span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <FlagChip code={c.code} size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{c.name}</span>
                    {showTrip && <span className="truncate text-xs text-muted">{c.trip_title}</span>}
                  </span>
                </span>
                <span className="num col-start-2 flex flex-wrap gap-x-3 text-sm text-muted md:contents">
                  <span>{fmtRange(c.arrive_date, c.depart_date)}</span>
                  <span>{pluralize(cityCounts[c.id] ?? 0, "city", "cities")}</span>
                </span>
                <span className="col-start-2 flex items-center gap-2 md:col-start-auto">
                  {progress.total > 0 ? (
                    <>
                      <Progress className="h-1.5 max-w-24" value={progress.percent} color="var(--visited)" />
                      <span className="num shrink-0 text-xs text-muted">
                        {progress.planned} of {pluralize(progress.total, "day")}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">No days yet</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
