"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type { CoverKind } from "@/hooks/use-auto-cover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type Candidate = { url: string; thumb: string; title: string; attribution: string };

/** Phase 2: choose among up to 8 Wikimedia Commons candidates. */
export function CoverPicker({ open, onOpenChange, kind, id }: { open: boolean; onOpenChange: (o: boolean) => void; kind: CoverKind; id: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [items, setItems] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [saving, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const sp = new URLSearchParams({ kind, id });
    if (submitted) sp.set("q", submitted);
    const t = setTimeout(() => {
      setItems(null);
      setError(null);
    }, 0);
    fetch(`/api/cover/candidates?${sp}`)
      .then(async (r) => {
        const json = (await r.json()) as { candidates?: Candidate[]; query?: string; error?: string };
        if (!alive) return;
        if (!r.ok) throw new Error(json.error ?? "Search failed");
        setItems(json.candidates ?? []);
        if (json.query && !submitted) setQuery(json.query);
      })
      .catch(() => alive && (setItems([]), setError("Wikimedia is unreachable right now. Try again later or upload your own photo.")));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, kind, id, submitted]);

  const save = () =>
    start(async () => {
      if (!selected) return;
      const res = await fetch("/api/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, candidate: selected }),
      });
      const json = (await res.json().catch(() => ({}))) as { found?: boolean; error?: string };
      if (!res.ok || !json.found) return void toast.error(json.error ?? "Could not use that photo");
      toast.success("Cover updated");
      onOpenChange(false);
      router.refresh();
    });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Choose a cover"
      description="Free photos from Wikimedia Commons. Credit is saved with the photo."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!selected || saving}>
            {saving && <Loader2 className="animate-spin" />} Use this photo
          </Button>
        </>
      }
    >
      <form
        className="relative mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim() || null);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Search Wikimedia Commons" aria-label="Search photos" />
      </form>
      {!items ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted">
          <ImageOff className="size-6 text-accent" />
          {error ?? "No photos found. Try another search."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 pb-2 sm:grid-cols-4">
          {items.map((c) => (
            <button
              key={c.url}
              type="button"
              onClick={() => setSelected(c)}
              className={cn("group relative aspect-[4/3] overflow-hidden rounded-xl ring-2 ring-transparent transition", selected?.url === c.url && "ring-accent")}
              title={c.attribution}
            >
              <img src={c.thumb} alt={c.title} className="size-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              {selected?.url === c.url && (
                <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-accent text-white">
                  <Check className="size-3.5" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </ResponsiveDialog>
  );
}
