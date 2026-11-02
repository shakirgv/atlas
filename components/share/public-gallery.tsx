"use client";
import "yet-another-react-lightbox/styles.css";
import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import type { PublicPhoto } from "@/lib/share";

/** Masonry with a lightbox. Only ever gets ids, sizes and captions, and the URLs come from the share route. */
export function PublicGallery({ photos, src }: { photos: PublicPhoto[]; src: (id: string, size: "thumb" | "full") => string }) {
  const [index, setIndex] = useState(-1);
  if (!photos.length) return null;
  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
        {photos.map((p, i) => (
          <button key={p.id} type="button" onClick={() => setIndex(i)} className="block w-full overflow-hidden rounded-xl bg-surface-2" style={{ aspectRatio: p.width && p.height ? `${p.width}/${p.height}` : "4/3" }} aria-label={p.caption ?? `Open photo ${i + 1}`}>
            <img src={src(p.id, "thumb")} alt={p.caption ?? ""} loading="lazy" className="size-full object-cover" />
          </button>
        ))}
      </div>
      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={Math.max(0, index)}
        plugins={[Zoom]}
        styles={{ container: { backgroundColor: "rgb(10 12 16 / 0.96)" } }}
        slides={photos.map((p) => ({ src: src(p.id, "full"), width: p.width ?? undefined, height: p.height ?? undefined, alt: p.caption ?? "" }))}
      />
    </>
  );
}

/** The gallery bound to a share's photo route. A client wrapper, since a function can't cross from the server. */
export function ShareGallery({ photos, base }: { photos: PublicPhoto[]; base: string }) {
  return <PublicGallery photos={photos} src={(id, size) => `${base}/photo/${id}?size=${size}`} />;
}
