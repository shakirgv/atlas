"use client";
import { CloudOff, CloudSun } from "lucide-react";
import { CLIMATE_LABEL, climateKey, verdictForStay, verdictReason, type ClimateStop } from "@/lib/climate";
import { useClimate } from "@/hooks/use-climate";
import { Skeleton } from "@/components/ui/misc";
import { VerdictChip } from "./verdict-chip";

/** Country overview: one climate verdict per city that has coordinates and dates. */
export function CityVerdicts({ stops }: { stops: ClimateStop[] }) {
  const { data, loading, failed } = useClimate(stops);
  if (!stops.length) return null;
  return (
    <section className="card p-5" aria-label="Climate on your dates">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <CloudSun className="size-5 text-accent" /> Climate on your dates
      </h2>
      <p className="mb-3 mt-0.5 text-xs text-muted">{CLIMATE_LABEL}</p>
      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <ul className="flex flex-col gap-2">
          {stops.map((s) => {
            const months = data[climateKey(s.lat, s.lng)];
            const v = months ? verdictForStay(months, s.arrive, s.depart) : null;
            return (
              <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{s.name}</span>
                {v ? (
                  <VerdictChip verdict={v.verdict} size="sm" title={verdictReason(v.month)} />
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                    <CloudOff className="size-3.5" /> {failed ? "Unavailable" : "No dates"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
