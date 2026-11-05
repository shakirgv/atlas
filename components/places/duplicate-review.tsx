"use client";
import { useState, useTransition } from "react";
import { CopyCheck, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { mergePlaces } from "@/actions/places";
import type { PlaceVM } from "@/lib/data";
import { keeperFor, type PlaceLinks } from "@/lib/place-duplicates";
import type { PlaceStatus } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { PlaceStatusChip } from "@/components/common/status-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

const linkCount = (l: PlaceLinks | undefined) => [l?.stops ? pluralize(l.stops, "stop") : null, l?.memories ? pluralize(l.memories, "memory", "memories") : null].filter(Boolean).join(" · ");

/**
 * Nothing is merged until it is confirmed: the first button shows what will move and asks again.
 * The place to keep and the ones to fold in are on show the whole time.
 */
function MergeDialog({ group, links, onOpenChange }: { group: PlaceVM[]; links: Record<string, PlaceLinks>; onOpenChange: (open: boolean) => void }) {
  const [keep, setKeepState] = useState(() => keeperFor(group, links).id);
  const [left, setLeftState] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const merging = group.filter((p) => p.id !== keep && !left.has(p.id));
  const kept = group.find((p) => p.id === keep)!;
  // Changing the choice asks for the confirmation again.
  const setKeep = (id: string) => {
    setConfirming(false);
    setKeepState(id);
  };
  const setLeft = (fn: (prev: Set<string>) => Set<string>) => {
    setConfirming(false);
    setLeftState(fn);
  };
  const moving = linkCount({ stops: merging.reduce((n, p) => n + (links[p.id]?.stops ?? 0), 0), memories: merging.reduce((n, p) => n + (links[p.id]?.memories ?? 0), 0) });
  const merge = () =>
    start(async () => {
      const res = await mergePlaces(keep, merging.map((p) => p.id));
      if (!res.ok) return void toast.error(res.error);
      const moved = [res.data.stops ? pluralize(res.data.stops, "stop") : null, res.data.memories ? pluralize(res.data.memories, "memory", "memories") : null, res.data.photos ? pluralize(res.data.photos, "photo") : null].filter(Boolean).join(", ");
      toast.success(`Merged into ${kept.name}`, { description: moved ? `Moved ${moved}.` : undefined });
      onOpenChange(false);
    });
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="Merge possible duplicates"
      description="Choose the place to keep. Stops, memories and photos move to it, along with any visit and rating. This can't be undone."
      footer={
        confirming ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid="merge-confirm">
            <p className="text-sm">
              <span className="font-medium">
                Merge {pluralize(merging.length, "place")} into {kept.name}?
              </span>{" "}
              <span className="text-muted">
                {moving ? `${moving} and their photos move to it` : "Their photos move to it"}, and it keeps the furthest visit and best rating. This can&apos;t be undone.
              </span>
            </p>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
                Back
              </Button>
              <Button onClick={merge} disabled={pending} autoFocus>
                {pending && <Loader2 className="animate-spin" />} Yes, merge
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Keep them separate
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={!merging.length}>
              {merging.length ? `Merge ${pluralize(merging.length, "place")} into ${kept.name}` : "Pick a place to merge"}
            </Button>
          </>
        )
      }
    >
      <ul className="flex flex-col gap-2 pb-2" data-testid="merge-list">
        {group.map((p) => {
          const isKept = p.id === keep;
          return (
            <li key={p.id} className={cn("rounded-xl border p-3", isKept ? "border-ink/40 bg-surface-2" : "border-border")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 break-words font-medium">{p.name}</span>
                <PlaceStatusChip status={p.status as PlaceStatus} size="sm" />
                {p.rating ? (
                  <span className="num flex items-center gap-0.5 text-xs text-muted">
                    <Star className="size-3 fill-planned text-planned" /> {p.rating}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted">{[linkCount(links[p.id]) || "Not linked to any stop or memory", p.address].filter(Boolean).join(" · ")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <label className="flex min-h-9 items-center gap-2">
                  <input type="radio" name="merge-keep" checked={isKept} onChange={() => setKeep(p.id)} className="size-4 accent-[var(--accent)]" />
                  Keep this one
                </label>
                {!isKept && (
                  <label className="flex min-h-9 items-center gap-2">
                    <Checkbox checked={!left.has(p.id)} onCheckedChange={(v) => setLeft((prev) => {
                      const next = new Set(prev);
                      if (v === true) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })} />
                    Merge into it
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ResponsiveDialog>
  );
}

/** Possible duplicates with a Review button each. Shown on the Places page, a country's Places tab and a city's places list. */
export function DuplicateReview({ places, duplicates, links }: { places: PlaceVM[]; duplicates: PlaceVM[][]; links: Record<string, PlaceLinks> }) {
  const [reviewing, setReviewing] = useState<string[] | null>(null);
  // Read fresh each time, so the dialog doesn't hold on to a place that has since been merged away.
  const reviewGroup = reviewing ? places.filter((p) => reviewing.includes(p.id)) : [];
  return (
    <>
      {duplicates.length > 0 && (
        <section className="card flex flex-col gap-2 p-4" aria-label="Possible duplicates">
          <h3 className="flex items-center gap-2 font-semibold">
            <CopyCheck className="size-4 text-accent" /> Possible duplicates
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {duplicates.map((group) => (
              <li key={group[0]!.id} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="min-w-0 break-words text-sm">
                  {group.map((p) => p.name).join(", ")} <span className="text-muted">in {group[0]!.city_name}</span>
                </span>
                <Button size="sm" variant="secondary" className="shrink-0 self-start sm:self-auto" onClick={() => setReviewing(group.map((p) => p.id))}>
                  Review
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {reviewGroup.length > 1 && <MergeDialog key={reviewing!.join()} group={reviewGroup} links={links} onOpenChange={(o) => !o && setReviewing(null)} />}
    </>
  );
}
