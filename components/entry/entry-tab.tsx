"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarCheck, ExternalLink, FileText, ListChecks, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { markEntryVerified, saveEntryRequirement } from "@/actions/entry";
import { countryFlag, countryName } from "@/lib/countries";
import { safeUrl } from "@/lib/country-info";
import { fmtDate, todayIso } from "@/lib/dates";
import { ENTRY_STATUS_META, entryStatus, entryWarnings, IATA_TRAVEL_CENTRE, isEntryReady, parseChecklist, REQUIREMENT_META, requirementType, starterChecklist, suggestedApplyBy, validityRuleApplies, type ChecklistItem } from "@/lib/entry";
import { ENTRY_STATUSES, REQUIREMENT_TYPES, type EntryRequirement, type EntryStatus, type RequirementType, type ValidityRuleFrom } from "@/lib/types";
import type { EntryPatch } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { MoreDetails } from "@/components/forms/form-bits";
import { EntryReadyChip, EntryStatusChip, EntryWarningChip } from "./entry-chips";

type Draft = Pick<EntryRequirement, "allowed_stay_days" | "apply_by" | "applied_on" | "valid_from" | "valid_until" | "fee" | "fee_currency" | "official_url" | "notes" | "last_verified_on" | "document_id" | "validity_rule_months" | "validity_rule_from" | "validity_rule_passport"> & {
  requirement_type: RequirementType;
  status: EntryStatus;
  checklist: ChecklistItem[];
};

function toDraft(r: EntryRequirement | null | undefined): Draft {
  return {
    requirement_type: requirementType(r?.requirement_type),
    status: entryStatus(r?.status),
    allowed_stay_days: r?.allowed_stay_days ?? null,
    apply_by: r?.apply_by ?? null,
    applied_on: r?.applied_on ?? null,
    valid_from: r?.valid_from ?? null,
    valid_until: r?.valid_until ?? null,
    fee: r?.fee ?? null,
    fee_currency: r?.fee_currency ?? null,
    official_url: r?.official_url ?? null,
    notes: r?.notes ?? null,
    last_verified_on: r?.last_verified_on ?? null,
    document_id: r?.document_id ?? null,
    validity_rule_months: r?.validity_rule_months ?? null,
    validity_rule_from: r?.validity_rule_from ?? null,
    validity_rule_passport: r?.validity_rule_passport ?? null,
    checklist: parseChecklist(r?.checklist),
  };
}

export type EntryDocument = { id: string; title: string; type: string };

export function EntryTab({
  tripCountryId,
  arrive,
  depart,
  requirement,
  passportCountry,
  passportExpiry,
  documents,
}: {
  tripCountryId: string;
  arrive: string | null;
  depart: string | null;
  requirement: EntryRequirement | null | undefined;
  passportCountry: string | null;
  passportExpiry: string | null;
  documents: EntryDocument[];
}) {
  const [req, setReq] = useState<Draft>(() => toDraft(requirement));
  const [newItem, setNewItem] = useState("");
  const [pending, start] = useTransition();
  const today = todayIso();
  const warnings = entryWarnings(req, { arrive, depart, today, passportExpiry, passportCountry });
  const ready = isEntryReady(req, warnings);
  const passport = passportCountry?.trim() || null;
  const officialHref = safeUrl(req.official_url) ?? IATA_TRAVEL_CENTRE;
  const suggestion = suggestedApplyBy(req.requirement_type, arrive);
  const doneCount = req.checklist.filter((i) => i.done).length;

  const ruleApplies = validityRuleApplies(req, passport);
  const visaFree = req.requirement_type === "visa_free";
  const savedApplication = [req.apply_by, req.applied_on, req.valid_from, req.valid_until, req.fee, req.fee_currency].filter((v) => v != null && v !== "").length;

  /** Every field saves on its own; a failed save puts the old value back. `local` is what the server works out for itself. */
  const save = (patch: Partial<Draft>, local?: Partial<Draft>) => {
    const before = req;
    setReq({ ...req, ...patch, ...local });
    start(async () => {
      const res = await saveEntryRequirement(tripCountryId, patch as EntryPatch);
      if (!res.ok) {
        toast.error(res.error);
        setReq(before);
      }
    });
  };

  const changeType = (type: RequirementType) => {
    const patch: Partial<Draft> = { requirement_type: type };
    if (!req.checklist.length) patch.checklist = starterChecklist(type);
    // Sensible next status, only while I have not chosen one myself.
    if (req.status === "not_checked") {
      if (type === "visa_free") patch.status = "not_needed";
      if (type === "e_visa" || type === "visa_required" || type === "visa_on_arrival") patch.status = "to_apply";
    }
    save(patch);
  };

  const saveRule = (months: number | null, from: ValidityRuleFrom) => save({ validity_rule_months: months, validity_rule_from: months ? from : null }, { validity_rule_passport: months ? passport : null });
  const ruleFrom: ValidityRuleFrom = req.validity_rule_from === "arrival" ? "arrival" : "departure";

  const setChecklist = (checklist: ChecklistItem[]) => save({ checklist });
  const addItem = () => {
    const label = newItem.trim();
    if (!label) return;
    setChecklist([...req.checklist, { id: crypto.randomUUID(), label, done: false }]);
    setNewItem("");
  };

  const verify = () =>
    start(async () => {
      const res = await markEntryVerified(tripCountryId);
      if (!res.ok) return void toast.error(res.error);
      setReq((r) => ({ ...r, last_verified_on: res.data.date }));
      toast.success("Marked as verified today");
    });

  /** Text and date inputs commit on blur, so half-typed values are never saved. */
  const committed = (key: keyof Draft, type: "text" | "date" | "number" | "url" = "text", extra?: React.ComponentProps<typeof Input>) => (
    <Input
      key={String(req[key] ?? "")}
      type={type}
      defaultValue={(req[key] as string | number | null) ?? ""}
      onBlur={(e) => e.target.value !== String(req[key] ?? "") && save({ [key]: e.target.value } as Partial<Draft>)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      {...extra}
    />
  );

  const applicationFields = (
    <>
          <Field label="Apply by" htmlFor="entry-apply-by" hint={!req.apply_by && suggestion ? `A month before arrival would be ${fmtDate(suggestion)}.` : undefined}>
            {committed("apply_by", "date", { id: "entry-apply-by" })}
            {!req.apply_by && suggestion && (
              <button type="button" onClick={() => save({ apply_by: suggestion })} className="min-h-9 self-start text-xs font-medium text-accent hover:underline">
                Use {fmtDate(suggestion, "dd MMM")}
              </button>
            )}
          </Field>
          <Field label="Applied on" htmlFor="entry-applied">
            {committed("applied_on", "date", { id: "entry-applied" })}
          </Field>
          {!visaFree && <div className="hidden sm:block" />}
          <Field label="Valid from" htmlFor="entry-from">
            {committed("valid_from", "date", { id: "entry-from" })}
          </Field>
          <Field label="Valid until" htmlFor="entry-until">
            {committed("valid_until", "date", { id: "entry-until" })}
          </Field>
          <Field label="Fee" htmlFor="entry-fee">
            {committed("fee", "number", { id: "entry-fee", min: 0, step: "0.01", inputMode: "decimal" })}
          </Field>
          <Field label="Fee currency" htmlFor="entry-fee-cur">
            <Input
              key={req.fee_currency ?? ""}
              id="entry-fee-cur"
              defaultValue={req.fee_currency ?? ""}
              maxLength={3}
              placeholder="USD"
              className="uppercase"
              onBlur={(e) => e.target.value.toUpperCase() !== (req.fee_currency ?? "") && save({ fee_currency: e.target.value.toUpperCase() })}
            />
          </Field>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-3 p-5" aria-label="Entry summary">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {passport ? (
              <p className="font-display text-lg font-semibold">
                Requirements for passport: {countryFlag(passport)} {countryName(passport)}
              </p>
            ) : (
              <p className="text-sm">
                <span className="font-medium">Which passport are you travelling on?</span>{" "}
                <Link href="/settings#home" className="font-medium text-accent hover:underline">
                  Set your passport country
                </Link>
              </p>
            )}
            <p className="mt-0.5 text-xs text-muted">
              Nothing here is pre-filled: rules change and depend on your passport, so you enter them from an official source.
              {req.last_verified_on ? ` Last verified ${fmtDate(req.last_verified_on)}.` : " Not verified yet."}
            </p>
            {passportExpiry && <p className="mt-0.5 text-xs text-muted">Your passport expires {fmtDate(passportExpiry)}.</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" size="sm" asChild>
              <a href={officialHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> Check official sources
              </a>
            </Button>
            <Button size="sm" onClick={verify} disabled={pending || req.last_verified_on === today}>
              {pending ? <Loader2 className="animate-spin" /> : <CalendarCheck />} {req.last_verified_on === today ? "Verified today" : "Mark as verified today"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Entry status">
          <EntryStatusChip status={req.status} />
          {ready && <EntryReadyChip />}
          {warnings.map((w) => (
            <EntryWarningChip key={w.id} warning={w} />
          ))}
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className="card flex flex-col gap-4 p-5" aria-label="Requirement">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="size-5 text-accent" /> Requirement
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type" htmlFor="entry-type">
              <NativeSelect id="entry-type" value={req.requirement_type} onChange={(e) => changeType(e.target.value as RequirementType)}>
                {REQUIREMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {REQUIREMENT_META[t].label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Status" htmlFor="entry-status">
              <NativeSelect id="entry-status" value={req.status} onChange={(e) => save({ status: e.target.value as EntryStatus })}>
                {ENTRY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ENTRY_STATUS_META[s].label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Allowed stay (days)" htmlFor="entry-stay">
              {committed("allowed_stay_days", "number", { id: "entry-stay", min: 1, inputMode: "numeric", placeholder: "e.g. 30" })}
            </Field>
            {!visaFree && applicationFields}
          </div>
          {visaFree && (
            <MoreDetails label={savedApplication ? `Application and fees (${savedApplication} saved)` : "Application and fees"}>
              <div className="grid gap-3 sm:grid-cols-2">{applicationFields}</div>
            </MoreDetails>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Official source" htmlFor="entry-url" hint="The government or embassy page you checked.">
              {committed("official_url", "url", { id: "entry-url", placeholder: "https://" })}
            </Field>
            <div className="flex flex-col gap-1.5" data-testid="entry-last-verified">
              <p className="text-[13px] font-medium text-ink/90">Last verified</p>
              <p className="flex h-10 items-center text-sm max-md:h-11">{req.last_verified_on ? fmtDate(req.last_verified_on) : <span className="text-muted">Not verified yet</span>}</p>
            </div>
          </div>
          <Field
            label="Passport validity rule"
            htmlFor="entry-rule-months"
            hint={
              !passport
                ? "Set your passport country first: a rule belongs to one passport."
                : ruleApplies
                  ? `Recorded for your ${countryName(passport)} passport.`
                  : req.validity_rule_months && req.validity_rule_passport
                    ? `A ${req.validity_rule_months}-month rule is recorded for a ${countryName(req.validity_rule_passport.trim())} passport, so it isn't applied to yours.`
                    : "Only fill this in from an official source. With no rule, the passport's expiry date is only compared with your dates."
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                key={`${ruleApplies ? req.validity_rule_months : ""}`}
                id="entry-rule-months"
                type="number"
                min={1}
                max={24}
                inputMode="numeric"
                placeholder="No rule"
                aria-label="Months of validity needed"
                disabled={!passport}
                defaultValue={ruleApplies ? (req.validity_rule_months ?? "") : ""}
                onBlur={(e) => {
                  const months = e.target.value ? Number(e.target.value) : null;
                  if (months !== (ruleApplies ? req.validity_rule_months : null)) saveRule(months, ruleFrom);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
              <NativeSelect aria-label="Counted from" value={ruleFrom} disabled={!ruleApplies} onChange={(e) => saveRule(req.validity_rule_months, e.target.value as ValidityRuleFrom)}>
                <option value="departure">months after departure</option>
                <option value="arrival">months after arrival</option>
              </NativeSelect>
            </div>
          </Field>
          <Field label="Notes" htmlFor="entry-notes">
            <Textarea key={req.notes ?? ""} id="entry-notes" rows={3} defaultValue={req.notes ?? ""} onBlur={(e) => e.target.value !== (req.notes ?? "") && save({ notes: e.target.value })} />
          </Field>
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <section className="card flex flex-col gap-3 p-5" aria-label="Checklist">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <ListChecks className="size-5 text-accent" /> Checklist
              </h2>
              {req.checklist.length > 0 && (
                <span className="num text-sm text-muted">
                  {doneCount}/{req.checklist.length}
                </span>
              )}
            </div>
            {req.checklist.length ? (
              <ul className="flex flex-col gap-1">
                {req.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={item.done}
                      aria-label={`Done: ${item.label}`}
                      onCheckedChange={(v) => setChecklist(req.checklist.map((i) => (i.id === item.id ? { ...i, done: v === true } : i)))}
                    />
                    <input
                      key={item.label}
                      defaultValue={item.label}
                      aria-label="Item name"
                      onBlur={(e) => {
                        const label = e.target.value.trim();
                        if (label && label !== item.label) setChecklist(req.checklist.map((i) => (i.id === item.id ? { ...i, label } : i)));
                        else e.target.value = item.label;
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className={`min-h-10 min-w-0 flex-1 rounded-lg bg-transparent px-1 text-sm outline-none focus:bg-surface-2 ${item.done ? "text-muted line-through" : ""}`}
                    />
                    <button type="button" onClick={() => setChecklist(req.checklist.filter((i) => i.id !== item.id))} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label={`Delete ${item.label}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button type="button" onClick={() => setChecklist(starterChecklist(req.requirement_type))} className="self-start rounded-lg text-sm font-medium text-accent hover:underline">
                Start from the usual list
              </button>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addItem();
              }}
            >
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" aria-label="New checklist item" />
              <Button type="submit" variant="secondary" size="icon" aria-label="Add item" disabled={!newItem.trim()}>
                <Plus />
              </Button>
            </form>
          </section>

          <section className="card flex flex-col gap-3 p-5" aria-label="Linked document">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <FileText className="size-5 text-accent" /> Linked document
            </h2>
            <NativeSelect value={req.document_id ?? ""} onChange={(e) => save({ document_id: e.target.value || null })} aria-label="Linked document">
              <option value="">None</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </NativeSelect>
            {req.document_id ? (
              <Button variant="secondary" size="sm" asChild className="self-start">
                <Link href={`/documents?open=${req.document_id}`}>
                  <BadgeCheck /> Open document
                </Link>
              </Button>
            ) : (
              !documents.length && <p className="text-xs text-muted">Upload your visa under Documents, then link it here.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
