"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { browserTimeZone, formatHourDiff, formatLocalDay, formatLocalTime, offsetMinutesAt, zoneCity } from "@/lib/timezones";

export type TimeTileData = {
  homeTz: string | null;
  homeName: string | null;
  current: { name: string; tz: string } | null;
  next: { name: string; tz: string; arrive: string | null } | null;
};

/** Home time, current stop and next stop local time. Re-renders every minute. */
export function TimeTile({ data }: { data: TimeTileData }) {
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

  const homeTz = data.homeTz ?? (now ? browserTimeZone() : null);
  const homeName = data.homeName ?? (homeTz ? zoneCity(homeTz) : "Home");
  const rows: { label: string; name: string; tz: string }[] = [];
  if (data.current) rows.push({ label: "Now in", name: data.current.name, tz: data.current.tz });
  if (data.next && data.next.tz !== data.current?.tz) rows.push({ label: "Next", name: data.next.name, tz: data.next.tz });
  const diff = (tz: string) => (homeTz && now ? (offsetMinutesAt(tz, now) - offsetMinutesAt(homeTz, now)) / 60 : 0);

  return (
    <section className="card flex h-full flex-col gap-3 p-5" aria-label="Time">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Clock className="size-5 text-accent" /> Time
      </h2>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-xs text-muted">{r.label}</span>
              <span className="block truncate font-medium">{r.name}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="num block font-display text-[26px] font-semibold leading-none">{now ? formatLocalTime(r.tz, now) : "--:--"}</span>
              <span className="num block text-xs text-muted">
                {now ? `${formatLocalDay(r.tz, now)} · ${formatHourDiff(diff(r.tz))} from ${homeName}` : " "}
              </span>
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 border-t border-border pt-2.5">
          <span className="min-w-0">
            <span className="block text-xs text-muted">Home</span>
            <span className="block truncate text-sm font-medium">{homeName}</span>
          </span>
          <span className="num shrink-0 font-display text-lg font-semibold">{now && homeTz ? formatLocalTime(homeTz, now) : "--:--"}</span>
        </li>
      </ul>
    </section>
  );
}
