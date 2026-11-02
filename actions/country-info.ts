"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getCountry } from "@/lib/countries";
import { safeUrl } from "@/lib/country-info";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

/** Blank means "no override", which falls back to the bundled baseline. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

const patchSchema = z
  .object({
    emergency_general: text(40),
    emergency_police: text(40),
    emergency_ambulance: text(40),
    emergency_fire: text(40),
    plugs: z.array(z.string().regex(/^[A-O]$/, "Plug types are letters A to O")).max(15).nullable(),
    voltage: text(40),
    frequency: text(40),
    tipping: text(500),
    tap_water: text(500),
    sim_tips: text(1000),
    embassy_name: text(200),
    embassy_phone: text(60),
    embassy_address: text(400),
    embassy_url: text(500).refine((v) => !v || safeUrl(v), "Enter a web address"),
    notes: text(5000),
  })
  .partial()
  .strict();

export type CountryInfoPatch = z.input<typeof patchSchema>;

/** Inline edit on the Essentials tab: only the sent fields change. */
export async function saveCountryInfo(code: string, patch: CountryInfoPatch): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const cca2 = z.string().length(2).parse(code).toUpperCase();
    if (!getCountry(cca2)) throw new Error("Unknown country");
    must(await supabase.from("country_info_overrides").upsert({ user_id: user.id, country_code: cca2, ...patchSchema.parse(patch) }, { onConflict: "user_id,country_code" }));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
