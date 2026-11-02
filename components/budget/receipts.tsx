"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePhoto, savePhotos } from "@/actions/photos";
import { formatMoney } from "@/lib/money";
import { IMAGE_ACCEPT, uploadPhotos } from "@/lib/upload";
import type { Expense, PhotoView } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PhotoLightbox } from "@/components/photos/photo-grid";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

/** Compresses, uploads and records receipts. Returns how many were saved. */
export async function addReceipts(userId: string, expenseId: string, files: File[]) {
  const metas = await uploadPhotos(userId, "expense", expenseId, files);
  if (metas.length) {
    const res = await savePhotos("expense", expenseId, metas, { setCover: false });
    if (!res.ok) {
      toast.error(res.error);
      return 0;
    }
  }
  if (metas.length < files.length) toast.error(`${files.length - metas.length} receipt(s) could not be uploaded`);
  return metas.length;
}

/**
 * Opens the camera or file picker from a free-standing input, so it still works from a toast
 * after the form that saved the expense has closed.
 */
export function pickReceiptFiles(onFiles: (files: File[]) => void, camera = false) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = IMAGE_ACCEPT;
  input.multiple = !camera;
  if (camera) input.setAttribute("capture", "environment");
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length) onFiles(files);
  };
  input.click();
}

/** Add, view and delete the receipts of one expense. Desktop also takes a drag and drop. */
export function ReceiptsDialog({ expense, receipts, userId, onOpenChange }: { expense: Expense; receipts: PhotoView[]; userId: string; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const camera = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);
  const [index, setIndex] = useState(-1);
  const [, start] = useTransition();

  const upload = async (list: File[]) => {
    if (!list.length) return;
    setUploading(true);
    const saved = await addReceipts(userId, expense.id, list);
    setUploading(false);
    if (saved) toast.success(`${saved} receipt${saved === 1 ? "" : "s"} added`);
    router.refresh();
  };
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    void upload(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  return (
    <ResponsiveDialog open onOpenChange={onOpenChange} title="Receipts" description={`${expense.title || "Expense"} · ${formatMoney(Number(expense.amount), expense.currency)}`}>
      <div
        className={cn("flex flex-col gap-3 rounded-xl pb-2", over && "ring-2 ring-accent ring-offset-2 ring-offset-surface")}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)));
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => camera.current?.click()} disabled={uploading} className="md:hidden">
            <Camera /> Take photo
          </Button>
          <Button variant="secondary" onClick={() => files.current?.click()} disabled={uploading} className="max-md:col-span-1 md:col-span-2">
            {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} {uploading ? "Uploading…" : "Choose files"}
          </Button>
        </div>
        <p className="hidden text-center text-xs text-muted md:block">Or drop images here.</p>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onPick} aria-label="Take a photo of a receipt" />
        <input ref={files} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={onPick} aria-label="Choose receipt files" />
        {receipts.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {receipts.map((r, i) => (
              <li key={r.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
                <button type="button" onClick={() => setIndex(i)} className="block size-full" aria-label={`Open receipt ${i + 1}`}>
                  {r.thumb_url && <img src={r.thumb_url} alt="" className="size-full object-cover" loading="lazy" />}
                </button>
                <button
                  type="button"
                  className="absolute right-1 top-1 grid size-9 place-items-center rounded-full bg-black/55 text-white"
                  aria-label={`Delete receipt ${i + 1}`}
                  onClick={async () => {
                    if (!(await confirm({ title: "Delete this receipt?", confirmLabel: "Delete receipt" }))) return;
                    start(async () => {
                      const res = await deletePhoto(r.id);
                      if (!res.ok) return void toast.error(res.error);
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-muted">No receipts yet.</p>
        )}
      </div>
      <PhotoLightbox photos={receipts} index={index} onClose={() => setIndex(-1)} />
    </ResponsiveDialog>
  );
}

/** Table cell: the count opens the lightbox; with no receipts yet it opens the add dialog. */
export function ReceiptCell({ receipts, onManage }: { receipts: PhotoView[]; onManage: () => void }) {
  const [index, setIndex] = useState(-1);
  if (!receipts.length) {
    return (
      <button type="button" onClick={onManage} className="grid size-8 place-items-center rounded-lg text-muted/60 hover:bg-ink/5 hover:text-ink" aria-label="Add receipt" title="Add receipt">
        <Paperclip className="size-4" />
      </button>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setIndex(0)} className="inline-flex h-8 items-center gap-1 rounded-lg px-1.5 text-accent hover:bg-ink/5" aria-label={`View ${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`}>
        <Paperclip className="size-4" />
        <span className="num text-xs font-medium">{receipts.length}</span>
      </button>
      <PhotoLightbox photos={receipts} index={index} onClose={() => setIndex(-1)} />
    </>
  );
}
