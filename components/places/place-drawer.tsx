"use client";
import { useTransition } from "react";
import Link from "next/link";
import { CalendarDays, Clock, ExternalLink, MapPin, Pencil, Star, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { deletePlace, setPlaceRating, setPlaceStatus } from "@/actions/places";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { PlaceVM } from "@/lib/data";
import { PLACE_STATUSES, type PhotoView, type PlaceCategory, type PlaceStatus } from "@/lib/types";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import { PLACE_STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Cover } from "@/components/common/cover";
import { CoverActions } from "@/components/cover/cover-actions";
import { Markdown } from "@/components/common/markdown";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { InlineConfirmButton } from "@/components/ui/confirm";

export type PlaceStop = { id: string; title: string; day_number: number; date: string | null; trip_country_id: string; day_id: string };

export function PlaceDrawerContent({
  place,
  photos,
  attribution,
  stops,
  onEdit,
  onDeleted,
}: {
  place: PlaceVM;
  photos: PhotoView[];
  attribution: string | null;
  stops: PlaceStop[];
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [pending, start] = useTransition();
  const meta = PLACE_CATEGORY_META[place.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Failed");
    });

  return (
    <div className="flex flex-col">
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
      <div className="flex flex-col gap-5 p-5">
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
        <dl className="flex flex-col gap-3 text-sm">
          {place.address && (
            <div className="flex gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
              <dd>{place.address}</dd>
            </div>
          )}
          {place.opening_hours && (
            <div className="flex gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-accent" />
              <dd>{place.opening_hours}</dd>
            </div>
          )}
          {place.cost_estimate != null && (
            <div className="flex gap-3">
              <Wallet className="mt-0.5 size-4 shrink-0 text-accent" />
              <dd className="num">≈ {formatMoney(Number(place.cost_estimate), place.cost_currency ?? "USD")}</dd>
            </div>
          )}
          {place.url && (
            <div className="flex gap-3">
              <ExternalLink className="mt-0.5 size-4 shrink-0 text-accent" />
              <dd>
                <a href={place.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">
                  {place.url.replace(/^https?:\/\//, "")}
                </a>
              </dd>
            </div>
          )}
        </dl>
        {place.lat != null && place.lng != null && (
          <MapView className="h-44 rounded-xl" markers={[{ id: place.id, lat: place.lat, lng: place.lng, label: place.name, color: meta.color, glyph: "" }]} zoom={15} />
        )}
        {stops.length > 0 && (
          <div>
            <p className="eyebrow mb-2">In your itinerary</p>
            <ul className="flex flex-col gap-1">
              {stops.map((s) => (
                <li key={s.id}>
                  <Link href={`/itinerary?country=${s.trip_country_id}&day=${s.day_id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/5">
                    <CalendarDays className="size-4 text-accent" /> Day {s.day_number}
                    {s.date ? ` · ${fmtDate(s.date)}` : ""} — {s.title}
                  </Link>
                </li>
              ))}
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
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          <InlineConfirmButton
            icon={<Trash2 />}
            onConfirm={async () => {
              const res = await deletePlace(place.id);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Place deleted");
              onDeleted();
            }}
          />
          <Button variant="secondary" onClick={onEdit}>
            <Pencil /> Edit details
          </Button>
        </div>
      </div>
    </div>
  );
}
