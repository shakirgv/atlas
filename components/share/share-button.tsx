"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { useWorkspace } from "@/components/shell/workspace";
import type { RecapStats } from "@/lib/recap";
import { ShareDialog } from "./share-dialog";

/** The recap's share button, styled for its dark top bar. */
export function RecapShareButton({ stats }: { stats: RecapStats }) {
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Share this recap" title="Share">
        <Share2 className="size-5" />
      </button>
      {open && <ShareDialog kind="recap" year={stats.period === "all" ? null : stats.period} title={`${stats.label} recap`} enabled={ws.sharingEnabled} recapPhotos={stats.mosaic.map((p) => ({ id: p.id, thumb: p.thumbUrl }))} onOpenChange={setOpen} />}
    </>
  );
}
