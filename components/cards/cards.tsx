import { Building2, CalendarDays, MapPin, Plane } from "lucide-react";
import { PhotoCard } from "@/components/common/photo-card";
import { GeoStatusChip, TripStatusChip } from "@/components/common/status-chip";
import { fmtRange } from "@/lib/dates";
import type { CityVM, CountryVM } from "@/lib/data";
import type { Trip, TripStatus } from "@/lib/types";
import { pluralize } from "@/lib/utils";

export function TripCard({
  trip,
  coverUrl,
  flags,
  countryCount,
  progress,
}: {
  trip: Trip;
  coverUrl: string | null;
  flags: string[];
  countryCount: number;
  progress: number;
}) {
  return (
    <PhotoCard
      href={`/trips/${trip.id}`}
      title={trip.title}
      subtitle={fmtRange(trip.start_date, trip.end_date)}
      coverUrl={coverUrl}
      seed={trip.id}
      fallbackIcon={Plane}
      topLeft={
        flags.length ? (
          <span className="inline-flex h-8 items-center gap-0.5 rounded-full bg-white/85 px-2 text-base shadow-sm backdrop-blur">
            {flags.slice(0, 5).join("")}
            {flags.length > 5 && <span className="ml-1 text-xs font-medium text-ink">+{flags.length - 5}</span>}
          </span>
        ) : undefined
      }
      status={<TripStatusChip status={trip.status as TripStatus} onPhoto />}
      footer={
        <div className="flex items-center justify-between gap-3 text-muted">
          <span>{pluralize(countryCount, "country", "countries")}</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
            <span className="num text-xs">{Math.round(progress * 100)}%</span>
          </span>
        </div>
      }
    />
  );
}

export function CountryCard({ c, cityCount, dayCount, showTrip }: { c: CountryVM; cityCount: number; dayCount: number; showTrip?: boolean }) {
  return (
    <PhotoCard
      href={`/countries/${c.id}`}
      title={c.name}
      subtitle={fmtRange(c.arrive_date, c.depart_date)}
      coverUrl={c.cover_url}
      seed={c.code}
      countryCode={c.code}
      fallbackFlag={c.flag}
      status={<GeoStatusChip status={c.display} onPhoto />}
      footer={
        <div className="flex items-center gap-4 text-muted">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5" /> {pluralize(cityCount, "city", "cities")}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> {pluralize(dayCount, "day")}
          </span>
          {showTrip && <span className="ml-auto truncate text-xs">{c.trip_title}</span>}
        </div>
      }
    />
  );
}

export function CityCard({ c, placeCount, dayCount }: { c: CityVM; placeCount: number; dayCount: number }) {
  return (
    <PhotoCard
      href={`/cities/${c.id}`}
      title={c.name}
      subtitle={
        <span>
          {c.country_name}
          {c.arrive_date ? ` · ${fmtRange(c.arrive_date, c.depart_date)}` : ""}
        </span>
      }
      coverUrl={c.cover_url}
      seed={c.id}
      countryCode={c.country_code}
      fallbackIcon={Building2}
      status={<GeoStatusChip status={c.display} onPhoto />}
      footer={
        <div className="flex items-center gap-4 text-muted">
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {pluralize(placeCount, "place")}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> {pluralize(dayCount, "day")}
          </span>
        </div>
      }
    />
  );
}
