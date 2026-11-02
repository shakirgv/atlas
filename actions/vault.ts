"use server";
import { cookies } from "next/headers";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import type { Database } from "@/lib/database.types";
import { VAULT_COOKIE } from "@/lib/vault";
import { hashPin, newSalt, newUnlockToken } from "@/lib/vault-crypto";
import { LOCK_TIMEOUTS, PIN_PATTERN } from "@/lib/vault-mask";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

const pinSchema = z.string().regex(PIN_PATTERN, "A PIN is 4 to 8 digits");

async function setCookie(token: string) {
  // The database decides when it expires; this only has to outlive the longest timeout.
  (await cookies()).set(VAULT_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 86400 });
}

export type UnlockResult = { unlocked: boolean; lockedUntil: string | null; attemptsLeft: number };

export async function unlockVault(pin: string): Promise<ActionResult<UnlockResult>> {
  try {
    const { supabase } = await requireUser();
    const value = pinSchema.parse(pin);
    const status = must(await supabase.rpc("atlas_vault_status").single());
    if (!status.has_pin || !status.pin_salt) throw new Error("No PIN is set.");
    const { token, tokenHash } = newUnlockToken();
    const res = must(await supabase.rpc("atlas_pin_check", { p_hash: await hashPin(value, status.pin_salt), p_token_hash: tokenHash }).single());
    if (res.ok) {
      await setCookie(token);
      refreshAll();
    }
    return ok({ unlocked: res.ok, lockedUntil: res.locked_until, attemptsLeft: res.attempts_left });
  } catch (e) {
    return fail(e);
  }
}

/** Takes effect at once: the token stops working in the database, whatever the cookie says. */
export async function lockVault(): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.rpc("atlas_vault_lock"));
    (await cookies()).delete(VAULT_COOKIE);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/**
 * Proves the password with a separate short-lived session and saves through it. Its fresh password
 * timestamp is what the database asks for, and the browser's own session is left as it was, so a
 * two-factor session isn't dropped back to one factor by signing in again.
 */
async function withFreshPassword(email: string | undefined, password: string, run: (client: ReturnType<typeof createPlainClient<Database>>) => PromiseLike<{ error: { message: string } | null }>) {
  if (!email) throw new Error("This account has no email address.");
  const client = createPlainClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("That password is not correct.");
  try {
    const res = await run(client);
    if (res.error) throw new Error(res.error.message);
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}

export async function setVaultPin(input: { password: string; pin: string }): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    const d = z.object({ password: z.string().min(1, "Enter your password"), pin: pinSchema }).parse(input);
    const salt = newSalt();
    const hash = await hashPin(d.pin, salt);
    await withFreshPassword(user.email, d.password, (client) => client.rpc("atlas_pin_set", { p_hash: hash, p_salt: salt, p_length: d.pin.length }));
    (await cookies()).delete(VAULT_COOKIE);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function removeVaultPin(input: { password: string }): Promise<ActionResult> {
  try {
    const { user } = await requireUser();
    const d = z.object({ password: z.string().min(1, "Enter your password") }).parse(input);
    await withFreshPassword(user.email, d.password, (client) => client.rpc("atlas_pin_set", { p_hash: null, p_salt: null, p_length: null }));
    (await cookies()).delete(VAULT_COOKIE);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export async function setLockTimeout(minutes: number): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const value = z.number().refine((n) => (LOCK_TIMEOUTS as readonly number[]).includes(n), "Pick 1, 5, 15 or 30 minutes").parse(minutes);
    must(await supabase.from("settings").upsert({ user_id: user.id, lock_timeout_minutes: value }, { onConflict: "user_id" }));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
