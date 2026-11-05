"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Eye, ImageOff, ImagePlus, Loader2, RefreshCw, RotateCcw, Search, TriangleAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { loadCoverRows, type CoverRow, type CoverRows } from "@/actions/covers";
import { refreshAfterBatch, savePhotos } from "@/actions/photos";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { IMAGE_ACCEPT, toJpegIfHeic, uploadPhotos } from "@/lib/upload";
import type { PhotoMeta } from "@/lib/validation";
import { cn, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { FilterChip, Progress, Skeleton } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/components/shell/workspace";

type Kind = CoverRow["kind"];
type Status = "ready" | "saving" | "saved" | "failed";
type Draft = {
  file: File;
  preview: string | null;
  status: Status;
  error?: string;
  /** Set once the file is in storage, so a retry after a failed save doesn't upload it again. */
  meta?: PhotoMeta;
};

/** The three steps that touch the outside world, replaceable so the preview gallery runs without a database. */
export type CoverBackend = {
  load: (tripIds: string[]) => Promise<Omit<CoverRows, "places"> & { places?: CoverRow[] }>;
  upload: (row: CoverRow, file: File) => Promise<PhotoMeta>;
  save: (row: CoverRow, meta: PhotoMeta) => Promise<void>;
  refresh: () => Promise<void>;
};

const WORKERS = 3;
const keyOf = (r: Pick<CoverRow, "kind" | "id">) => `${r.kind}:${r.id}`;
const isOpen = (d: Draft | undefined) => d?.status === "ready" || d?.status === "failed";

function useRealBackend(): CoverBackend {
  const ws = useWorkspace();
  return useMemo(
    () => ({
      load: async (tripIds) => {
        const res = await loadCoverRows(tripIds);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
      upload: async (row, file) => {
        let reason: string | undefined;
        const [meta] = await uploadPhotos(ws.userId, row.kind, row.id, [file], (_, p) => {
          if (p.status === "error") reason = p.error;
        });
        if (!meta) throw new Error(reason ?? "Upload failed");
        return meta;
      },
      save: async (row, meta) => {
        const res = await savePhotos(row.kind, row.id, [meta], { setCover: true, skipRefresh: true });
        if (!res.ok) throw new Error(res.error);
      },
      refresh: async () => {
        await refreshAfterBatch();
      },
    }),
    [ws.userId],
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="relative block h-12 w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-border">
      {src ? (
        <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted" title="No photo">
          <ImageOff className="size-4" />
        </span>
      )}
    </span>
  );
}

const KINDS: { value: Kind; label: string; noun: string; plural: string }[] = [
  { value: "country", label: "Countries", noun: "Country", plural: "countries" },
  { value: "city", label: "Cities", noun: "City", plural: "cities" },
  { value: "place", label: "Places", noun: "Place", plural: "places" },
];

const ROW_GRID = "md:grid-cols-[minmax(0,1.1fr)_5rem_minmax(0,1.05fr)_minmax(0,1.35fr)]";

/** Manage covers: pick new photos row by row, see them, and only then save them all at once. Countries, cities and places alike. */
export function ManageCoversDialog({ tab: initialTab, onOpenChange, tripIds, backend }: { tab: Kind; onOpenChange: (open: boolean) => void; tripIds: string[]; backend?: CoverBackend }) {
  const real = useRealBackend();
  const api = backend ?? real;
  const [rows, setRows] = useState<Record<Kind, CoverRow[]> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Kind>(initialTab);
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [show, setShow] = useState<"all" | "missing" | "selected">("all");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [batch, setBatch] = useState<{ total: number; saved: number; failed: number } | null>(null);
  const [viewing, setViewing] = useState<{ url: string; name: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const urls = useRef(new Set<string>());
  const tripKey = tripIds.join(",");

  useEffect(() => {
    let alive = true;
    api
      .load(tripKey ? tripKey.split(",") : [])
      .then((r) => alive && setRows({ country: r.countries, city: r.cities, place: r.places ?? [] }))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [api, tripKey]);

  useEffect(() => {
    const all = urls.current;
    return () => all.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const unsaved = useMemo(() => Object.values(drafts).filter(isOpen).length, [drafts]);
  const failed = useMemo(() => Object.values(drafts).filter((d) => d.status === "failed").length, [drafts]);

  // Leaving the page would lose the choices too.
  useEffect(() => {
    if (!unsaved && !saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved, saving]);

  const patch = (key: string, next: Partial<Draft>) => setDrafts((d) => (d[key] ? { ...d, [key]: { ...d[key]!, ...next } } : d));

  const choose = (key: string) => {
    target.current = key;
    input.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const key = target.current;
    if (!file || !key) return;
    const isImage = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
    if (!isImage) return void toast.error("That file isn't a photo.");
    if (file.size > MAX_UPLOAD_BYTES) return void toast.error("That photo is larger than 25 MB.");
    const canShow = /image\/(jpeg|png|webp|gif|avif)/.test(file.type);
    const preview = canShow ? URL.createObjectURL(file) : null;
    if (preview) urls.current.add(preview);
    setDrafts((d) => ({ ...d, [key]: { file, preview, status: "ready" } }));
    setLeaving(false);
    if (!canShow) {
      // Most browsers can't show a HEIC, so the preview is a converted copy. The upload still starts from the original.
      try {
        const copy = await toJpegIfHeic(file);
        const url = URL.createObjectURL(copy);
        urls.current.add(url);
        setDrafts((d) => (d[key]?.file === file ? { ...d, [key]: { ...d[key]!, preview: url } } : d));
      } catch {
        // No preview, but the file can still be saved; the row shows its name.
      }
    }
  };

  const cancel = (key: string) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });

  const saveOne = async (row: CoverRow, draft: Draft) => {
    const key = keyOf(row);
    patch(key, { status: "saving", error: undefined });
    try {
      let meta = draft.meta;
      if (!meta) {
        meta = await api.upload(row, draft.file);
        patch(key, { meta });
      }
      await api.save(row, meta);
      patch(key, { status: "saved" });
      // The new photo is the current one from here on, whether or not the window stays open.
      setRows((r) => {
        if (!r) return r;
        const update = (list: CoverRow[]) => list.map((x) => (keyOf(x) === key ? { ...x, url: draft.preview ?? x.url, thumb: draft.preview ?? x.thumb } : x));
        return { country: update(r.country), city: update(r.city), place: update(r.place) };
      });
      return true;
    } catch (e) {
      patch(key, { status: "failed", error: e instanceof Error ? e.message : "Could not save this photo" });
      return false;
    }
  };

  const allRows = useMemo(() => [...(rows?.country ?? []), ...(rows?.city ?? []), ...(rows?.place ?? [])], [rows]);

  const run = async (items: { row: CoverRow; draft: Draft }[]) => {
    if (!items.length || saving) return;
    setSaving(true);
    setLeaving(false);
    setBatch({ total: items.length, saved: 0, failed: 0 });
    let cursor = 0;
    let savedCount = 0;
    const worker = async () => {
      while (cursor < items.length) {
        const item = items[cursor++]!;
        const good = await saveOne(item.row, item.draft);
        if (good) savedCount++;
        setBatch((b) => b && { ...b, saved: b.saved + (good ? 1 : 0), failed: b.failed + (good ? 0 : 1) });
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    if (savedCount) await api.refresh().catch(() => undefined);
    setSaving(false);
    if (savedCount === items.length) toast.success(`${pluralize(savedCount, "cover")} updated`);
    else toast.error(`${pluralize(items.length - savedCount, "cover")} could not be saved`, { description: "Retry them from their rows. The others are done." });
  };

  const openItems = () => allRows.flatMap((row) => {
    const draft = drafts[keyOf(row)];
    return isOpen(draft) ? [{ row, draft: draft! }] : [];
  });
  const saveAll = () => void run(openItems());
  const retry = (row: CoverRow) => {
    const draft = drafts[keyOf(row)];
    if (draft) void run([{ row, draft }]);
  };

  const requestClose = (open: boolean) => {
    if (open) return;
    if (viewing) return setViewing(null);
    if (saving) return void toast("Still saving", { description: "This window can close when it's done." });
    if (unsaved) return setLeaving(true);
    onOpenChange(false);
  };

  const countries = rows?.country ?? [];
  // The City filter offers the chosen country's cities only, and lets go of a city from another country.
  const cityOptions = useMemo(() => (rows?.city ?? []).filter((c) => countryFilter === "all" || c.countryId === countryFilter), [rows, countryFilter]);
  const activeCity = cityOptions.some((c) => c.id === cityFilter) ? cityFilter : "all";
  const kindMeta = KINDS.find((k) => k.value === tab)!;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows?.[tab] ?? []).filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.group.toLowerCase().includes(q)) return false;
      if (tab !== "country" && countryFilter !== "all" && r.countryId !== countryFilter) return false;
      if (tab === "place" && activeCity !== "all" && r.cityId !== activeCity) return false;
      if (show === "missing" && r.url) return false;
      if (show === "selected" && !drafts[keyOf(r)]) return false;
      return true;
    });
  }, [rows, tab, query, countryFilter, activeCity, show, drafts]);

  const countOpen = (kind: Kind) => Object.entries(drafts).filter(([k, d]) => k.startsWith(`${kind}:`) && isOpen(d)).length;

  return (
    <ResponsiveDialog
      open
      onOpenChange={requestClose}
      dismissible={!unsaved && !saving}
      title="Manage covers"
      description="Pick new photos row by row. Nothing on the site changes until you save."
      className="h-[min(88vh,820px)] max-w-5xl"
      bodyClassName="flex flex-col overflow-hidden pb-0"
      footer={
        leaving ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" role="alert" data-testid="unsaved-warning">
            <p className="text-sm font-medium">
              {pluralize(unsaved, "photo")} {unsaved === 1 ? "isn't" : "aren't"} saved yet. Close without saving?
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="danger" onClick={() => onOpenChange(false)}>
                Close without saving
              </Button>
              <Button variant="secondary" onClick={() => setLeaving(false)} autoFocus>
                Keep editing
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-testid="covers-footer">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-sm">
              {batch && saving ? (
                <>
                  <p className="num text-sm font-medium" data-testid="covers-progress">
                    {batch.saved}/{batch.total} saved
                  </p>
                  <Progress value={((batch.saved + batch.failed) / batch.total) * 100} color="var(--visited)" />
                </>
              ) : failed ? (
                <p className="text-sm font-medium text-danger">
                  {pluralize(failed, "photo")} failed{unsaved > failed ? `, ${unsaved - failed} ready` : ""}
                </p>
              ) : unsaved ? (
                <p className="text-sm font-medium" data-testid="covers-ready">
                  {pluralize(unsaved, "change")} ready
                </p>
              ) : (
                <p className="text-sm text-muted">{batch ? "All saved." : "No changes yet."}</p>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => requestClose(false)} disabled={saving}>
                Close
              </Button>
              <Button onClick={saveAll} disabled={!unsaved || saving} data-testid="covers-save">
                {saving && <Loader2 className="animate-spin" />}
                {failed && unsaved === failed ? `Retry failed (${failed})` : "Save all changes"}
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="manage-covers">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
          <TabsList aria-label="Covers of">
            {KINDS.map((k) => (
              <TabsTrigger key={k.value} value={k.value}>
                {k.label}
                {countOpen(k.value) ? <span className="num rounded-full bg-accent-soft px-1.5 text-xs">{countOpen(k.value)}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${kindMeta.plural}`} className="pl-9" aria-label="Search by name" />
          </div>
          {tab !== "country" && (
            <NativeSelect value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} aria-label="Filter by country" className="md:w-48">
              <option value="all">All countries</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {c.name}
                </option>
              ))}
            </NativeSelect>
          )}
          {tab === "place" && (
            <NativeSelect value={activeCity} onChange={(e) => setCityFilter(e.target.value)} aria-label="Filter by city" className="md:w-44">
              <option value="all">All cities</option>
              {cityOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          )}
          <div className="flex gap-1.5">
            <FilterChip active={show === "missing"} onClick={() => setShow(show === "missing" ? "all" : "missing")}>
              No photo
            </FilterChip>
            <FilterChip active={show === "selected"} onClick={() => setShow(show === "selected" ? "all" : "selected")}>
              Selected
            </FilterChip>
          </div>
        </div>

        <div className={cn("hidden gap-3 border-b border-border px-1 pb-1.5 text-xs font-medium text-muted md:grid", ROW_GRID)} aria-hidden>
          <span>{kindMeta.noun}</span>
          <span>Current</span>
          <span>Actions</span>
          <span>Status</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          {loadError ? (
            <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{loadError}</p>
          ) : !rows ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : !visible.length ? (
            <p className="py-10 text-center text-sm text-muted">{rows[tab].length ? "Nothing matches these filters." : tab === "country" ? "No countries on this route yet." : `No ${kindMeta.plural} yet.`}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {visible.map((row) => {
                const key = keyOf(row);
                const draft = drafts[key];
                const busy = draft?.status === "saving";
                const pendingDraft = isOpen(draft) || busy;
                return (
                  <li key={key} className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-1 py-2.5 [contain-intrinsic-size:auto_72px] [content-visibility:auto]", ROW_GRID)} data-testid="cover-row">
                    <div className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
                      <span className="text-xl leading-none">{row.flag}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{row.name}</span>
                        {row.group ? <span className="block truncate text-xs text-muted">{row.group}</span> : null}
                      </span>
                    </div>
                    <Thumb src={row.thumb} alt={`Current cover of ${row.name}`} />
                    <div className="flex flex-wrap items-center gap-1">
                      {row.url && (
                        <Button variant="ghost" size="sm" className="px-2" onClick={() => setViewing({ url: row.url!, name: row.name })} aria-label={`View the cover of ${row.name}`}>
                          <Eye /> View
                        </Button>
                      )}
                      <Button variant={row.url ? "ghost" : "secondary"} size="sm" className="px-2" disabled={busy} onClick={() => choose(key)} aria-label={`${draft ? "Replace the new photo of" : row.url ? "Change the cover of" : "Upload a cover for"} ${row.name}`}>
                        {draft && draft.status !== "saved" ? <RefreshCw /> : row.url ? <ImagePlus /> : <Upload />}
                        {draft && draft.status !== "saved" ? "Replace" : row.url ? "Change" : "Upload photo"}
                      </Button>
                    </div>
                    <div className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1" data-testid="cover-status">
                      {!draft ? (
                        <span className="text-[13px] text-muted">No change</span>
                      ) : draft.status === "saved" ? (
                        <span className="flex items-center gap-1.5 text-[13px] font-medium text-visited">
                          <CircleCheck className="size-4" /> Saved
                        </span>
                      ) : (
                        <>
                          {pendingDraft && (
                            <button type="button" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-accent" onClick={() => draft.preview && setViewing({ url: draft.preview, name: `${row.name}, new photo` })} aria-label={`See the new photo of ${row.name}`}>
                              <Thumb src={draft.preview} alt={`New photo for ${row.name}`} />
                            </button>
                          )}
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            {busy ? (
                              <span className="flex items-center gap-1.5 text-[13px] text-muted">
                                <Loader2 className="size-3.5 animate-spin" /> Saving…
                              </span>
                            ) : draft.status === "failed" ? (
                              <>
                                <span className="flex items-start gap-1 text-xs text-danger" role="alert">
                                  <TriangleAlert className="mt-px size-3.5 shrink-0" />
                                  <span className="min-w-0 break-words">{draft.error}</span>
                                </span>
                                <span className="flex gap-1">
                                  <Button variant="secondary" size="sm" className="h-7 px-2" disabled={saving} onClick={() => retry(row)}>
                                    <RotateCcw /> Retry
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 px-2" disabled={saving} onClick={() => cancel(key)}>
                                    Cancel
                                  </Button>
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="truncate text-[13px] font-medium">New photo selected</span>
                                {!draft.preview && <span className="truncate text-xs text-muted">{draft.file.name}</span>}
                                <button type="button" onClick={() => cancel(key)} disabled={saving} className="inline-flex w-fit items-center gap-1 text-xs text-muted hover:text-ink" aria-label={`Cancel the new photo of ${row.name}`}>
                                  <X className="size-3" /> Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        data-testid="cover-file"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {viewing && (
        <div className="absolute inset-0 z-20 flex flex-col bg-black/90" role="dialog" aria-label={viewing.name}>
          <div className="flex items-center justify-between gap-3 p-3 text-white">
            <p className="min-w-0 truncate text-sm font-medium">{viewing.name}</p>
            <button type="button" autoFocus onClick={() => setViewing(null)} className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close the photo">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 place-items-center p-3 pt-0">
            <img src={viewing.url} alt={viewing.name} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </ResponsiveDialog>
  );
}
