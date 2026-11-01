import Link from "next/link";
import { Images } from "lucide-react";
import type { MemoryVM } from "@/lib/data";
import { fmtDate } from "@/lib/dates";
import { gradientFor } from "@/lib/utils";

/** Photo-first compact memory card. */
export function MemoryMini({ m }: { m: MemoryVM }) {
  const photo = m.photos[0];
  return (
    <Link href={`/memories?focus=${m.id}`} className="card card-hover group block overflow-hidden">
      <div className="relative aspect-[4/3]" style={photo ? undefined : { background: gradientFor(m.id) }}>
        {photo?.thumb_url ? (
          <img src={photo.thumb_url} alt={photo.caption ?? m.title ?? ""} className="absolute inset-0 size-full object-cover" loading="lazy" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-5xl">{m.mood ?? "📝"}</span>
        )}
        <div className="photo-gradient absolute inset-0" />
        {m.photos.length > 1 && (
          <span className="absolute right-2.5 top-2.5 inline-flex h-6 items-center gap-1 rounded-full bg-black/45 px-2 text-[11px] font-medium text-white backdrop-blur">
            <Images className="size-3" /> {m.photos.length}
          </span>
        )}
        <div className="absolute inset-x-3 bottom-3 text-white">
          <p className="text-xs text-white/80">
            {fmtDate(m.date)} {m.mood && photo ? m.mood : ""}
          </p>
          <p className="line-clamp-1 font-display text-lg font-semibold">{m.title ?? ((m.body ?? "").slice(0, 40) || "Untitled")}</p>
        </div>
      </div>
    </Link>
  );
}
