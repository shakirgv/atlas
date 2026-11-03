"use client";
import Link from "next/link";
import { useTransition } from "react";
import { CircleCheck, Star } from "lucide-react";
import { toast } from "sonner";
import { setPlaceStatus } from "@/actions/places";
import type { PlaceVM } from "@/lib/data";
import type { PlaceCategory, PlaceStatus } from "@/lib/types";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import { cn, gradientFor } from "@/lib/utils";
import { PlaceStatusChip } from "@/components/common/status-chip";
import { Tooltip } from "@/components/ui/tooltip";

export function MarkVisitedButton({ place, className }: { place: { id: string; status: string }; className?: string }) {
  const [pending, start] = useTransition();
  const visited = place.status === "visited";
  return (
    <Tooltip content={visited ? "Mark as not visited" : "Mark visited"}>
      <button
        type="button"
        aria-pressed={visited}
        aria-label={visited ? "Mark as not visited" : "Mark visited"}
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start(async () => {
            const res = await setPlaceStatus(place.id, visited ? "planned" : "visited");
            if (!res.ok) toast.error(res.error);
          });
        }}
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border transition-colors max-md:size-11",
          visited ? "border-visited bg-visited text-white" : "border-border bg-surface text-muted hover:border-visited hover:text-visited",
          pending && "opacity-60",
          className,
        )}
      >
        <CircleCheck className="size-[18px]" />
      </button>
    </Tooltip>
  );
}

export function PlaceThumb({ place, className }: { place: Pick<PlaceVM, "id" | "cover_url" | "category" | "name">; className?: string }) {
  const meta = PLACE_CATEGORY_META[place.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
  return (
    <span className={cn("relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl", className)} style={place.cover_url ? undefined : { background: gradientFor(place.id) }}>
      {place.cover_url ? <img src={place.cover_url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : <meta.icon className="size-5 text-white/90" />}
    </span>
  );
}

export function PlaceRow({ place, href, flagged }: { place: PlaceVM; href?: string; flagged?: boolean }) {
  const meta = PLACE_CATEGORY_META[place.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
  return (
    <Link href={href ?? `/places?open=${place.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]">
      <PlaceThumb place={place} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{place.name}</span>
        <span className="flex items-center gap-1.5 truncate text-xs text-muted">
          <meta.icon className="size-3.5" style={{ color: meta.color }} /> {meta.label} · {place.city_name}
          {place.rating ? (
            <span className="flex items-center gap-0.5">
              · <Star className="size-3 fill-planned text-planned" /> {place.rating}
            </span>
          ) : null}
        </span>
      </span>
      {flagged && <span className="shrink-0 rounded-full bg-planned-soft px-2 py-0.5 text-[11px] font-medium text-ink">Possible duplicate</span>}
      <PlaceStatusChip status={place.status as PlaceStatus} size="sm" className="max-sm:hidden" />
      <MarkVisitedButton place={place} />
    </Link>
  );
}
