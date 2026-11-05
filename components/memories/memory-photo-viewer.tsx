"use client";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { MemoryVM } from "@/lib/data";
import { fmtDate } from "@/lib/dates";
import type { PhotoView } from "@/lib/types";

export type ViewerItem = { photo: PhotoView; memory: MemoryVM; where: string | null };

/**
 * Full-size memory photos with previous / next, each photo's date and place,
 * and a way back to the memory it belongs to.
 */
export function MemoryPhotoViewer({ items, index, onClose, onOpenMemory }: { items: ViewerItem[]; index: number; onClose: () => void; onOpenMemory?: (id: string) => void }) {
  const [current, setCurrent] = useState(index);
  const item = items[current];
  return (
    <Lightbox
      open
      close={onClose}
      index={index}
      on={{ view: ({ index: i }) => setCurrent(i) }}
      plugins={[Captions, Zoom]}
      captions={{ descriptionTextAlign: "start", descriptionMaxLines: 4 }}
      carousel={{ finite: items.length <= 1 }}
      render={items.length <= 1 ? { buttonPrev: () => null, buttonNext: () => null } : undefined}
      styles={{ container: { backgroundColor: "rgb(10 12 16 / 0.96)" } }}
      toolbar={{
        buttons: [
          onOpenMemory && item ? (
            <button
              key="open-memory"
              type="button"
              onClick={() => {
                onClose();
                onOpenMemory(item.memory.id);
              }}
              className="mx-1 my-2 inline-flex h-9 items-center gap-1.5 self-center rounded-full bg-white/15 px-3.5 text-sm font-medium text-white backdrop-blur hover:bg-white/25"
            >
              Open memory <ArrowUpRight className="size-4" />
            </button>
          ) : null,
          "close",
        ].filter(Boolean) as React.ReactNode[],
      }}
      slides={items.map(({ photo, memory, where }, i) => {
        const when = photo.taken_at ? new Date(photo.taken_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : fmtDate(memory.date, "EEE, d MMM yyyy");
        return {
          src: photo.url ?? photo.thumb_url ?? "",
          width: photo.width ?? undefined,
          height: photo.height ?? undefined,
          alt: photo.caption ?? memory.title ?? "",
          title: memory.title ?? photo.caption ?? undefined,
          description: (
            <span className="flex flex-col gap-1 text-sm">
              {photo.caption && memory.title && photo.caption !== memory.title ? <span>{photo.caption}</span> : null}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> {when}
                </span>
                {where ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" /> {where}
                  </span>
                ) : null}
                <span className="num text-white/60">
                  {i + 1} / {items.length}
                </span>
              </span>
            </span>
          ),
        };
      })}
    />
  );
}
