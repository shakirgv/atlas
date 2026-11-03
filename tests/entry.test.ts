import { describe, expect, it } from "vitest";
import { entryOverview, entryStatus, entryWarnings, isEntryReady, latestPassport, latestPassportExpiry, passportProblem, parseChecklist, requirementType, starterChecklist, suggestedApplyBy } from "@/lib/entry";
import { buildAlerts, entryAlerts } from "@/lib/alerts";
import { entryPatchSchema } from "@/lib/validation";

const today = "2027-01-01";
const stay = { arrive: "2027-03-01", depart: "2027-04-14", today };
const ids = (w: { id: string }[]) => w.map((x) => x.id);

describe("entry warnings", () => {
  it("flags a stay longer than allowed in red (spec: 45 planned, 30 allowed)", () => {
    const [w] = entryWarnings({ status: "approved", allowed_stay_days: 30 }, stay);
    expect(w).toMatchObject({ id: "stay", level: "danger", label: "Planned 45 days, allowed 30" });
    expect(entryWarnings({ status: "approved", allowed_stay_days: 45 }, stay)).toEqual([]);
  });

  it("warns about the apply-by date, and escalates once it has passed", () => {
    const at = (apply_by: string) => entryWarnings({ status: "to_apply", apply_by, last_verified_on: today }, stay);
    expect(at("2027-01-15")[0]).toMatchObject({ id: "apply_by", level: "warning" });
    expect(at("2027-01-16")).toEqual([]);
    expect(at("2027-01-01")[0]).toMatchObject({ id: "apply_by", level: "warning", label: "Apply today" });
    expect(at("2026-12-31")[0]).toMatchObject({ id: "apply_by", level: "danger" });
    expect(entryWarnings({ status: "applied", apply_by: "2026-12-31", last_verified_on: today }, stay)).toEqual([]);
  });

  it("warns when not checked within 120 days of arrival", () => {
    const near = { arrive: "2027-05-01", depart: "2027-05-10", today };
    const far = { arrive: "2027-05-02", depart: "2027-05-10", today };
    expect(ids(entryWarnings(null, near))).toEqual(["not_checked"]);
    expect(entryWarnings(null, far)).toEqual([]);
    expect(entryWarnings({ status: "not_checked" }, near)[0]!.level).toBe("warning");
  });

  it("asks to re-check after 90 days or never, within 180 days of arrival", () => {
    const near = { arrive: "2027-06-30", depart: "2027-07-05", today };
    const base = { status: "not_needed" };
    expect(entryWarnings(base, near)[0]).toMatchObject({ id: "recheck", level: "info" });
    // 3 Oct to 1 Jan is exactly 90 days.
    expect(entryWarnings({ ...base, last_verified_on: "2026-10-03" }, near)).toEqual([]);
    expect(ids(entryWarnings({ ...base, last_verified_on: "2026-10-02" }, near))).toEqual(["recheck"]);
    expect(entryWarnings(base, { arrive: "2027-07-01", depart: "2027-07-05", today })).toEqual([]);
  });

  it("flags a visa window that does not cover the stay", () => {
    const covered = { status: "approved", valid_from: "2027-02-01", valid_until: "2027-05-01" };
    expect(entryWarnings(covered, stay)).toEqual([]);
    expect(ids(entryWarnings({ ...covered, valid_from: "2027-03-02" }, stay))).toEqual(["validity"]);
    expect(ids(entryWarnings({ ...covered, valid_until: "2027-04-13" }, stay))).toEqual(["validity"]);
  });

  it("flags a passport that lapses before or during the stay", () => {
    const base = { status: "approved" };
    expect(entryWarnings(base, { ...stay, passportExpiry: "2027-02-28" })[0]).toMatchObject({ id: "passport", level: "danger", label: "Passport: Expires before this trip" });
    expect(entryWarnings(base, { ...stay, passportExpiry: "2027-03-01" })[0]).toMatchObject({ id: "passport", label: "Passport: Expires during this trip" });
    expect(entryWarnings(base, { ...stay, passportExpiry: "2027-04-13" })[0]).toMatchObject({ id: "passport", label: "Passport: Expires during this trip" });
    expect(entryWarnings(base, { ...stay, passportExpiry: "2027-04-14" })).toEqual([]);
    expect(entryWarnings(base, { ...stay, passportExpiry: null })).toEqual([]);
  });

  it("assumes no extra validity window without a recorded rule", () => {
    expect(entryWarnings({ status: "approved" }, { ...stay, passportExpiry: "2027-04-15", passportCountry: "AZ" })).toEqual([]);
  });

  it("applies a recorded rule for this destination and passport", () => {
    const rule = { status: "approved", validity_rule_months: 6, validity_rule_from: "departure", validity_rule_passport: "AZ" };
    const at = (passportExpiry: string) => entryWarnings(rule, { ...stay, passportExpiry, passportCountry: "AZ" });
    expect(at("2027-10-13")[0]).toMatchObject({ id: "passport", level: "danger", label: "Passport: Under the recorded 6-month validity rule" });
    expect(at("2027-10-14")).toEqual([]);
    const fromArrival = { ...rule, validity_rule_from: "arrival" };
    expect(entryWarnings(fromArrival, { ...stay, passportExpiry: "2027-08-31", passportCountry: "AZ" })).toHaveLength(1);
    expect(entryWarnings(fromArrival, { ...stay, passportExpiry: "2027-09-01", passportCountry: "AZ" })).toEqual([]);
  });

  it("doesn't apply a rule recorded for another passport", () => {
    const rule = { status: "approved", validity_rule_months: 6, validity_rule_from: "departure", validity_rule_passport: "TR" };
    expect(entryWarnings(rule, { ...stay, passportExpiry: "2027-05-01", passportCountry: "AZ" })).toEqual([]);
    expect(entryWarnings(rule, { ...stay, passportExpiry: "2027-05-01" })).toEqual([]);
    expect(entryWarnings(rule, { ...stay, passportExpiry: "2027-05-01", passportCountry: "tr " })).toHaveLength(1);
  });

  it("says nothing about a passport after the stay, or without an arrival date", () => {
    expect(passportProblem(null, { arrive: "2026-01-01", depart: "2026-02-01", today, passportExpiry: "2025-01-01" })).toBeNull();
    expect(passportProblem(null, { arrive: null, depart: "2027-02-01", today, passportExpiry: "2025-01-01" })).toBeNull();
  });

  it("uses the arrival date for a stay with no departure yet", () => {
    expect(passportProblem(null, { arrive: "2027-03-01", depart: null, today, passportExpiry: "2027-02-28" })?.label).toBe("Expires before this trip");
    expect(passportProblem(null, { arrive: "2027-03-01", depart: null, today, passportExpiry: "2027-03-01" })).toBeNull();
  });

  it("picks the passport expiring last", () => {
    const docs = [{ id: "old", type: "passport", expiry_date: "2027-01-01" }, { id: "new", type: "passport", expiry_date: "2035-01-01" }, { id: "visa", type: "visa", expiry_date: "2040-01-01" }, { id: "blank", type: "passport", expiry_date: null }];
    expect(latestPassport(docs)?.id).toBe("new");
    expect(latestPassport([docs[2]!])).toBeNull();
  });

  it("ignores visa dates left over on visa-free entry", () => {
    const leftover = { status: "not_needed", valid_until: "2027-03-02", last_verified_on: today };
    expect(ids(entryWarnings({ ...leftover, requirement_type: "e_visa" }, stay))).toContain("validity");
    expect(ids(entryWarnings({ ...leftover, requirement_type: "visa_free" }, stay))).not.toContain("validity");
  });

  it("stays quiet once the stay is over and lists danger first", () => {
    expect(entryWarnings({ allowed_stay_days: 1 }, { arrive: "2026-01-01", depart: "2026-02-01", today })).toEqual([]);
    const w = entryWarnings({ status: "not_needed", allowed_stay_days: 30 }, stay);
    expect(w.map((x) => x.level)).toEqual(["danger", "info"]);
  });

  it("skips arrival rules while the stay is under way", () => {
    expect(entryWarnings(null, { arrive: "2026-12-20", depart: "2027-01-10", today })).toEqual([]);
  });

  it("needs dates for date rules", () => {
    expect(entryWarnings(null, { arrive: null, depart: null, today })).toEqual([]);
  });
});

describe("ready", () => {
  const done = [{ id: "a", label: "A", done: true }];
  it("goes green for approved or not needed with a clean checklist", () => {
    expect(isEntryReady({ status: "approved", checklist: done }, [])).toBe(true);
    expect(isEntryReady({ status: "not_needed", checklist: [] }, [])).toBe(true);
  });
  it("stays off for open items, other statuses or open problems", () => {
    expect(isEntryReady({ status: "approved", checklist: [{ id: "a", label: "A", done: false }] }, [])).toBe(false);
    expect(isEntryReady({ status: "applied", checklist: done }, [])).toBe(false);
    expect(isEntryReady({ status: "approved", checklist: done }, [{ id: "stay", level: "danger", label: "" }])).toBe(false);
    expect(isEntryReady({ status: "not_needed", checklist: done }, [{ id: "recheck", level: "info", label: "" }])).toBe(true);
  });
});

describe("overview and dashboard", () => {
  const country = (id: string, arrive: string, depart: string) => ({ id, code: "JP", name: id, flag: "", trip_title: "T", arrive_date: arrive, depart_date: depart });
  const countries = [country("ready", "2027-02-01", "2027-02-10"), country("danger", "2027-03-01", "2027-04-14"), country("unchecked", "2027-02-15", "2027-02-20")];
  const entries = [
    { trip_country_id: "ready", status: "approved", checklist: [] },
    { trip_country_id: "danger", status: "approved", allowed_stay_days: 30 },
  ];

  it("sorts by urgency", () => {
    const rows = entryOverview(countries, entries, { today, passportExpiry: null });
    expect(rows.map((r) => r.tripCountryId)).toEqual(["danger", "unchecked", "ready"]);
    expect(rows[2]!.ready).toBe(true);
  });

  it("goes quiet on the dashboard for an approved, complete country (spec)", () => {
    const rows = entryOverview([countries[0]!], entries, { today, passportExpiry: null });
    expect(entryAlerts(rows)).toEqual([]);
  });

  it("shows the red chip on the dashboard too (spec)", () => {
    const rows = entryOverview([countries[1]!], entries, { today, passportExpiry: null });
    expect(entryAlerts(rows)[0]).toMatchObject({ level: "danger", kind: "entry", href: "/countries/danger?tab=entry" });
  });

  it("does not repeat the passport warning, which the dashboard already shows per trip", () => {
    const rows = entryOverview([countries[0]!], entries, { today, passportExpiry: "2027-01-15" });
    expect(rows[0]!.warnings.map((w) => w.id)).toEqual(["passport"]);
    expect(entryAlerts(rows)).toEqual([]);
  });

  it("folds re-check reminders into one line", () => {
    const rows = entryOverview(
      [country("a", "2027-02-01", "2027-02-10"), country("b", "2027-03-01", "2027-03-10")],
      [
        { trip_country_id: "a", status: "not_needed" },
        { trip_country_id: "b", status: "not_needed" },
      ],
      { today, passportExpiry: null },
    );
    const alerts = entryAlerts(rows);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ level: "info", title: "Re-check entry rules for 2 countries" });
  });

  it("merges into the heads-up list sorted by severity", () => {
    const rows = entryOverview([countries[1]!], entries, { today, passportExpiry: null });
    const alerts = buildAlerts({ documents: [], trips: [], countries: [], expenses: [], entries: rows });
    expect(alerts.map((a) => a.kind)).toEqual(["entry"]);
  });
});

describe("helpers", () => {
  it("starts a checklist per requirement type, with nothing ticked", () => {
    expect(starterChecklist("visa_free").map((i) => i.id)).toEqual(["starter-passport", "starter-ticket"]);
    expect(starterChecklist("visa_required")).toHaveLength(7);
    expect(starterChecklist("e_visa").every((i) => !i.done)).toBe(true);
  });

  it("suggests an apply-by date only for visas that need processing", () => {
    expect(suggestedApplyBy("e_visa", "2027-03-31")).toBe("2027-03-01");
    expect(suggestedApplyBy("visa_required", "2027-03-31")).toBe("2027-03-01");
    expect(suggestedApplyBy("visa_free", "2027-03-31")).toBeNull();
    expect(suggestedApplyBy("e_visa", null)).toBeNull();
  });

  it("survives malformed stored data", () => {
    expect(parseChecklist(null)).toEqual([]);
    expect(parseChecklist([{ id: "a", label: "A", done: 1 }, { id: 2 }, null])).toEqual([{ id: "a", label: "A", done: true }]);
    expect(requirementType("nonsense")).toBe("not_checked");
    expect(entryStatus(undefined)).toBe("not_checked");
  });

  it("uses the passport that expires last", () => {
    expect(latestPassportExpiry([{ type: "passport", expiry_date: "2027-01-01" }, { type: "passport", expiry_date: "2035-01-01" }, { type: "visa", expiry_date: "2040-01-01" }])).toBe("2035-01-01");
    expect(latestPassportExpiry([])).toBeNull();
  });
});

describe("entry patch validation", () => {
  it("keeps only the fields that were sent", () => {
    expect(entryPatchSchema.parse({ status: "applied" })).toEqual({ status: "applied" });
  });
  it("clears blank values", () => {
    expect(entryPatchSchema.parse({ apply_by: "", notes: "  ", allowed_stay_days: "", fee_currency: "" })).toEqual({ apply_by: null, notes: null, allowed_stay_days: null, fee_currency: null });
  });
  it("rejects bad input", () => {
    expect(() => entryPatchSchema.parse({ status: "nope" })).toThrow();
    expect(() => entryPatchSchema.parse({ allowed_stay_days: -3 })).toThrow();
    expect(() => entryPatchSchema.parse({ allowed_stay_days: 1.5 })).toThrow();
    expect(() => entryPatchSchema.parse({ official_url: "javascript:alert(1)" })).toThrow();
    expect(() => entryPatchSchema.parse({ fee_currency: "usd" })).toThrow();
    expect(() => entryPatchSchema.parse({ user_id: "x" })).toThrow();
  });
});
