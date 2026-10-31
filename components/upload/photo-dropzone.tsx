"use client";
import { useEffect, useRef, useState } from "react";
import { CircleCheck, ImagePlus, Loader2, TriangleAlert, X } from "lucide-react";
import { IMAGE_ACCEPT, type UploadProgress } from "@/lib/upload";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { cn } from "@/lib/utils";

export type PendingFile = { file: File; preview: string | null };

/** Drag-and-drop multi-photo picker with previews and per-file progress. */
export function PhotoDropzone({
  files,
  onChange,
  progress,
  disabled,
  compact,
}: {
  files: PendingFile[];
  onChange: (files: PendingFile[]) => void;
  progress?: Record<number, UploadProgress>;
  disabled?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => () => files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), [files]);

  const add = (list: FileList | File[]) => {
    const accepted: PendingFile[] = [];
    let rejected = 0;
    for (const f of Array.from(list)) {
      const isImage = f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);
      if (!isImage || f.size > MAX_UPLOAD_BYTES) {
        rejected++;
        continue;
      }
      const canPreview = /image\/(jpeg|png|webp|gif|avif)/.test(f.type);
      accepted.push({ file: f, preview: canPreview ? URL.createObjectURL(f) : null });
    }
    if (rejected) {
      void import("sonner").then(({ toast }) => toast.error(`${rejected} file${rejected > 1 ? "s" : ""} skipped (images up to 25 MB only)`));
    }
    onChange([...files, ...accepted].slice(0, 30));
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Add photos"
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled && e.dataTransfer.files?.length) add(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink",
          compact ? "h-14 px-4" : "h-24 flex-col gap-1.5",
          over && "border-accent bg-accent-soft text-ink",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <ImagePlus className="size-5 text-accent" />
        <span>
          <span className="font-medium text-ink">Drop photos</span> or tap to choose
          {!compact && <span className="block text-center text-xs">JPG, PNG, HEIC · compressed before upload</span>}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {files.map((f, i) => {
            const p = progress?.[i];
            return (
              <li key={`${f.file.name}-${i}`} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border">
                {f.preview ? (
                  <img src={f.preview} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center p-1 text-center text-[10px] text-muted">{f.file.name}</div>
                )}
                {p && p.status !== "done" && p.status !== "error" && (
                  <div className="absolute inset-0 grid place-items-center bg-black/45">
                    <Loader2 className="size-5 animate-spin text-white" />
                    <div className="absolute inset-x-1.5 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/30">
                      <div className="h-full bg-white transition-[width]" style={{ width: `${Math.round(p.progress * 100)}%` }} />
                    </div>
                  </div>
                )}
                {p?.status === "done" && <CircleCheck className="absolute right-1 top-1 size-5 rounded-full bg-visited text-white" />}
                {p?.status === "error" && (
                  <div className="absolute inset-0 grid place-items-center bg-danger/70" title={p.error}>
                    <TriangleAlert className="size-5 text-white" />
                  </div>
                )}
                {!p && !disabled && (
                  <button
                    type="button"
                    onClick={() => onChange(files.filter((_, j) => j !== i))}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/55 text-white"
                    aria-label={`Remove ${f.file.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
