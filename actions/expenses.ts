"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { expenseSchema, type ExpenseInput } from "@/lib/validation";
import { round2 } from "@/lib/money";
import { getRates } from "@/lib/fx";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { FxRatesResult } from "@/lib/action-types";
import type { ActionResult } from "@/lib/types";

export async function createExpense(input: ExpenseInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const d = expenseSchema.parse(input);
    const row = must(
      await supabase
        .from("expenses")
        .insert({ ...d, amount: round2(d.amount), amount_base: round2(d.amount * d.fx_rate) })
        .select("id")
        .single(),
    );
    refreshAll();
    return ok({ id: row.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const d = expenseSchema.parse(input);
    must(
      await supabase
        .from("expenses")
        .update({ ...d, amount: round2(d.amount), amount_base: round2(d.amount * d.fx_rate) })
        .eq("id", z.uuid().parse(id)),
    );
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("expenses").delete().eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Latest rates for the client's live "≈ $12.40" preview. */
export async function fetchRates(base: string): Promise<FxRatesResult> {
  try {
    await requireUser();
    const rates = await getRates(z.string().regex(/^[A-Z]{3}$/).parse(base));
    return rates ? { ok: true, data: rates } : { ok: false, error: "Exchange rates are unavailable. Enter a manual rate." };
  } catch (e) {
    return fail(e);
  }
}
