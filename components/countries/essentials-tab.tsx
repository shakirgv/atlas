"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Car, Coins, ExternalLink, Info, Landmark, Loader2, NotebookPen, Pencil, Phone, Plug, Plus, Printer, Siren } from "lucide-react";
import { toast } from "sonner";
import { saveCountryInfo, type CountryInfoPatch } from "@/actions/country-info";
import { getCountry } from "@/lib/countries";
import { EXTRAS_REVIEWED } from "@/lib/country-extras";
import { mergeCountryInfo, parsePlugs, safeUrl, tapWaterLabel, telHref, type InfoOverride, type InfoTextField, type Merged } from "@/lib/country-info";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

function EditedDot({ edited }: { edited: boolean }) {
  if (!edited) return null;
  return (
    <span title="Edited by you" className="inline-flex size-1.5 shrink-0 rounded-full bg-accent">
      <span className="sr-only">Edited by you</span>
    </span>
  );
}

function SectionCard({ icon: Icon, title, children, className }: { icon: typeof Plug; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card flex flex-col gap-3 p-5", className)} aria-label={title}>
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Icon className="size-5 text-accent" /> {title}
      </h2>
      {children}
    </section>
  );
}

/** One fact with inline editing. Empty shows "Add"; clearing an edit restores the baseline. */
function EditableValue({
  label,
  merged,
  onSave,
  multiline,
  placeholder,
  render,
  toDraft,
  saving,
}: {
  label: string;
  merged: Merged<string> | Merged<string[]>;
  onSave: (draft: string) => void;
  multiline?: boolean;
  placeholder?: string;
  render?: (value: string) => React.ReactNode;
  toDraft?: (value: string) => string;
  saving: boolean;
}) {
  const current = Array.isArray(merged.value) ? merged.value.join(", ") : (merged.value ?? "");
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    if (draft.trim() !== current) onSave(draft);
    setDraft(null);
  };
  if (draft !== null) {
    const shared = {
      autoFocus: true,
      value: draft,
      placeholder,
      "aria-label": label,
      onBlur: commit,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    };
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        {multiline ? <Textarea rows={4} {...shared} /> : <Input {...shared} onKeyDown={(e) => e.key === "Escape" && setDraft(null)} />}
      </form>
    );
  }
  if (!current) {
    return (
      <button type="button" onClick={() => setDraft("")} className="inline-flex min-h-9 items-center gap-1 self-start rounded-lg text-sm font-medium text-accent hover:underline">
        <Plus className="size-3.5" /> Add
        <span className="sr-only">{label}</span>
      </button>
    );
  }
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <span className="min-w-0 whitespace-pre-wrap break-words text-sm">{render ? render(current) : current}</span>
      <EditedDot edited={merged.edited} />
      <button type="button" onClick={() => setDraft(toDraft ? toDraft(current) : current)} className="-my-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label={`Edit ${label.toLowerCase()}`}>
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
      </button>
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-border pt-2.5 first:border-t-0 first:pt-0">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

const EMERGENCY: { field: InfoTextField; label: string }[] = [
  { field: "emergency_general", label: "General" },
  { field: "emergency_police", label: "Police" },
  { field: "emergency_ambulance", label: "Ambulance" },
  { field: "emergency_fire", label: "Fire" },
];

/** Country tab "Essentials": bundled facts, world-countries data and my own edits on one screen. */
export function EssentialsTab({ code, countryId, override }: { code: string; countryId: string; override: InfoOverride }) {
  const info = getCountry(code);
  const [own, setOwn] = useState<InfoOverride>(override);
  const [pending, start] = useTransition();
  const merged = mergeCountryInfo(code, own);

  const save = (patch: CountryInfoPatch) => {
    const before = own;
    setOwn({ ...own, ...(patch as object) });
    start(async () => {
      const res = await saveCountryInfo(code, patch);
      if (!res.ok) {
        toast.error(res.error);
        setOwn(before);
      }
    });
  };
  const field = (name: InfoTextField, label: string, opts?: { multiline?: boolean; placeholder?: string; render?: (v: string) => React.ReactNode }) => (
    <EditableValue label={label} merged={merged[name]} saving={pending} onSave={(v) => save({ [name]: v })} {...opts} />
  );
  const reviewed = fmtDate(`${EXTRAS_REVIEWED}-01`, "MMMM yyyy");
  const emergency = EMERGENCY.filter((e) => merged[e.field].value);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 rounded-xl bg-planned-soft px-3 py-2 text-sm text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-[#b57a14] dark:text-planned" />
          <span>General information, verify before you travel. Baseline written in {reviewed}; a dot marks what you edited.</span>
        </p>
        <Button variant="secondary" asChild className="shrink-0">
          <Link href={`/countries/${countryId}/card`}>
            <Printer /> Print / Save as PDF
          </Link>
        </Button>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
        <SectionCard icon={Siren} title="Emergency" className="md:col-span-2 lg:col-span-1">
          {emergency.length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {emergency.map((e) => {
                const value = merged[e.field].value!;
                const href = telHref(value);
                return (
                  <li key={e.field}>
                    <a href={href ?? undefined} className="flex min-h-14 flex-col justify-center rounded-xl bg-danger-soft px-3 py-2 hover:bg-danger/15">
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        {e.label} <EditedDot edited={merged[e.field].edited} />
                      </span>
                      <span className="num flex items-center gap-1.5 font-display text-2xl font-semibold leading-tight">
                        <Phone className="size-4 text-danger" /> {value}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted hover:text-ink">{emergency.length ? "Edit numbers" : "Add numbers"}</summary>
            <div className="mt-2 flex flex-col gap-2.5">
              {EMERGENCY.map((e) => (
                <Row key={e.field} label={e.label}>
                  {field(e.field, `${e.label} number`, { placeholder: "e.g. 112" })}
                </Row>
              ))}
            </div>
          </details>
        </SectionCard>

        <SectionCard icon={Plug} title="Power">
          <Row label="Plug types">
            <EditableValue
              label="Plug types"
              merged={merged.plugs}
              saving={pending}
              placeholder="e.g. A, B"
              onSave={(v) => save({ plugs: parsePlugs(v) })}
              render={(v) => (
                <span className="flex flex-wrap gap-1">
                  {v.split(", ").map((p) => (
                    <span key={p} className="num grid size-7 place-items-center rounded-lg bg-surface-2 text-sm font-semibold ring-1 ring-border">
                      {p}
                    </span>
                  ))}
                </span>
              )}
            />
          </Row>
          <Row label="Voltage">{field("voltage", "Voltage", { placeholder: "e.g. 230 V" })}</Row>
          <Row label="Frequency">{field("frequency", "Frequency", { placeholder: "e.g. 50 Hz" })}</Row>
        </SectionCard>

        <SectionCard icon={Coins} title="Money">
          <Row label="Currency">
            <span className="text-sm">{info?.currencies.map((c) => `${c.name} (${c.code}${c.symbol ? ` · ${c.symbol}` : ""})`).join(", ") || "Unknown"}</span>
          </Row>
          <Row label="Tipping">{field("tipping", "Tipping", { multiline: true })}</Row>
        </SectionCard>

        <SectionCard icon={Phone} title="Communication">
          <Row label="Calling code">
            <span className="num text-sm">{info?.idd ?? "Unknown"}</span>
          </Row>
          <Row label="Languages">
            <span className="text-sm">{info?.languages.join(", ") || "Unknown"}</span>
          </Row>
          <Row label="SIM tips">{field("sim_tips", "SIM tips", { multiline: true, placeholder: "Which carrier or eSIM worked for you?" })}</Row>
        </SectionCard>

        <SectionCard icon={Car} title="Getting around">
          <Row label="Driving side">
            <span className="text-sm">{merged.driving ? `Drive on the ${merged.driving}` : "Unknown"}</span>
          </Row>
          <Row label="Tap water">{field("tap_water", "Tap water", { render: (v) => tapWaterLabel(v) })}</Row>
        </SectionCard>

        <SectionCard icon={Landmark} title="Embassy">
          <p className="text-xs text-muted">Your home country&apos;s embassy, entered by you.</p>
          <Row label="Name">{field("embassy_name", "Embassy name")}</Row>
          <Row label="Phone">
            {field("embassy_phone", "Embassy phone", {
              render: (v) => {
                const href = telHref(v);
                return href ? (
                  <a href={href} className="font-medium text-accent hover:underline">
                    {v}
                  </a>
                ) : (
                  v
                );
              },
            })}
          </Row>
          <Row label="Address">{field("embassy_address", "Embassy address", { multiline: true })}</Row>
          <Row label="Website">
            {field("embassy_url", "Embassy website", {
              placeholder: "https://",
              render: (v) => {
                const href = safeUrl(v);
                return href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                    Open website <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  v
                );
              },
            })}
          </Row>
        </SectionCard>

        <SectionCard icon={NotebookPen} title="My notes" className="md:col-span-2 lg:col-span-3">
          {field("notes", "My notes", { multiline: true, placeholder: "Anything you want on the printed card" })}
        </SectionCard>
      </div>
    </div>
  );
}
