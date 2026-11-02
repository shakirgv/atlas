import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * Per-request Supabase client + user (deduplicated with React cache). The session token is verified
 * here instead of asking the auth server, which would put a network call in front of every page.
 * The database checks the same token on every query, and actions keep the stricter `requireUser`.
 */
export const getAuth = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return { supabase, user: claims?.sub ? { id: claims.sub, email: claims.email ?? null } : null };
});

/** For Server Components: redirect to /login when signed out. */
export async function requirePageUser() {
  if (!isSupabaseConfigured) redirect("/");
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");
  return { supabase, user };
}

export class AuthError extends Error {
  constructor() {
    super("You are signed out. Please sign in again.");
  }
}

/** For Server Actions and Route Handlers: throw when there is no verified user. */
export async function requireUser() {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured yet.");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new AuthError();
  return { supabase, user: data.user };
}
