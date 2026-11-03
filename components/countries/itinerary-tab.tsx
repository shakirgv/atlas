"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, CalendarRange, ChevronDown } from "lucide-react";
import { durationLabel, fmtDate, fmtTime } from "@/lib/dates";
import { groupDaysByCity, stopTime } from "@/lib/itinerary-days";
import { STOP_TYPE_META } from "@/lib/icons";
import type { CityVM, CountryVM, PlaceVM } from "@/lib/data";
import type { ItineraryDay, ItineraryItem, StopType } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { setUrlParam, useOpenSections } from "@/hooks/use-open-sections";
import { EmptyState } from "@/components/common/empty-state";
import { SectionTitle } from "@/components/common/page-header";
import { GenerateDaysButton } from "@/components/itinerary/generate-days-button";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/misc";

type Grouping = "day" | "city";

function DayRow({ day, stops, cityName, places, plannerHref, open, onToggle }: { day: ItineraryDay; stops: ItineraryItem[]; cityName: string | null; places: PlaceVM[]; plannerHref: string; open: boolean; onToggle: () => void }) {
  const panelId = `day-${day.id}`;
  return (
    <li>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left hover:bg-ink/[0.03]">
        <span className="flex w-12 shrink-0 flex-col items-center">
          <span className="text-[11px] uppercase tracking-wider text-muted">Day</span>
          <span className="num font-display text-2xl font-semibold leading-none">{day.day_number}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{day.title ?? cityName ?? "Untitled day"}</span>
          <span className="truncate text-xs text-muted">
            {day.date ? fmtDate(day.date, "EEE, dd MMM") : "No date"} · {pluralize(stops.length, "stop")}
            {stops[0] ? ` · ${[fmtTime(stops[0].start_time), stops[0].title].filter(Boolean).join(" ")}` : ""}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={panelId} className="flex flex-col gap-3 border-t border-border bg-surface-2/60 px-4 py-3 sm:pl-20">
          {day.notes && <p className="whitespace-pre-wrap break-words text-sm text-muted">{day.notes}</p>}
          {stops.length ? (
            <ol className="flex flex-col gap-2.5">
              {stops.map((s) => {
                const meta = STOP_TYPE_META[s.type as StopType] ?? STOP_TYPE_META.activity;
                const place = places.find((p) => p.id === s.place_id);
                return (
                  <li key={s.id} className="flex items-start gap-3 text-sm">
                    <span className="num w-24 shrink-0 pt-px text-xs text-muted">{stopTime(s.start_time, s.end_time) || "Any time"}</span>
                    <meta.icon className="mt-0.5 size-4 shrink-0" style={{ color: meta.color }} aria-label={meta.label} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("break-words font-medium", s.done && "text-muted line-through")}>{s.title}</span>
                      {place && place.name !== s.title && <span className="truncate text-xs text-muted">{place.name}</span>}
                      {s.notes && <span className="whitespace-pre-wrap break-words text-xs text-muted">{s.notes}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted">No stops yet.</p>
          )}
          <Link href={plannerHref} className="inline-flex min-h-9 items-center gap-1 self-start text-xs font-medium text-accent hover:underline">
            Edit in planner <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </li>
  );
}

/** A read-through of the plan: days open in place to show their stops, and the planner stays the place to edit them. */
export function ItineraryTab({ country, cities, days, items, places }: { country: CountryVM; cities: CityVM[]; days: ItineraryDay[]; items: ItineraryItem[]; places: PlaceVM[] }) {
  const params = useSearchParams();
  const [grouping, setGrouping] = useState<Grouping>(params.get("group") === "city" ? "city" : "day");
  const { open, toggle } = useOpenSections();
  const hasDates = Boolean(country.arrive_date && country.depart_date);
  const changeGrouping = (next: Grouping) => {
    setGrouping(next);
    setUrlParam("group", next === "city" ? "city" : null);
  };
  const row = (d: ItineraryDay, cityName: string | null) => (
    <DayRow
      key={d.id}
      day={d}
      stops={items.filter((i) => i.day_id === d.id)}
      cityName={cityName}
      places={places}
      plannerHref={`/itinerary?country=${country.id}&day=${d.id}`}
      open={open.has(d.id)}
      onToggle={() => toggle(d.id)}
    />
  );
  return (
    <>
      <SectionTitle
        className="flex-col items-start sm:flex-row sm:items-center"
        action={
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {days.length > 0 && cities.length > 0 && (
              <Segmented
                value={grouping}
                onChange={changeGrouping}
                options={[
                  { value: "day", label: "By day", icon: <CalendarRange /> },
                  { value: "city", label: "By city", icon: <Building2 /> },
                ]}
              />
            )}
            <GenerateDaysButton countryId={country.id} hasDates={hasDates} variant="secondary" />
            {days.length > 0 && (
              <Button size="md" asChild>
                <Link href={`/itinerary?country=${country.id}`}>
                  Open planner <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        }
      >
        {durationLabel(country.arrive_date, country.depart_date, days.length)}
      </SectionTitle>
      {!days.length ? (
        <EmptyState icon={CalendarDays} title="No days yet" description={country.arrive_date ? "Generate one day per date, then fill them with stops." : "Set the country dates first, or create blank days."} action={<GenerateDaysButton countryId={country.id} hasDates={hasDates} />} />
      ) : grouping === "city" ? (
        <div className="flex flex-col gap-5">
          {groupDaysByCity(days, cities).map((g) => (
            <section key={g.cityId ?? "none"} aria-label={g.name}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="truncate font-semibold">{g.name}</h3>
                <span className="num shrink-0 text-xs text-muted">{pluralize(g.days.length, "day")}</span>
              </div>
              <ol className="card divide-y divide-border">{g.days.map((d) => row(d, g.cityId ? g.name : null))}</ol>
            </section>
          ))}
        </div>
      ) : (
        <ol className="card divide-y divide-border">{days.map((d) => row(d, cities.find((c) => c.id === d.city_id)?.name ?? null))}</ol>
      )}
    </>
  );
}
