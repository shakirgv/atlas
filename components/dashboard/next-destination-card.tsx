"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import { fmtDate } from "@/lib/dates";
import { HOME_CITY } from "@/lib/next-destination";
import { formatHourDiff, formatLocalDay, formatLocalTime, isValidTimeZone, offsetMinutesAt } from "@/lib/timezones";
import { DestinationWeather, type WeatherStop } from "./weather-tile";

export type NextDestinationData = {
  name: string;
  tz: string | null;
  arrive: string;
  isHome: boolean;
  weather: WeatherStop | null;
};

function ClockRow({ label, name, tz, now, large }: { label: string; name: string; tz: string | null; now: Date | null; large?: boolean }) {
  const known = isValidTimeZone(tz);
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-xs text-muted">{label}</span>
        <span className="block truncate font-medium">{name}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={large ? "num block font-display text-[26px] font-semibold leading-none" : "num block font-display text-lg font-semibold leading-none"}>{now && known ? formatLocalTime(tz, now) : "--:--"}</span>
        <span className="num mt-1 block text-xs text-muted">{now && known ? formatLocalDay(tz, now) : " "}</span>
      </span>
    </li>
  );
}

/** Where the itinerary goes next, its clock against Baku's, and its weather. Re-renders every minute. */
export function NextDestinationCard({ destination }: { destination: NextDestinationData | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    // Align to the next minute boundary, then tick every minute.
    let iv: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(() => {
      tick();
      iv = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(first);
      clearTimeout(align);
      if (iv) clearInterval(iv);
    };
  }, []);

  const away = destination && !destination.isHome ? destination : null;
  const diff = away && now && isValidTimeZone(away.tz) ? (offsetMinutesAt(away.tz, now) - offsetMinutesAt(HOME_CITY.tz, now)) / 60 : null;

  return (
    <section className="card flex h-full flex-col gap-3 p-5" aria-label="Next destination">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Plane className="size-5 text-accent" /> Next destination
        </h2>
        {destination && <p className="mt-0.5 truncate text-xs text-muted">Arriving {fmtDate(destination.arrive, "dd MMM")}</p>}
      </div>
      <ul className="flex flex-col gap-2.5">
        {away && <ClockRow label="Local time" name={away.name} tz={away.tz} now={now} large />}
        <ClockRow label={destination?.isHome ? "Home · Next destination" : "Home"} name={HOME_CITY.name} tz={HOME_CITY.tz} now={now} large={destination?.isHome} />
        {diff !== null && (
          <li className="flex items-baseline justify-between gap-3 border-t border-border pt-2.5 text-sm">
            <span className="text-muted">Time difference</span>
            <span className="num font-medium">{diff === 0 ? `Same time as ${HOME_CITY.name}` : `${formatHourDiff(diff)} from ${HOME_CITY.name}`}</span>
          </li>
        )}
      </ul>
      {destination?.weather && <DestinationWeather stop={destination.weather} />}
      {!destination && (
        <p className="border-t border-border pt-3 text-sm text-muted">
          No upcoming destination.{" "}
          <Link href="/itinerary" className="font-medium text-accent hover:underline">
            Open the itinerary
          </Link>
        </p>
      )}
    </section>
  );
}
