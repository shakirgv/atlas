import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/vault-crypto";
import { isDocumentLocked, VAULT_LOCKED, type VaultState } from "@/lib/vault-mask";

export const VAULT_COOKIE = "vault_unlocked";

const OPEN: VaultState = { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null };

/** Migration 004 not applied yet: there can be no PIN. Any other error must not open the vault. */
function isMissingFunction(error: { code?: string }) {
  return error.code === "PGRST202" || error.code === "42883";
}

/**
 * Whether a PIN exists and this browser has unlocked it. Checking also restarts the timeout.
 * Cached per request. The database holds the expiry, so a stolen or stale cookie alone opens nothing.
 */
export const getVaultState = cache(async (): Promise<VaultState> => {
  if (!isSupabaseConfigured) return OPEN;
  const supabase = await createClient();
  const token = (await cookies()).get(VAULT_COOKIE)?.value;
  const [{ data, error }, touched] = await Promise.all([
    supabase.rpc("atlas_vault_status").single(),
    token ? supabase.rpc("atlas_vault_touch", { p_token_hash: hashToken(token) }) : null,
  ]);
  if (error) return isMissingFunction(error) ? OPEN : { hasPin: true, unlocked: false, pinLength: null, lockedUntil: null };
  if (!data.has_pin) return OPEN;
  return { hasPin: true, unlocked: touched?.data === true, pinLength: data.pin_length, lockedUntil: data.locked_until };
});

/** Throws for a locked sensitive document. Every action that opens or changes one goes through this. */
export async function assertDocumentOpen(doc: { sensitive?: boolean | null }) {
  if (isDocumentLocked(doc, await getVaultState())) throw new Error(VAULT_LOCKED);
}
