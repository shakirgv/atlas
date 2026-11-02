"use client";
import { useState } from "react";
import { CloudOff, CloudSun, Star } from "lucide-react";
import { CLIMATE_LABEL, climateKey, isBestMonth, MONTH_NAMES, monthsInStay, verdictForStay, verdictReason, type ClimateMonth } from "@/lib/climate";
import { useClimate } from "@/hooks/use-climate";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/misc";
import { VerdictChip } from "./verdict-chip";

const pct = (v: number, lo: number, hi: number) => ((v - lo) / (hi - lo)) * 100;

/** Twelve months as two small panels on a shared month axis: temperature range above, rain below. */
export function ClimateChart({ months, planned }: { months: ClimateMonth[]; planned: number[] }) {
  const [active, setActive] = useState<number | null>(null);
  const lo = Math.floor(Math.min(...months.map((m) => m.tmin)) / 5) * 5;
  const hi = Math.ceil(Math.max(...months.map((m) => m.tmax)) / 5) * 5;
  const span = hi - lo || 5;
  const top = lo + span;
  const step = span <= 15 ? 5 : span <= 30 ? 10 : 20;
  const ticks = Array.from({ length: Math.floor(span / step) + 1 }, (_, i) => lo + i * step);
  const maxRain = Math.max(1, ...months.map((m) => m.precip));
  const hottest = months.reduce((a, b) => (b.tmax > a.tmax ? b : a)).month;
  const coldest = months.reduce((a, b) => (b.tmin < a.tmin ? b : a)).month;
  const hasPlan = planned.length > 0;
  const on = active != null ? months.find((m) => m.month === active) : null;

  const column = (m: ClimateMonth, children: React.ReactNode) => (
    <button
      key={m.month}
      type="button"
      className="relative h-full min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={verdictReason(m)}
      onMouseEnter={() => setActive(m.month)}
      onFocus={() => setActive(m.month)}
      onClick={() => setActive(m.month)}
    >
      {planned.includes(m.month) && <span className="absolute inset-0 rounded-md bg-accent-soft" />}
      {active === m.month && <span className="absolute inset-0 rounded-md bg-ink/5 dark:bg-white/5" />}
      {children}
    </button>
  );

  return (
    <div onMouseLeave={() => setActive(null)} className="relative">
      <p className="text-xs text-muted">Temperature range, °C</p>
      <div className="relative mt-5 h-36 pl-7">
        {ticks.map((tick) => (
          <div key={tick} className="absolute inset-x-0 flex items-center" style={{ bottom: `${pct(tick, lo, top)}%` }}>
            <span className="num w-7 -translate-y-1/2 pr-1.5 text-right text-[10px] leading-none text-muted">{Math.round(tick)}</span>
            <span className="-translate-y-1/2 h-px flex-1 bg-border" />
          </div>
        ))}
        <div className="absolute inset-y-0 left-7 right-0 grid grid-cols-12">
          {months.map((m) =>
            column(
              m,
              <>
                <span
                  className={cn("absolute left-1/2 w-2 -translate-x-1/2 rounded-[4px] bg-accent sm:w-2.5", hasPlan && !planned.includes(m.month) && "opacity-40")}
                  style={{ bottom: `${pct(m.tmin, lo, top)}%`, top: `${100 - pct(m.tmax, lo, top)}%` }}
                />
                {(m.month === hottest || planned.includes(m.month)) && (
                  <span className="num absolute inset-x-0 text-center text-[10px] font-medium leading-none" style={{ bottom: `calc(${pct(m.tmax, lo, top)}% + 3px)` }}>
                    {Math.round(m.tmax)}
                  </span>
                )}
                {m.month === coldest && (
                  <span className="num absolute inset-x-0 text-center text-[10px] font-medium leading-none" style={{ top: `calc(${100 - pct(m.tmin, lo, top)}% + 3px)` }}>
                    {Math.round(m.tmin)}
                  </span>
                )}
              </>,
            ),
          )}
        </div>
      </div>

      <p className="mb-1.5 mt-3 text-xs text-muted">Rain, mm per month</p>
      <div className="relative h-12 pl-7">
        <span className="num absolute left-0 top-0 w-7 pr-1.5 text-right text-[10px] leading-none text-muted">{Math.round(maxRain)}</span>
        <span className="absolute inset-x-0 bottom-0 ml-7 h-px bg-border" />
        <div className="absolute inset-y-0 left-7 right-0 grid grid-cols-12">
          {months.map((m) =>
            column(
              m,
              <span
                className={cn("absolute bottom-0 left-1/2 w-2 -translate-x-1/2 rounded-t-[4px] bg-wishlist sm:w-2.5", hasPlan && !planned.includes(m.month) && "opacity-40")}
                style={{ height: `${Math.max(pct(m.precip, 0, maxRain), m.precip > 0 ? 3 : 0)}%` }}
              />,
            ),
          )}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-12 pl-7" aria-hidden>
        {months.map((m) => (
          <span key={m.month} className={cn("flex flex-col items-center text-[11px] leading-tight", planned.includes(m.month) ? "font-semibold text-ink" : "text-muted")}>
            {MONTH_NAMES[m.month - 1]![0]}
            {isBestMonth(m) && <Star className="mt-0.5 size-2.5 fill-visited text-visited" />}
          </span>
        ))}
      </div>

      {on && (
        <div
          className="pointer-events-none absolute top-5 z-10 w-44 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-bg shadow-lg"
          style={{ left: `clamp(0px, calc(${((on.month - 0.5) / 12) * 100}% - 88px + 14px), calc(100% - 176px))` }}
        >
          <p className="font-semibold">{MONTH_NAMES[on.month - 1]}</p>
          <p className="num">
            {on.tmin} to {on.tmax} °C
          </p>
          <p className="num">
            {Math.round(on.precip)} mm · {Math.round(on.wetDays)} wet days
          </p>
        </div>
      )}
    </div>
  );
}

/** City "Climate" card. Presentational: the data comes in, so every state can be previewed. */
export function ClimateCard({ months, loading, arrive, depart, className }: { months: ClimateMonth[] | null | undefined; loading?: boolean; arrive?: string | null; depart?: string | null; className?: string }) {
  const planned = monthsInStay(arrive, depart);
  const verdict = months ? verdictForStay(months, arrive, depart) : null;
  const best = months?.filter(isBestMonth) ?? [];
  return (
    <section className={cn("card p-5", className)} aria-label="Climate">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CloudSun className="size-5 text-accent" /> Climate
          </h2>
          <p className="mt-0.5 text-xs text-muted">{CLIMATE_LABEL}</p>
        </div>
        {verdict && <VerdictChip verdict={verdict.verdict} title={verdictReason(verdict.month)} />}
      </div>
      {months ? (
        <>
          <ClimateChart months={months} planned={planned} />
          <div className="mt-3 flex flex-col gap-1 text-xs text-muted">
            {planned.length > 0 && (
              <p className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-accent-soft ring-1 ring-accent/40" /> Your dates: {planned.map((m) => MONTH_NAMES[m - 1]!.slice(0, 3)).join(", ")}
              </p>
            )}
            {best.length > 0 && (
              <p className="flex items-center gap-1.5">
                <Star className="size-2.5 fill-visited text-visited" /> Best months: {best.map((m) => MONTH_NAMES[m.month - 1]!.slice(0, 3)).join(", ")}
              </p>
            )}
          </div>
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-muted hover:text-ink">See the numbers</summary>
            <table className="num mt-2 w-full text-right">
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-0.5 text-left font-medium">Month</th>
                  <th scope="col" className="font-medium">Low °C</th>
                  <th scope="col" className="font-medium">High °C</th>
                  <th scope="col" className="font-medium">Rain mm</th>
                  <th scope="col" className="font-medium">Wet days</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className={cn("border-t border-border", planned.includes(m.month) && "font-semibold")}>
                    <th scope="row" className="py-0.5 text-left font-[inherit]">{MONTH_NAMES[m.month - 1]!.slice(0, 3)}</th>
                    <td>{m.tmin}</td>
                    <td>{m.tmax}</td>
                    <td>{Math.round(m.precip)}</td>
                    <td>{Math.round(m.wetDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : loading ? (
        <Skeleton className="h-52 w-full" />
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-6 text-sm text-muted">
          <CloudOff className="size-4 shrink-0" /> Weather unavailable. It will try again next time.
        </p>
      )}
    </section>
  );
}

/** Climate card that loads its own data for one city. */
export function CityClimateCard({ lat, lng, arrive, depart, className }: { lat: number; lng: number; arrive?: string | null; depart?: string | null; className?: string }) {
  const { data, loading } = useClimate([{ lat, lng }]);
  return <ClimateCard months={data[climateKey(lat, lng)]} loading={loading} arrive={arrive} depart={depart} className={className} />;
}
