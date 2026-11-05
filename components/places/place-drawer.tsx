"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CalendarPlus, ChevronRight, Clock, ExternalLink, Loader2, MapPin, Navigation, Pencil, Star, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { deletePlace, schedulePlace, setPlaceRating, setPlaceStatus } from "@/actions/places";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PlaceVM } from "@/lib/data";
import { directionsUrl, hasPin, stopTimeLabel, suggestedDay } from "@/lib/place-list";
import { PLACE_STATUSES, type PhotoView, type PlaceCategory, type PlaceStatus } from "@/lib/types";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import { PLACE_STATUS_META } from "@/lib/status";
import { cn, gradientFor } from "@/lib/utils";
import { Cover } from "@/components/common/cover";
import { CoverActions } from "@/components/cover/cover-actions";
import { Markdown } from "@/components/common/markdown";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { InlineConfirmButton } from "@/components/ui/confirm";
import { Input, NativeSelect } from "@/components/ui/input";

export type PlaceStop = {
  id: string;
  title: string;
  day_number: number;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  trip_country_id: string;
  day_id: string;
};

/** A day of the place's own country, offered by Add to itinerary. */
export type PlaceDayOption = { id: string; day_number: number; date: string | null; city_id: string | null; city_name: string; title: string | null };

const dayHref = (countryId: string, dayId: string) => `/itinerary?country=${countryId}&day=${dayId}`;

function dayLabel(d: { day_number: number; date: string | null }) {
  return `Day ${d.day_number}${d.date ? ` · ${fmtDate(d.date, "EEE d MMM")}` : ""}`;
}

function AddToItinerary({ place, days, country, onDone }: { place: PlaceVM; days: PlaceDayOption[]; country: { id: string; name: string } | null; onDone: () => void }) {
  const router = useRouter();
  const [dayId, setDayId] = useState(() => suggestedDay(days, place.city_id)?.id ?? "");
  const [time, setTime] = useState("");
  const [pending, start] = useTransition();
  if (!country || !days.length) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3 text-sm" data-testid="add-to-itinerary">
        <p className="text-muted">{country?.name ? `${country.name} has no itinerary days yet.` : "This country has no itinerary days yet."} Create them in the planner, then schedule this place.</p>
        {country && (
          <Button asChild size="sm" variant="secondary" className="self-start">
            <Link href={`/itinerary?country=${country.id}`}>
              Open the planner <ChevronRight />
            </Link>
          </Button>
        )}
      </div>
    );
  }
  const submit = () =>
    start(async () => {
      const res = await schedulePlace(place.id, dayId, time || null);
      if (!res.ok) return void toast.error(res.error);
      const day = days.find((d) => d.id === dayId)!;
      toast.success(`Added to ${dayLabel(day)}`, { action: { label: "Open day", onClick: () => router.push(dayHref(country.id, day.id)) } });
      onDone();
    });
  return (
    <form
      className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-2 p-3"
      data-testid="add-to-itinerary"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-[13px] font-medium">
          Day
          <NativeSelect value={dayId} onChange={(e) => setDayId(e.target.value)} aria-label="Day">
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {dayLabel(d)}
                {d.city_name ? ` · ${d.city_name}` : ""}
                {d.city_id === place.city_id ? " ★" : ""}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Time <span className="sr-only">(optional)</span>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Start time, optional" />
        </label>
      </div>
      <p className="text-xs text-muted">★ Days in {place.city_name || "this city"}. The time is optional.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || !dayId}>
          {pending && <Loader2 className="animate-spin" />} Add to day
        </Button>
      </div>
    </form>
  );
}

export function PlaceDrawerContent({
  place,
  photos,
  attribution,
  stops,
  days = [],
  country = null,
  onEdit,
  onDeleted,
}: {
  place: PlaceVM;
  photos: PhotoView[];
  attribution: string | null;
  stops: PlaceStop[];
  days?: PlaceDayOption[];
  country?: { id: string; name: string } | null;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  const [scheduling, setScheduling] = useState(false);
  const meta = PLACE_CATEGORY_META[place.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
  const pinned = hasPin(place);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Failed");
    });

  const details = [
    place.address && { icon: MapPin, key: "address", body: <dd>{place.address}</dd> },
    place.opening_hours && { icon: Clock, key: "hours", body: <dd>{place.opening_hours}</dd> },
    place.cost_estimate != null && { icon: Wallet, key: "cost", body: <dd className="num">≈ {formatMoney(Number(place.cost_estimate), place.cost_currency ?? "USD")}</dd> },
    place.url && {
      icon: ExternalLink,
      key: "link",
      body: (
        <dd className="min-w-0">
          <a href={place.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">
            {place.url.replace(/^https?:\/\//, "")}
          </a>
        </dd>
      ),
    },
  ].filter(Boolean) as { icon: typeof MapPin; key: string; body: React.ReactNode }[];

  return (
    <div className="flex flex-col">
      {place.cover_url ? (
        <Cover src={place.cover_url} alt={place.name} seed={place.id} icon={meta.icon} eager className="aspect-[16/10] shrink-0">
          <div className="photo-gradient absolute inset-0" />
          <div className="absolute left-4 top-4 md:right-14 md:left-auto">
            <CoverActions kind="place" id={place.id} attribution={attribution} />
          </div>
          <div className="absolute inset-x-5 bottom-4 text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-medium backdrop-blur">
              <meta.icon className="size-3.5" /> {meta.label}
            </span>
            <h2 className="mt-2 text-[30px] font-semibold leading-tight">{place.name}</h2>
            {place.city_name && <p className="text-sm text-white/85">{place.city_name}</p>}
          </div>
        </Cover>
      ) : (
        // No photo yet: a compact header, so the details start near the top instead of under a placeholder.
        <div className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-6 md:pr-14" data-testid="place-compact-header">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: gradientFor(place.id) }}>
            <meta.icon className="size-5 text-white/90" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <meta.icon className="size-3.5" style={{ color: meta.color }} /> {meta.label}
              {place.city_name ? ` · ${place.city_name}` : ""}
            </p>
            <h2 className="break-words text-2xl font-semibold leading-tight">{place.name}</h2>
          </div>
          <div className="shrink-0 [&_button]:bg-black/55 [&_button]:hover:bg-black/70">
            <CoverActions kind="place" id={place.id} attribution={attribution} />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap gap-2" data-testid="place-actions">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            <Pencil /> Edit details
          </Button>
          {pinned && (
            <Button asChild size="sm" variant="secondary">
              <a href={directionsUrl({ lat: place.lat!, lng: place.lng! })} target="_blank" rel="noopener noreferrer">
                <Navigation /> Get directions
              </a>
            </Button>
          )}
          <Button size="sm" variant={scheduling ? "primary" : "secondary"} aria-expanded={scheduling} onClick={() => setScheduling((s) => !s)}>
            <CalendarPlus /> Add to itinerary
          </Button>
        </div>
        {scheduling && <AddToItinerary place={place} days={days} country={country} onDone={() => setScheduling(false)} />}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
            {PLACE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={place.status === s}
                disabled={pending}
                onClick={() => run(() => setPlaceStatus(place.id, s as PlaceStatus))}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                  place.status === s ? "border-transparent text-ink" : "border-border text-muted hover:text-ink",
                )}
                style={place.status === s ? { background: PLACE_STATUS_META[s].soft } : undefined}
              >
                <span className="size-2 rounded-full" style={{ background: PLACE_STATUS_META[s].color }} />
                {PLACE_STATUS_META[s].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={place.rating === n} aria-label={`${n} stars`} onClick={() => run(() => setPlaceRating(place.id, place.rating === n ? null : n))} className="grid size-9 place-items-center rounded-lg hover:bg-ink/5">
                <Star className={cn("size-5", (place.rating ?? 0) >= n ? "fill-planned text-planned" : "text-border")} />
              </button>
            ))}
            <span className="ml-2 text-xs text-muted">{place.rating ? `${place.rating}/5` : "Not rated"}</span>
          </div>
        </div>
        {details.length > 0 && (
          <dl className="flex flex-col gap-3 text-sm" data-testid="place-details">
            {details.map((d) => (
              <div key={d.key} className="flex gap-3">
                <d.icon className="mt-0.5 size-4 shrink-0 text-accent" />
                {d.body}
              </div>
            ))}
          </dl>
        )}
        {pinned && <MapView className="h-44 rounded-xl" markers={[{ id: place.id, lat: place.lat!, lng: place.lng!, label: place.name, color: meta.color, glyph: "" }]} zoom={15} />}
        {stops.length > 0 && (
          <div>
            <p className="eyebrow mb-2">In your itinerary</p>
            <ul className="flex flex-col gap-1" data-testid="place-stops">
              {stops.map((s) => {
                const time = stopTimeLabel(s.start_time, s.end_time);
                return (
                  <li key={s.id}>
                    <Link href={dayHref(s.trip_country_id, s.day_id)} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-ink/5" aria-label={`Open ${dayLabel(s)} in the planner`}>
                      <CalendarDays className="size-4 shrink-0 text-accent" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">
                          {dayLabel(s)}
                          {time && <span className="num font-normal text-muted"> · {time}</span>}
                        </span>
                        {s.title !== place.name && <span className="truncate text-xs text-muted">{s.title}</span>}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {place.notes && (
          <div>
            <p className="eyebrow mb-1">Notes</p>
            <Markdown>{place.notes}</Markdown>
          </div>
        )}
        <div>
          <p className="eyebrow mb-2">Photos</p>
          <PhotoGrid photos={photos.filter((p) => p.source === "upload")} entityType="place" entityId={place.id} columns="grid-cols-3 sm:grid-cols-4" />
        </div>
        <div className="flex items-center border-t border-border pt-4">
          <InlineConfirmButton
            icon={<Trash2 />}
            label="Delete place"
            onConfirm={async () => {
              const res = await deletePlace(place.id);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Place deleted");
              onDeleted();
            }}
          />
        </div>
      </div>
    </div>
  );
}
