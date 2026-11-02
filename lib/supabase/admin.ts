import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/config";
import type { Database } from "@/lib/database.types";

/** Sharing works only with the key set; the rest of the app runs without it. */
export function isSharingEnabled() {
  return Boolean(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Service-role client: it bypasses row level security, so it is used ONLY by the public share route
 * and its photo route, and every query there is scoped by the share record. Never expose or log the key.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) throw new Error("Sharing is not configured.");
  return createClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
