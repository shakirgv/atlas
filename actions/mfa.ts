"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your app");

/** Starts enrollment. An earlier attempt that was never confirmed is cleared first. */
export async function startMfaEnroll(): Promise<ActionResult<{ factorId: string; qr: string; secret: string }>> {
  try {
    const { supabase } = await requireUser();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Atlas" });
    if (error) throw new Error(error.message);
    return ok({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  } catch (e) {
    return fail(e);
  }
}

/** The first code proves the app is set up, and moves this session to two-factor. */
export async function confirmMfaEnroll(factorId: string, code: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: z.uuid().parse(factorId), code: codeSchema.parse(code) });
    if (error) throw new Error("That code didn't work. Check your app and try again.");
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Turning it off needs a current code, so an unlocked device alone can't do it. */
export async function disableMfa(code: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const value = codeSchema.parse(code);
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw new Error(listError.message);
    const factor = factors.totp[0];
    if (!factor) throw new Error("Two-factor login is not on.");
    const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: value });
    if (verified.error) throw new Error("That code didn't work. Check your app and try again.");
    const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (removed.error) throw new Error(removed.error.message);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** The login step after the password. */
export async function verifyMfaLogin(code: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const value = codeSchema.parse(code);
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw new Error(listError.message);
    const factor = factors.totp[0];
    if (!factor) throw new Error("No authenticator is set up for this account.");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: value });
    if (error) throw new Error("That code didn't work. Codes change every 30 seconds, so try the new one.");
    return ok();
  } catch (e) {
    return fail(e);
  }
}
