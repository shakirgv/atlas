import { addMonths, differenceInCalendarDays } from "date-fns";
import { Ban, CircleCheck, CircleHelp, FileWarning, type LucideIcon, Send } from "lucide-react";
import { daysBetween, fmtDate, isoDate, shiftIso, toDate } from "@/lib/dates";
import { ENTRY_STATUSES, REQUIREMENT_TYPES, type EntryRequirement, type EntryStatus, type RequirementType } from "@/lib/types";

/** Opened by "Check official sources" when I have not saved a link for the country yet. */
export const IATA_TRAVEL_CENTRE = "https://www.iatatravelcentre.com/";

export const REQUIREMENT_META: Record<RequirementType, { label: string }> = {
  not_checked: { label: "Not checked" },
  visa_free: { label: "Visa free" },
  e_visa: { label: "e-Visa" },
  visa_on_arrival: { label: "Visa on arrival" },
  visa_required: { label: "Visa required" },
  other: { label: "Other" },
};

export const ENTRY_STATUS_META: Record<EntryStatus, { label: string; icon: LucideIcon; tone: "good" | "info" | "warning" | "danger" | "muted" }> = {
  not_checked: { label: "Not checked", icon: CircleHelp, tone: "muted" },
  not_needed: { label: "Not needed", icon: CircleCheck, tone: "good" },
  to_apply: { label: "To apply", icon: FileWarning, tone: "warning" },
  applied: { label: "Applied", icon: Send, tone: "info" },
  approved: { label: "Approved", icon: CircleCheck, tone: "good" },
  rejected: { label: "Rejected", icon: Ban, tone: "danger" },
};

export function requirementType(v: string | null | undefined): RequirementType {
  return (REQUIREMENT_TYPES as readonly string[]).includes(v ?? "") ? (v as RequirementType) : "not_checked";
}

export function entryStatus(v: string | null | undefined): EntryStatus {
  return (ENTRY_STATUSES as readonly string[]).includes(v ?? "") ? (v as EntryStatus) : "not_checked";
}

export type ChecklistItem = { id: string; label: string; done: boolean };

const STARTER: Record<string, string> = {
  passport: "Passport valid for this trip",
  photo: "Passport photo",
  accommodation: "Proof of accommodation",
  ticket: "Onward or return ticket",
  funds: "Proof of funds",
  insurance: "Travel insurance",
  vaccination: "Vaccination certificate",
};

const STARTER_BY_TYPE: Record<RequirementType, string[]> = {
  not_checked: ["passport"],
  visa_free: ["passport", "ticket"],
  e_visa: ["passport", "photo", "accommodation", "ticket", "funds", "insurance"],
  visa_on_arrival: ["passport", "photo", "ticket", "funds"],
  visa_required: ["passport", "photo", "accommodation", "ticket", "funds", "insurance", "vaccination"],
  other: ["passport"],
};

/** Editable starting point, per requirement type. It holds no rule about any country. */
export function starterChecklist(type: RequirementType): ChecklistItem[] {
  return STARTER_BY_TYPE[type].map((key) => ({ id: `starter-${key}`, label: STARTER[key]!, done: false }));
}

export function parseChecklist(json: unknown): ChecklistItem[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((x) => {
    const o = x as Partial<ChecklistItem> | null;
    return o && typeof o.id === "string" && typeof o.label === "string" ? [{ id: o.id, label: o.label, done: Boolean(o.done) }] : [];
  });
}

/** Suggestion only, never applied by itself: apply a month before arrival for visas that need processing. */
export function suggestedApplyBy(type: RequirementType, arrive: string | null | undefined) {
  return arrive && (type === "e_visa" || type === "visa_required") ? shiftIso(arrive, -30) : null;
}

export type EntryWarning = { id: "stay" | "apply_by" | "not_checked" | "recheck" | "validity" | "passport" | "rejected"; level: "danger" | "warning" | "info"; label: string };

/** The fields the warning rules read. A country without a saved row behaves like the defaults. */
export type EntryFacts = Partial<Pick<EntryRequirement, "status" | "requirement_type" | "allowed_stay_days" | "apply_by" | "valid_from" | "valid_until" | "last_verified_on" | "checklist" | "validity_rule_months" | "validity_rule_from" | "validity_rule_passport">>;

const RANK = { danger: 0, warning: 1, info: 2 } as const;
const days = (from: string, to: string) => differenceInCalendarDays(toDate(to)!, toDate(from)!);

/** The passport that counts is the one expiring last; a renewed passport replaces the old one. */
export function latestPassport<T extends { type: string; expiry_date: string | null }>(documents: T[]): T | null {
  return documents.filter((d) => d.type === "passport" && d.expiry_date).sort((a, b) => a.expiry_date!.localeCompare(b.expiry_date!)).at(-1) ?? null;
}

export function latestPassportExpiry(documents: { type: string; expiry_date: string | null }[]) {
  return latestPassport(documents)?.expiry_date ?? null;
}

/** A recorded validity rule binds only the passport it was checked for. Another passport may face different rules. */
export function validityRuleApplies(req: EntryFacts | null | undefined, passportCountry: string | null | undefined) {
  const recorded = req?.validity_rule_passport?.trim().toUpperCase();
  return Boolean(req?.validity_rule_months && recorded && recorded === passportCountry?.trim().toUpperCase());
}

export type PassportProblem = { level: "danger"; label: string };

/**
 * What the passport's expiry date means for this stay. Dates alone settle whether it lapses before or during the stay.
 * Any window beyond that is a rule of the destination, so it is only checked once one has been recorded for this passport.
 */
export function passportProblem(req: EntryFacts | null | undefined, ctx: { arrive: string | null; depart: string | null; today: string; passportExpiry?: string | null; passportCountry?: string | null }): PassportProblem | null {
  const { arrive, depart, today, passportExpiry, passportCountry } = ctx;
  const end = depart ?? arrive;
  if (!passportExpiry || !arrive || !end || end < today) return null;
  if (passportExpiry < arrive) return { level: "danger", label: "Expires before this trip" };
  if (passportExpiry < end) return { level: "danger", label: "Expires during this trip" };
  if (validityRuleApplies(req, passportCountry)) {
    const months = req!.validity_rule_months!;
    const from = req!.validity_rule_from === "arrival" ? arrive : end;
    if (passportExpiry < isoDate(addMonths(toDate(from)!, months))) return { level: "danger", label: `Under the recorded ${months}-month validity rule` };
  }
  return null;
}

export function entryWarnings(req: EntryFacts | null | undefined, ctx: { arrive: string | null; depart: string | null; today: string; passportExpiry?: string | null; passportCountry?: string | null }): EntryWarning[] {
  const { arrive, depart, today } = ctx;
  const end = depart ?? arrive;
  // A finished stay has nothing left to warn about.
  if (end && end < today) return [];
  const status = entryStatus(req?.status);
  const arriveIn = arrive ? days(today, arrive) : null;
  const upcoming = arriveIn !== null && arriveIn >= 0;
  const out: EntryWarning[] = [];

  const allowed = req?.allowed_stay_days;
  const planned = daysBetween(arrive, depart);
  if (allowed && planned > allowed) out.push({ id: "stay", level: "danger", label: `Planned ${planned} days, allowed ${allowed}` });

  if (status === "rejected" && upcoming) out.push({ id: "rejected", level: "danger", label: "Application rejected" });

  if (status === "to_apply" && req?.apply_by) {
    const left = days(today, req.apply_by);
    if (left < 0) out.push({ id: "apply_by", level: "danger", label: `Apply-by date passed (${fmtDate(req.apply_by, "dd MMM")})` });
    else if (left <= 14) out.push({ id: "apply_by", level: "warning", label: left === 0 ? "Apply today" : `Apply by ${fmtDate(req.apply_by, "dd MMM")}` });
  }

  if (status === "not_checked" && upcoming && arriveIn <= 120) out.push({ id: "not_checked", level: "warning", label: `Not checked, arriving in ${arriveIn} day${arriveIn === 1 ? "" : "s"}` });

  // An approved visa is already in hand, so asking to re-check the rules is only noise.
  const verifiedAgo = req?.last_verified_on ? days(req.last_verified_on, today) : null;
  if (status !== "approved" && status !== "not_checked" && upcoming && arriveIn <= 180 && (verifiedAgo === null || verifiedAgo > 90)) {
    out.push({ id: "recheck", level: "info", label: "Re-check requirements" });
  }

  // Visa-free entry has no visa window. Dates left from before the type changed are folded away, so they don't count.
  if (requirementType(req?.requirement_type) !== "visa_free" && arrive && end && ((req?.valid_from && req.valid_from > arrive) || (req?.valid_until && req.valid_until < end))) {
    out.push({ id: "validity", level: "danger", label: "Visa does not cover your dates" });
  }

  const passport = passportProblem(req, ctx);
  if (passport) out.push({ id: "passport", level: passport.level, label: `Passport: ${passport.label}` });

  return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
}

/** Green "Ready": nothing more to do, with a clean checklist and no danger or warning open. */
export function isEntryReady(req: EntryFacts | null | undefined, warnings: EntryWarning[]) {
  const status = entryStatus(req?.status);
  if (status !== "not_needed" && status !== "approved") return false;
  if (parseChecklist(req?.checklist).some((i) => !i.done)) return false;
  return !warnings.some((w) => w.level !== "info");
}

export type EntryRow = {
  tripCountryId: string;
  code: string;
  name: string;
  flag: string;
  tripTitle: string;
  arrive: string | null;
  depart: string | null;
  type: RequirementType;
  status: EntryStatus;
  warnings: EntryWarning[];
  ready: boolean;
};

type CountryLite = { id: string; code: string; name: string; flag: string; trip_title: string; arrive_date: string | null; depart_date: string | null };
type RowFacts = EntryFacts & { trip_country_id: string };

/** One row per trip country, most urgent first, then by arrival date. */
export function entryOverview(countries: CountryLite[], entries: RowFacts[], ctx: { today: string; passportExpiry: string | null; passportCountry?: string | null }): EntryRow[] {
  const rows = countries.map((c) => {
    const req = entries.find((e) => e.trip_country_id === c.id) ?? null;
    const warnings = entryWarnings(req, { arrive: c.arrive_date, depart: c.depart_date, ...ctx });
    return {
      tripCountryId: c.id,
      code: c.code,
      name: c.name,
      flag: c.flag,
      tripTitle: c.trip_title,
      arrive: c.arrive_date,
      depart: c.depart_date,
      type: requirementType(req?.requirement_type),
      status: entryStatus(req?.status),
      warnings,
      ready: isEntryReady(req, warnings),
    };
  });
  const urgency = (r: EntryRow) => (r.warnings[0] ? RANK[r.warnings[0].level] : r.ready ? 4 : 3);
  return rows.sort((a, b) => urgency(a) - urgency(b) || (a.arrive ?? "9999").localeCompare(b.arrive ?? "9999", "en"));
}
