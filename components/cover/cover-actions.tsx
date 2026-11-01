"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Images, Info, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { savePhotos } from "@/actions/photos";
import { IMAGE_ACCEPT, uploadPhotos } from "@/lib/upload";
import type { PhotoEntityType } from "@/lib/types";
import { requestCover, type CoverKind } from "@/hooks/use-auto-cover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/components/shell/workspace";
import { CoverPicker } from "./cover-picker";

/** Overlay controls for a hero cover: upload (always overrides), re-fetch, choose another. */
export function CoverActions({ kind, id, attribution }: { kind: CoverKind; id: string; attribution?: string | null }) {
  const ws = useWorkspace();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const upload = (file: File) =>
    start(async () => {
      const metas = await uploadPhotos(ws.userId, kind as PhotoEntityType, id, [file]);
      if (!metas.length) return void toast.error("Upload failed");
      const res = await savePhotos(kind as PhotoEntityType, id, metas, { setCover: true });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Cover updated");
      router.refresh();
    });

  const refetch = () =>
    start(async () => {
      const found = await requestCover(kind, id, { onlyIfEmpty: false });
      if (found) {
        toast.success("Found a new photo");
        router.refresh();
      } else toast("No photo found", { description: "Keeping the current cover. You can upload your own." });
    });

  return (
    <div className="flex items-center gap-1.5">
      {attribution ? (
        <Popover>
          <PopoverTrigger className="grid size-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/55" aria-label="Photo credit">
            <Info className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="text-xs leading-relaxed text-muted">{attribution}</PopoverContent>
        </Popover>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-full bg-black/40 px-3 text-[13px] font-medium text-white backdrop-blur-md hover:bg-black/55" aria-label="Cover options">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          <span className="max-sm:sr-only">Cover</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => input.current?.click()}>
            <ImagePlus /> Upload photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={refetch}>
            <RefreshCw /> Re-fetch photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPickerOpen(true)}>
            <Images /> Choose another…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      {pickerOpen && <CoverPicker open onOpenChange={setPickerOpen} kind={kind} id={id} />}
    </div>
  );
}
