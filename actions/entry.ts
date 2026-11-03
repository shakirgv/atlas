"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { entryPatchSchema, type EntryPatch } from "@/lib/validation";
import { fail, isMissingSchema, MIGRATION_006, must, mustMaybe, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

/** Saves the sent fields of a country's entry requirement, creating the row on first use. */
export async function saveEntryRequirement(tripCountryId: string, patch: EntryPatch): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const id = z.uuid().parse(tripCountryId);
    const data = entryPatchSchema.parse(patch);
    // RLS only returns my own rows, so this also proves the trip country is mine.
    const tc = must(await supabase.from("trip_countries").select("country_code").eq("id", id).single());
    const settings = mustMaybe(await supabase.from("settings").select("passport_country").maybeSingle());
    if (data.validity_rule_months && !settings?.passport_country) throw new Error("Set your passport country first: a validity rule belongs to one passport.");
    // The rule is bound to the passport it is being recorded for. Saving anything else leaves that alone.
    const rule = "validity_rule_months" in data ? { validity_rule_passport: data.validity_rule_months ? (settings?.passport_country ?? null) : null } : {};
    const { error } = await supabase.from("entry_requirements").upsert(
      { user_id: user.id, trip_country_id: id, country_code: tc.country_code.trim(), passport_country: settings?.passport_country ?? null, ...data, ...rule },
      { onConflict: "trip_country_id" },
    );
    if (isMissingSchema(error) && ("validity_rule_months" in data || "validity_rule_from" in data)) throw new Error(MIGRATION_006);
    must({ data: null, error });
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** "Mark as verified today". The date comes from the server, not the browser. */
export async function markEntryVerified(tripCountryId: string): Promise<ActionResult<{ date: string }>> {
  const date = todayIso();
  const res = await saveEntryRequirement(tripCountryId, { last_verified_on: date });
  return res.ok ? ok({ date }) : res;
}
