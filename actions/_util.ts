import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import type { ActionResult } from "@/lib/types";

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
  if (e instanceof Error) return { ok: false, error: e.message };
  if (e && typeof e === "object" && "message" in e) return { ok: false, error: String((e as { message: unknown }).message) };
  return { ok: false, error: "Something went wrong" };
}

/**
 * Throw on Supabase errors so callers can use one try/catch.
 * For selects the data is non-null on success; for writes without `.select()` the result is ignored.
 */
export function must<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

/** Like `must`, for `.maybeSingle()` queries where "no row" is a valid answer. */
export function mustMaybe<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** The table or function isn't there yet: the SQL file that adds it hasn't been run. */
export function isMissingSchema(error: { code?: string } | null | undefined) {
  return ["PGRST202", "PGRST205", "42883", "42P01"].includes(error?.code ?? "");
}

export const MIGRATION_005 = "This needs one more SQL step: run supabase/migrations/005_route_tools.sql in the Supabase SQL editor, then try again.";

/** Revalidate the whole app layout (sidebar data, dashboard, lists). */
export function refreshAll() {
  revalidatePath("/", "layout");
}

/** Empty strings from forms become null. */
export function nn<T>(v: T | "" | undefined | null): T | null {
  return v === "" || v === undefined ? null : v;
}
