import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import type { User } from "@supabase/supabase-js";

/** Per-request Supabase client + verified user (deduplicated with React cache). */
export const getAuth = cache(async (): Promise<{ supabase: ServerSupabase; user: User | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
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
