"use client";
import { useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FileUp, Paperclip, X } from "lucide-react";
import { attachDocumentFile, createDocument, updateDocument } from "@/actions/documents";
import { documentSchema, type z } from "@/lib/validation";
import { DOCUMENT_TYPES, type DocumentRow } from "@/lib/types";
import { DOCUMENT_TYPE_META } from "@/lib/icons";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { DOCUMENT_ACCEPT, uploadDocumentFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useWorkspace } from "@/components/shell/workspace";
import { ChoiceChips, MoreDetails, SubmitButton } from "./form-bits";

type In = z.input<typeof documentSchema>;
type Out = z.output<typeof documentSchema>;

function fmtSize(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

export function DocumentDialog({ open, onOpenChange, document }: { open: boolean; onOpenChange: (o: boolean) => void; document?: DocumentRow | null }) {
  const ws = useWorkspace();
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(documentSchema),
    values: {
      title: document?.title ?? "",
      type: (document?.type as Out["type"]) ?? "passport",
      trip_id: document?.trip_id ?? (ws.isAll ? "" : (ws.activeTripId ?? "")),
      trip_country_id: document?.trip_country_id ?? "",
      issue_date: document?.issue_date ?? "",
      expiry_date: document?.expiry_date ?? "",
      reference_no: document?.reference_no ?? "",
      notes: document?.notes ?? "",
    },
  });
  const { register, handleSubmit, control, watch, setValue, formState } = form;
  const tripId = watch("trip_id");

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_UPLOAD_BYTES) return void toast.error("Files must be 25 MB or smaller");
    if (!/\.(pdf|jpe?g|png|heic|heif|docx)$/i.test(f.name)) return void toast.error("Use PDF, JPG, PNG, HEIC or DOCX");
    setFile(f);
    if (!watch("title")) setValue("title", f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      let id = document?.id;
      if (document) {
        const res = await updateDocument(document.id, values);
        if (!res.ok) return void toast.error(res.error);
      } else {
        const res = await createDocument(values);
        if (!res.ok) return void toast.error(res.error);
        id = res.data.id;
      }
      if (file && id) {
        try {
          const uploaded = await uploadDocumentFile(ws.userId, id, file);
          const res = await attachDocumentFile(id, uploaded);
          if (!res.ok) throw new Error(res.error);
        } catch (e) {
          return void toast.error(e instanceof Error ? e.message : "Upload failed");
        }
      }
      toast.success(document ? "Document updated" : "Document saved");
      setFile(null);
      onOpenChange(false);
    }),
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={document ? "Edit document" : "Upload a document"}
      description={document ? undefined : "Files are private and open only through 5-minute links."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton form="document-form" pending={pending}>
            {document ? "Save changes" : "Save document"}
          </SubmitButton>
        </>
      }
    >
      <form id="document-form" onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-sm transition-colors hover:border-accent/50",
            over && "border-accent bg-accent-soft",
          )}
        >
          {file ? (
            <>
              <Paperclip className="size-5 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{file.name}</span>
                <span className="text-xs text-muted">{fmtSize(file.size)}</span>
              </span>
              <button type="button" aria-label="Remove file" onClick={(e) => (e.stopPropagation(), setFile(null))} className="text-muted">
                <X className="size-4" />
              </button>
            </>
          ) : (
            <>
              <FileUp className="size-5 text-accent" />
              <span className="text-muted">
                <span className="font-medium text-ink">{document?.file_name ? "Replace file" : "Drop a file"}</span> or tap to choose
                <span className="block text-xs">PDF, JPG, PNG, HEIC, DOCX · up to 25 MB{document?.file_name ? ` · current: ${document.file_name}` : ""}</span>
              </span>
            </>
          )}
          <input ref={inputRef} type="file" hidden accept={DOCUMENT_ACCEPT} onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
        </div>
        <Field label="Title" htmlFor="doc-title" error={formState.errors.title?.message}>
          <Input id="doc-title" placeholder="Passport" {...register("title")} />
        </Field>
        <Field label="Type">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <ChoiceChips name="Document type" value={field.value} onChange={field.onChange} options={DOCUMENT_TYPES.map((t) => ({ value: t, label: DOCUMENT_TYPE_META[t].label, icon: DOCUMENT_TYPE_META[t].icon }))} />
            )}
          />
        </Field>
        <Field label="Expiry date" htmlFor="doc-expiry" error={formState.errors.expiry_date?.message} hint="We'll warn you 90 and 30 days before.">
          <Input id="doc-expiry" type="date" {...register("expiry_date")} />
        </Field>
        <MoreDetails defaultOpen={Boolean(document?.reference_no || document?.trip_id)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date" htmlFor="doc-issue">
              <Input id="doc-issue" type="date" {...register("issue_date")} />
            </Field>
            <Field label="Reference no." htmlFor="doc-ref">
              <Input id="doc-ref" {...register("reference_no")} />
            </Field>
            <Field label="Trip" htmlFor="doc-trip">
              <NativeSelect id="doc-trip" {...register("trip_id")} onChange={(e) => { setValue("trip_id", e.target.value); setValue("trip_country_id", ""); }}>
                <option value="">Not trip-specific</option>
                {ws.trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Country" htmlFor="doc-country">
              <NativeSelect id="doc-country" {...register("trip_country_id")} disabled={!tripId}>
                <option value="">—</option>
                {ws.countries
                  .filter((c) => c.trip_id === tripId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flag} {c.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Notes" htmlFor="doc-notes">
            <Textarea id="doc-notes" {...register("notes")} />
          </Field>
        </MoreDetails>
      </form>
    </ResponsiveDialog>
  );
}
