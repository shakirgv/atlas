"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, Images, MapPin, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMemory } from "@/actions/memories";
import type { MemoryVM } from "@/lib/data";
import { fmtDate } from "@/lib/dates";
import { isLongText } from "@/lib/memory-filters";
import { dayHref, dayLabel, placeHref, type LinkDay, type LinkPlace } from "@/lib/memory-links";
import { cn, pluralize } from "@/lib/utils";
import { Markdown } from "@/components/common/markdown";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { ShareDialog } from "@/components/share/share-dialog";
import { useWorkspace } from "@/components/shell/workspace";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type CountryRef = { id: string; name: string; flag: string };
type CityRef = { id: string; name: string };

const chip = "inline-flex h-7 max-w-full items-center gap-1 rounded-full px-2.5 text-xs font-medium";

/** Keeps a landscape photo's shape, up to 16:9; a portrait is cropped square so it doesn't tower over the text. */
function ratio(w: number | null, h: number | null) {
  if (!w || !h) return "4 / 3";
  return String(Math.min(16 / 9, Math.max(1, w / h)));
}

export function MemoryCard({
  m,
  country,
  city,
  place,
  day,
  dayCity,
  highlighted,
  activeTag,
  onEdit,
  onTag,
  onPhotos,
}: {
  m: MemoryVM;
  country?: CountryRef;
  city?: CityRef;
  place?: LinkPlace;
  day?: LinkDay;
  dayCity?: string | null;
  highlighted: boolean;
  activeTag: string;
  onEdit: () => void;
  onTag: (tag: string) => void;
  onPhotos: () => void;
}) {
  const ws = useWorkspace();
  const [sharing, setSharing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const confirm = useConfirm();
  const [, start] = useTransition();
  const main = m.photos[0];
  const long = isLongText(m.body);
  const where = [city?.name, country ? `${country.flag} ${country.name}` : null].filter(Boolean).join(" · ");

  return (
    <article id={`memory-${m.id}`} className={cn("card scroll-mt-28 overflow-hidden transition-shadow", highlighted && "ring-2 ring-accent")}>
      {main && (
        <button type="button" onClick={onPhotos} className="group relative block w-full overflow-hidden bg-surface-2" style={{ aspectRatio: ratio(main.width, main.height) }} aria-label={m.photos.length > 1 ? `Open ${m.photos.length} photos` : "Open photo"}>
          {main.thumb_url && <img src={main.url ?? main.thumb_url} alt={main.caption ?? m.title ?? ""} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />}
          {m.photos.length > 1 && (
            <span className="absolute bottom-3 right-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-black/55 px-2.5 text-xs font-medium text-white backdrop-blur" data-testid="more-photos">
              <Images className="size-3.5" /> +{pluralize(m.photos.length - 1, "photo")}
            </span>
          )}
        </button>
      )}
      <div className="flex flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">
              {fmtDate(m.date, "EEEE, dd MMM yyyy")}
              {m.mood ? <span className="ml-1.5 text-base">{m.mood}</span> : null}
            </p>
            {m.title && <h3 className="mt-0.5 text-[22px] font-semibold leading-tight">{m.title}</h3>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label="Memory actions">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSharing(true)}>
                <Share2 /> Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={async () => {
                  if (!(await confirm({ title: "Delete this memory?", description: m.photos.length ? `Its ${pluralize(m.photos.length, "photo")} will be deleted too.` : undefined, confirmLabel: "Delete memory" }))) return;
                  start(async () => {
                    const res = await deleteMemory(m.id);
                    if (!res.ok) toast.error(res.error);
                    else toast.success("Memory deleted");
                  });
                }}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {m.body && (
          <div>
            <div className={cn(long && !expanded && "max-h-36 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]")}>
              <Markdown>{m.body}</Markdown>
            </div>
            {long && (
              <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {where && (
            <Link href={city ? `/cities/${city.id}` : `/countries/${country!.id}`} className={cn(chip, "bg-surface-2 text-ink/80 ring-1 ring-border hover:underline")}>
              <MapPin className="size-3.5 shrink-0 text-accent" />
              <span className="truncate">{where}</span>
            </Link>
          )}
          {place && (
            <Link href={placeHref(place.id)} className={cn(chip, "bg-accent-soft hover:underline")} title="Open the linked place">
              <MapPin className="size-3.5 shrink-0 text-accent" />
              <span className="truncate">{place.name}</span>
            </Link>
          )}
          {day && (
            <Link href={dayHref(day)} className={cn(chip, "bg-accent-soft hover:underline")} title="Open the linked itinerary day">
              <CalendarDays className="size-3.5 shrink-0 text-accent" />
              <span className="truncate">{dayLabel(day, dayCity)}</span>
            </Link>
          )}
          {m.tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTag(t)}
              aria-pressed={activeTag === t}
              title={activeTag === t ? "Show every tag again" : `Show only #${t}`}
              className={cn(chip, activeTag === t ? "bg-ink text-bg" : "bg-surface-2 text-muted ring-1 ring-border hover:text-ink")}
            >
              #{t}
            </button>
          ))}
        </div>
        <div className="pt-1">
          <PhotoGrid photos={[]} entityType="memory" entityId={m.id} addVariant="pill" columns="hidden" />
        </div>
      </div>
      {sharing && <ShareDialog kind="memory" targetId={m.id} title={m.title ?? "This memory"} enabled={ws.sharingEnabled} onOpenChange={setSharing} />}
    </article>
  );
}
