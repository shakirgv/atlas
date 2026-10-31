"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { settingsSchema } from "@/lib/validation";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import { getRates } from "@/lib/fx";
import { rateToBase, round2 } from "@/lib/money";
import type { ActionResult } from "@/lib/types";

const partial = settingsSchema.partial();

export async function updateSettings(input: z.input<typeof partial>): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const data = partial.parse(input);
    const { data: existing } = await supabase.from("settings").select("*").maybeSingle();
    const baseChanged = data.base_currency && existing && existing.base_currency !== data.base_currency;
    must(
      await supabase
        .from("settings")
        .upsert({ user_id: user.id, ...(existing ?? {}), ...data }, { onConflict: "user_id" }),
    );
    if (baseChanged && data.base_currency) await recomputeBaseAmounts(data.base_currency);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Re-express every expense in the new base currency using the latest rates. */
async function recomputeBaseAmounts(base: string) {
  const { supabase } = await requireUser();
  const rates = await getRates(base);
  if (!rates) return;
  const { data: rows } = await supabase.from("expenses").select("id, amount, currency");
  for (const r of rows ?? []) {
    const fx = rateToBase(rates, r.currency);
    if (!fx) continue;
    await supabase
      .from("expenses")
      .update({ fx_rate: fx, amount_base: round2(Number(r.amount) * fx) })
      .eq("id", r.id);
  }
}

export async function completeWelcome(input: { display_name: string; base_currency: string }): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const data = z
      .object({ display_name: z.string().trim().min(1, "Tell us your name").max(80), base_currency: z.string().regex(/^[A-Z]{3}$/) })
      .parse(input);
    must(await supabase.from("settings").upsert({ user_id: user.id, ...data }, { onConflict: "user_id" }));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
