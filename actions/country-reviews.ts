"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { countryReviewSchema, type CountryReviewInput } from "@/lib/validation";
import { fail, isMissingSchema, MIGRATION_005, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

/** Save the closing notes for a country. Saving an empty form is fine: it just stops asking. */
export async function saveCountryReview(tripCountryId: string, input: CountryReviewInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const id = z.uuid().parse(tripCountryId);
    const data = countryReviewSchema.parse(input);
    const now = new Date().toISOString();
    const { error } = await supabase.from("country_reviews").upsert({ ...data, trip_country_id: id, completed_at: now, updated_at: now, dismissed_at: null }, { onConflict: "trip_country_id" });
    if (isMissingSchema(error)) throw new Error(MIGRATION_005);
    must({ data: null, error });
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** "Not now": stop asking about this country. The notes can still be written from its page. */
export async function dismissCountryReview(tripCountryId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const id = z.uuid().parse(tripCountryId);
    const { error } = await supabase.from("country_reviews").upsert({ trip_country_id: id, dismissed_at: new Date().toISOString() }, { onConflict: "trip_country_id" });
    if (isMissingSchema(error)) throw new Error(MIGRATION_005);
    must({ data: null, error });
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
