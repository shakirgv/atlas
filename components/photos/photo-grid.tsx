"use client";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { ImagePlus, Loader2, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePhoto, savePhotos, setPhotoAsCover, updatePhotoCaption } from "@/actions/photos";
import { IMAGE_ACCEPT, uploadPhotos, type UploadProgress } from "@/lib/upload";
import type { PhotoEntityType, PhotoView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm";
import { useWorkspace } from "@/components/shell/workspace";

/** Shared lightbox: shows captions and the Wikimedia attribution when present. */
export function PhotoLightbox({ photos, index, onClose }: { photos: PhotoView[]; index: number; onClose: () => void }) {
  return (
    <Lightbox
      open={index >= 0}
      close={onClose}
      index={Math.max(0, index)}
      plugins={[Captions, Zoom]}
      captions={{ descriptionTextAlign: "start", descriptionMaxLines: 4 }}
      styles={{ container: { backgroundColor: "rgb(10 12 16 / 0.96)" } }}
      slides={photos.map((p) => ({
        src: p.url ?? p.thumb_url ?? "",
        width: p.width ?? undefined,
        height: p.height ?? undefined,
        title: p.caption ?? undefined,
        description: [p.taken_at ? new Date(p.taken_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null, p.attribution].filter(Boolean).join(" · ") || undefined,
      }))}
    />
  );
}

/** Thumbnail grid with lightbox, upload, caption edit, set-as-cover and delete. */
export function PhotoGrid({
  photos,
  entityType,
  entityId,
  canUpload = true,
  columns = "grid-cols-3",
  setCoverOnUpload = false,
}: {
  photos: PhotoView[];
  entityType: PhotoEntityType;
  entityId: string;
  canUpload?: boolean;
  columns?: string;
  setCoverOnUpload?: boolean;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [index, setIndex] = useState(-1);
  const [progress, setProgress] = useState<Record<number, UploadProgress>>({});
  const [uploading, setUploading] = useState(0);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [, start] = useTransition();
  const confirm = useConfirm();

  const upload = async (files: File[]) => {
    setUploading(files.length);
    const metas = await uploadPhotos(ws.userId, entityType, entityId, files, (i, p) => setProgress((s) => ({ ...s, [i]: p })));
    if (metas.length) {
      const res = await savePhotos(entityType, entityId, metas, { setCover: setCoverOnUpload });
      if (!res.ok) toast.error(res.error);
      else toast.success(`${metas.length} photo${metas.length > 1 ? "s" : ""} added`);
    }
    if (metas.length < files.length) toast.error(`${files.length - metas.length} upload(s) failed`);
    setUploading(0);
    setProgress({});
    router.refresh();
  };

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Failed");
      toast.success(msg);
      router.refresh();
    });

  const done = Object.values(progress).filter((p) => p.status === "done" || p.status === "error").length;

  return (
    <div>
      <div className={cn("grid gap-2", columns)}>
        {photos.map((p, i) => (
          <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
            <button type="button" onClick={() => setIndex(i)} className="block size-full" aria-label={`Open photo ${i + 1}`}>
              {p.thumb_url ? <img src={p.thumb_url} alt={p.caption ?? ""} className="size-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" /> : null}
            </button>
            {editing?.id === p.id ? (
              <form
                className="absolute inset-x-1.5 bottom-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = editing.value;
                  setEditing(null);
                  act(() => updatePhotoCaption(p.id, v), "Caption saved");
                }}
              >
                <input
                  autoFocus
                  value={editing.value}
                  onChange={(e) => setEditing({ id: p.id, value: e.target.value })}
                  onBlur={() => setEditing(null)}
                  onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                  placeholder="Caption + Enter"
                  aria-label="Caption"
                  className="h-8 w-full rounded-lg bg-white/95 px-2 text-xs text-ink outline-none"
                />
              </form>
            ) : p.caption && <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-[11px] text-white">{p.caption}</span>}
            <DropdownMenu>
              <DropdownMenuTrigger className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-black/45 text-white opacity-100 backdrop-blur transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" aria-label="Photo options">
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setTimeout(() => setEditing({ id: p.id, value: p.caption ?? "" }), 50)}>
                  <Pencil /> Edit caption
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => act(() => setPhotoAsCover(p.id), "Cover updated")}>
                  <Star /> Set as cover
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  destructive
                  onSelect={async () => {
                    if (await confirm({ title: "Delete this photo?", confirmLabel: "Delete photo" })) act(() => deletePhoto(p.id), "Photo deleted");
                  }}
                >
                  <Trash2 /> Delete photo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {canUpload && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading > 0}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-surface-2 text-xs font-medium text-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            {uploading ? (
              <>
                <Loader2 className="size-5 animate-spin text-accent" />
                {done}/{uploading}
              </>
            ) : (
              <>
                <ImagePlus className="size-5 text-accent" />
                Add photos
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void upload(files);
          e.target.value = "";
        }}
      />
      <PhotoLightbox photos={photos} index={index} onClose={() => setIndex(-1)} />
    </div>
  );
}
