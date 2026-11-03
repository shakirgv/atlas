"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Link2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createShare, listSharePhotos, listShares, revokeShare, type SharePhotoOption, type ShareRow } from "@/actions/shares";
import { fmtDate, relative } from "@/lib/dates";
import { DEFAULT_SHARE_EXPIRY, SHARE_EXPIRY_OPTIONS } from "@/lib/share";
import type { ShareKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Field, NativeSelect } from "@/components/ui/input";
import { Checkbox, Switch } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

/** The app can't fix this by itself: the key is a secret that only the Supabase and Vercel dashboards hold. */
function SharingOff() {
  return (
    <p className="rounded-xl bg-planned-soft px-3 py-2.5 text-sm" data-testid="sharing-off">
      Sharing is off because this deployment has no server key. In Vercel → Settings → Environment Variables, add <code className="break-all font-mono text-[13px]">SUPABASE_SERVICE_ROLE_KEY</code> with the secret key from Supabase → Project Settings → API Keys, then redeploy.
    </p>
  );
}

const linkFor = (token: string) => `${window.location.origin}/s/${token}`;

function CopyButton({ token, label = "Copy" }: { token: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(linkFor(token));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : label}
    </Button>
  );
}

/** My active links: views, last viewed, expiry, revoke and a preview as a visitor sees it. */
export function ShareList({ rows, onChanged, showLabel }: { rows: ShareRow[]; onChanged: () => void; showLabel?: boolean }) {
  const confirm = useConfirm();
  const [, start] = useTransition();
  if (!rows.length) return <p className="text-sm text-muted">No active links.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {rows.map((s) => (
        <li key={s.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 text-sm">
            {showLabel && <p className="truncate font-medium">{s.label}</p>}
            <p className="num text-xs text-muted">
              {s.view_count} view{s.view_count === 1 ? "" : "s"}
              {s.last_viewed_at ? `, last ${relative(s.last_viewed_at)}` : ""} · {s.expires_at ? `expires ${fmtDate(s.expires_at, "dd MMM yyyy")}` : "never expires"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CopyButton token={s.token} />
            <Button variant="ghost" size="sm" asChild>
              <a href={`/s/${s.token}?preview=1`} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Preview as visitor
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-soft"
              onClick={async () => {
                if (!(await confirm({ title: "Revoke this link?", description: "It stops working immediately. This can't be undone.", confirmLabel: "Revoke link" }))) return;
                start(async () => {
                  const res = await revokeShare(s.id);
                  if (!res.ok) return void toast.error(res.error);
                  onChanged();
                });
              }}
            >
              <Trash2 /> Revoke
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Option({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export function ShareDialog({
  kind,
  targetId = null,
  year = null,
  title,
  enabled,
  recapPhotos,
  onOpenChange,
  initial,
}: {
  kind: ShareKind;
  targetId?: string | null;
  year?: number | null;
  title: string;
  /** False when the server has no service role key. */
  enabled: boolean;
  /** A recap shows its mosaic, which the page already has. */
  recapPhotos?: SharePhotoOption[];
  onOpenChange: (open: boolean) => void;
  /** Fixture data for the preview gallery. */
  initial?: { rows: ShareRow[]; photos: SharePhotoOption[] };
}) {
  const [expiry, setExpiry] = useState<string>(String(DEFAULT_SHARE_EXPIRY));
  const [exact, setExact] = useState(false);
  const [dates, setDates] = useState(true);
  const [itinerary, setItinerary] = useState(false);
  const [preview, setPreview] = useState(true);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [photos, setPhotos] = useState<SharePhotoOption[]>(initial?.photos ?? recapPhotos ?? []);
  const [rows, setRows] = useState<ShareRow[]>(initial?.rows ?? []);
  const [created, setCreated] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = useCallback(() => {
    if (initial) return;
    void listShares({ kind, targetId, year }).then((res) => {
      if (res.ok) setRows(res.data);
    });
  }, [initial, kind, targetId, year]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    if (!initial && kind !== "recap" && targetId) {
      void listSharePhotos(kind, targetId).then((res) => {
        if (res.ok) setPhotos(res.data);
      });
    }
  }, [enabled, refresh, initial, kind, targetId]);

  const create = () =>
    start(async () => {
      const res = await createShare({
        kind,
        target_id: targetId,
        year,
        expires_in_days: expiry === "never" ? null : (Number(expiry) as 7 | 30 | 90),
        config: { exact_locations: exact, show_dates: dates, include_itinerary: itinerary, preview_image: preview, excluded_photo_ids: excluded },
      });
      if (!res.ok) return void toast.error(res.error);
      setCreated(res.data.token);
      refresh();
      await navigator.clipboard.writeText(linkFor(res.data.token)).catch(() => {});
      toast.success("Link created and copied");
    });

  return (
    <ResponsiveDialog open onOpenChange={onOpenChange} title="Share" description={title}>
      <div className="flex flex-col gap-4 pb-2" data-testid="share-dialog">
        {!enabled ? (
          <SharingOff />
        ) : (
          <p className="text-xs text-muted">Anyone with the link can see this, without signing in. Budget, cash, documents, visa details, private notes and your home are never included.</p>
        )}
        <Field label="Link expires after" htmlFor="share-expiry">
          <NativeSelect id="share-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            {SHARE_EXPIRY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
            <option value="never">Never</option>
          </NativeSelect>
        </Field>
        <div className="flex flex-col">
          <Option label="Show exact locations" hint="Off: the map shows the city only, with no coordinates or addresses." checked={exact} onChange={setExact} />
          <Option label="Show dates" checked={dates} onChange={setDates} />
          {kind === "trip" && <Option label="Include itinerary" checked={itinerary} onChange={setItinerary} />}
          <Option label="Show preview image" hint="The picture messengers show next to the link." checked={preview} onChange={setPreview} />
        </div>
        {photos.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink/90">
              Photos <span className="num font-normal text-muted">{photos.length - excluded.length} of {photos.length}</span>
            </legend>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {photos.map((p, i) => {
                const on = !excluded.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className={cn("relative block aspect-square cursor-pointer overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border", !on && "opacity-40")}>
                      {p.thumb && <img src={p.thumb} alt="" className="size-full object-cover" loading="lazy" />}
                      <Checkbox className="absolute right-1 top-1 bg-surface" checked={on} aria-label={`Share photo ${i + 1}`} onCheckedChange={(v) => setExcluded((x) => (v === true ? x.filter((id) => id !== p.id) : [...x, p.id]))} />
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
        <Button onClick={create} disabled={!enabled || pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Link2 />} Create link
        </Button>
        {created && (
          <div className="flex flex-col gap-2 rounded-xl bg-visited-soft p-3" data-testid="share-created">
            <p className="break-all font-mono text-xs">{linkFor(created)}</p>
            <div>
              <CopyButton token={created} label="Copy link" />
            </div>
          </div>
        )}
        {enabled && rows.length > 0 && (
          <section className="border-t border-border pt-4" aria-label="Active links">
            <h3 className="mb-2 text-sm font-semibold">Active links</h3>
            <ShareList rows={rows} onChanged={refresh} />
          </section>
        )}
      </div>
    </ResponsiveDialog>
  );
}

/** Settings: every active link in one place. */
export function ShareLinksSection({ enabled }: { enabled: boolean }) {
  const [rows, setRows] = useState<ShareRow[] | null>(null);
  const refresh = useCallback(() => {
    void listShares().then((res) => setRows(res.ok ? res.data : []));
  }, []);
  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);
  if (!enabled) return <SharingOff />;
  if (!rows) return <Loader2 className="size-4 animate-spin text-muted" />;
  return <ShareList rows={rows} onChanged={refresh} showLabel />;
}
