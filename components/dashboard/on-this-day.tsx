"use client";
import { useState } from "react";
import Link from "next/link";
import { History, ImageIcon } from "lucide-react";
import { yearsAgoLabel, type OnThisDayItem } from "@/lib/recap";
import type { PhotoView } from "@/lib/types";
import { PhotoLightbox } from "@/components/photos/photo-grid";

/** Memories and photos from this date in past years. With nothing to show, it isn't there at all. */
export function OnThisDay({ items }: { items: OnThisDayItem[] }) {
  const [index, setIndex] = useState(-1);
  const photos = items.flatMap((i) => (i.kind === "photo" ? [{ id: i.id, url: i.url, thumb_url: i.thumbUrl, caption: i.caption, taken_at: i.date } as PhotoView] : []));
  if (!items.length) return null;

  const row = (i: OnThisDayItem) => (
    <>
      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
        {i.thumbUrl ? <img src={i.thumbUrl} alt="" className="size-full object-cover" loading="lazy" /> : <ImageIcon className="size-5 text-muted" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-accent">{[yearsAgoLabel(i.yearsAgo), i.place].filter(Boolean).join(" · ")}</span>
        <span className="block truncate text-sm font-medium">{i.title}</span>
      </span>
    </>
  );
  const rowClass = "flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]";

  return (
    <section className="card flex h-full flex-col p-5" aria-label="On this day">
      <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
        <History className="size-5 text-accent" /> On this day
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((i) => (
          <li key={`${i.kind}-${i.id}`}>
            {i.kind === "memory" ? (
              <Link href={`/memories?focus=${i.id}`} className={rowClass}>
                {row(i)}
              </Link>
            ) : (
              <button type="button" onClick={() => setIndex(photos.findIndex((p) => p.id === i.id))} className={rowClass}>
                {row(i)}
              </button>
            )}
          </li>
        ))}
      </ul>
      {photos.length > 0 && <PhotoLightbox photos={photos} index={index} onClose={() => setIndex(-1)} />}
    </section>
  );
}
