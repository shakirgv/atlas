import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

/** Route handler guard: verified user or a 401 response. */
export async function apiUser() {
  if (!isSupabaseConfigured) return { error: NextResponse.json({ error: "Not configured" }, { status: 503 }) } as const;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  return { supabase, user: data.user } as const;
}

export function apiError(e: unknown, status = 400) {
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status });
  return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed" }, { status });
}
