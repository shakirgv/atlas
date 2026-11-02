"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Download, ExternalLink, FileText, Loader2, MoreHorizontal, Paperclip, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDocument, getDocumentUrl } from "@/actions/documents";
import type { Alert } from "@/lib/alerts";
import type { EntryRow } from "@/lib/entry";
import { DOCUMENT_TYPES, type DocumentRow, type DocumentType } from "@/lib/types";
import { DOCUMENT_TYPE_META } from "@/lib/icons";
import { fmtDate } from "@/lib/dates";
import { cn, pluralize } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { DocumentDialog } from "@/components/forms/document-dialog";
import { EntryTable } from "@/components/entry/entry-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FilterChip } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useWorkspace } from "@/components/shell/workspace";
import { ExpiryChip, expiryLevel } from "./expiry-chip";

function fmtSize(n: number | null) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

function Preview({ doc, onClose }: { doc: DocumentRow; onClose: () => void }) {
  const [state, setState] = useState<{ url: string; mime: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, start] = useTransition();
  const meta = DOCUMENT_TYPE_META[doc.type as DocumentType] ?? DOCUMENT_TYPE_META.other;

  useEffect(() => {
    if (!doc.file_path) return;
    let alive = true;
    void getDocumentUrl(doc.id).then((res) => {
      if (!alive) return;
      if (res.ok) setState({ url: res.data.url, mime: res.data.mime });
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [doc.id, doc.file_path]);

  const download = () =>
    start(async () => {
      const res = await getDocumentUrl(doc.id, true);
      if (!res.ok) return void toast.error(res.error);
      window.location.href = res.data.url;
    });

  const isImage = state?.mime && /^image\/(jpeg|png|webp|gif)/.test(state.mime);
  const isPdf = state?.mime === "application/pdf";

  return (
    <ResponsiveDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={doc.title}
      description={[meta.label, doc.reference_no, doc.expiry_date ? `Expires ${fmtDate(doc.expiry_date)}` : null].filter(Boolean).join(" · ")}
      className="max-w-4xl"
      footer={
        doc.file_path ? (
          <>
            {state && (
              <Button variant="secondary" asChild>
                <a href={state.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Open in new tab
                </a>
              </Button>
            )}
            <Button onClick={download} disabled={downloading}>
              {downloading ? <Loader2 className="animate-spin" /> : <Download />} Download
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="pb-2">
        {!doc.file_path ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-2 px-6 py-12 text-center text-sm text-muted">
            <Paperclip className="size-6 text-accent" />
            No file attached. Edit the document to upload one.
          </div>
        ) : error ? (
          <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{error}</p>
        ) : !state ? (
          <div className="grid h-80 place-items-center">
            <Loader2 className="size-6 animate-spin text-muted" />
          </div>
        ) : isImage ? (
          <img src={state.url} alt={doc.title} className="mx-auto max-h-[65vh] rounded-xl object-contain" />
        ) : isPdf ? (
          <iframe src={state.url} title={doc.title} className="h-[65vh] w-full rounded-xl border border-border bg-white" />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-2 px-6 py-12 text-center text-sm text-muted">
            <FileText className="size-6 text-accent" />
            {doc.file_name} can’t be previewed here. Download it to open.
          </div>
        )}
        {doc.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{doc.notes}</p>}
        <p className="mt-3 text-xs text-muted">Links expire after 5 minutes for privacy.</p>
      </div>
    </ResponsiveDialog>
  );
}

export function DocumentsView({
  documents,
  warnings,
  trips,
  countries,
  openId,
  initialTab,
  entryRows,
  showTrip,
}: {
  documents: DocumentRow[];
  warnings: Alert[];
  trips: { id: string; title: string }[];
  countries: { id: string; name: string; flag: string }[];
  openId: string | null;
  initialTab: "documents" | "entry";
  entryRows: EntryRow[];
  showTrip: boolean;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const confirm = useConfirm();
  const [type, setType] = useState<DocumentType | "all">("all");
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [, start] = useTransition();
  const open = documents.find((d) => d.id === openId) ?? null;
  const setOpen = (id: string | null) => router.push(id ? `${pathname}?open=${id}` : pathname, { scroll: false });

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: documents.length };
    documents.forEach((d) => (m[d.type] = (m[d.type] ?? 0) + 1));
    return m;
  }, [documents]);
  const filtered = documents.filter((d) => type === "all" || d.type === type);
  const groups = DOCUMENT_TYPES.map((t) => ({ t, list: filtered.filter((d) => d.type === t) })).filter((g) => g.list.length);
  const expiring = documents.filter((d) => ["soon", "urgent"].includes(expiryLevel(d.expiry_date))).length;
  const entryProblems = entryRows.filter((r) => r.warnings.some((w) => w.level !== "info")).length;
  const changeTab = (v: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", v);
    window.history.replaceState(null, "", url);
  };

  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Track"
        title="Documents"
        description={documents.length ? `${pluralize(documents.length, "document")}${expiring ? ` · ${expiring} expiring soon` : ""} · private, opened by 5-minute links` : "Passport, visas, tickets and insurance — private and always at hand."}
        actions={
          <Button onClick={() => ws.openQuickAdd("document")}>
            <Plus /> Upload document
          </Button>
        }
      />
      {warnings.map((w) => (
        <div key={w.id} role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
          <div className="flex-1">
            <p className="font-medium">{w.title}</p>
            <p className="text-sm text-muted">{w.detail}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => router.push(w.href, { scroll: false })}>
            Review
          </Button>
        </div>
      ))}
      <Tabs defaultValue={initialTab} onValueChange={changeTab}>
        <TabsList aria-label="Documents sections">
          <TabsTrigger value="documents">
            <FileText /> All documents
          </TabsTrigger>
          <TabsTrigger value="entry">
            <ShieldCheck /> Visas &amp; entry
            {entryProblems > 0 && <span className="num rounded-full bg-danger-soft px-1.5 text-xs text-ink">{entryProblems}</span>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entry">
          <EntryTable rows={entryRows} showTrip={showTrip} />
        </TabsContent>
        <TabsContent value="documents" className="flex flex-col gap-6">
      {!documents.length ? (
        <EmptyState icon={FileText} title="No documents yet" description="Upload your passport first — Atlas checks it stays valid 6 months after each trip." action={<Button onClick={() => ws.openQuickAdd("document")}><Plus /> Upload your passport</Button>} />
      ) : (
        <>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            <FilterChip active={type === "all"} onClick={() => setType("all")}>
              All <span className="num text-xs opacity-60">{counts.all}</span>
            </FilterChip>
            {DOCUMENT_TYPES.filter((t) => counts[t]).map((t) => {
              const m = DOCUMENT_TYPE_META[t];
              return (
                <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
                  <m.icon /> {m.label} <span className="num text-xs opacity-60">{counts[t]}</span>
                </FilterChip>
              );
            })}
          </div>
          <div className="flex flex-col gap-8">
            {groups.map(({ t, list }) => {
              const m = DOCUMENT_TYPE_META[t];
              return (
                <section key={t} aria-label={m.label}>
                  <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold">
                    <m.icon className="size-5 text-accent" /> {m.label}
                  </h2>
                  <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((d) => {
                      const level = expiryLevel(d.expiry_date);
                      const country = countries.find((c) => c.id === d.trip_country_id);
                      const trip = trips.find((x) => x.id === d.trip_id);
                      return (
                        <StaggerItem key={d.id}>
                          <div className={cn("card card-hover relative flex h-full flex-col gap-4 p-5", level === "urgent" && "border-danger/40", level === "soon" && "border-planned/50")}>
                            <button type="button" onClick={() => setOpen(d.id)} className="absolute inset-0 rounded-[16px]" aria-label={`Open ${d.title}`} />
                            <div className="flex items-start gap-3">
                              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft">
                                <m.icon className="size-6 text-accent" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate font-display text-lg font-semibold">{d.title}</h3>
                                <p className="truncate text-xs text-muted">
                                  {[d.reference_no, country ? `${country.flag} ${country.name}` : trip?.title].filter(Boolean).join(" · ") || m.label}
                                </p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger className="relative z-10 grid size-9 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label="Document actions">
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onSelect={() => setEditing(d)}>
                                    <Pencil /> Edit / replace file
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    destructive
                                    onSelect={async () => {
                                      if (!(await confirm({ title: `Delete “${d.title}”?`, description: "The file is removed from storage too.", confirmLabel: "Delete document" }))) return;
                                      start(async () => {
                                        const res = await deleteDocument(d.id);
                                        if (!res.ok) toast.error(res.error);
                                        else toast.success("Document deleted");
                                      });
                                    }}
                                  >
                                    <Trash2 /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                              {d.expiry_date ? <ExpiryChip expiry={d.expiry_date} /> : <span className="text-xs text-muted">No expiry date</span>}
                              <span className="flex items-center gap-1 text-xs text-muted">
                                {d.file_path ? (
                                  <>
                                    <Paperclip className="size-3.5" /> {fmtSize(d.size_bytes) || "File"}
                                  </>
                                ) : (
                                  "No file"
                                )}
                              </span>
                            </div>
                          </div>
                        </StaggerItem>
                      );
                    })}
                  </Stagger>
                </section>
              );
            })}
          </div>
        </>
      )}
        </TabsContent>
      </Tabs>
      {open && <Preview key={open.id} doc={open} onClose={() => setOpen(null)} />}
      {editing && <DocumentDialog open onOpenChange={(o) => !o && setEditing(null)} document={editing} />}
    </PageTransition>
  );
}
