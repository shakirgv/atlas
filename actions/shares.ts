"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { shareConfigSchema, SHARE_EXPIRY_OPTIONS } from "@/lib/share";
import { signPhotoPaths } from "@/lib/storage";
import { isSharingEnabled } from "@/lib/supabase/admin";
import { SHARE_KINDS, type ActionResult, type Share } from "@/lib/types";
import { fail, must, ok, refreshAll } from "@/actions/_util";

const createSchema = z.object({
  kind: z.enum(SHARE_KINDS),
  target_id: z.uuid().nullable(),
  year: z.number().int().min(1900).max(2200).nullable(),
  /** Null means the link never expires. */
  expires_in_days: z.union([...SHARE_EXPIRY_OPTIONS.map((d) => z.literal(d)), z.null()] as [z.ZodLiteral<7>, z.ZodLiteral<30>, z.ZodLiteral<90>, z.ZodNull]),
  config: shareConfigSchema,
});
export type CreateShareInput = z.input<typeof createSchema>;

export async function createShare(input: CreateShareInput): Promise<ActionResult<{ token: string }>> {
  try {
    if (!isSharingEnabled()) throw new Error("Sharing needs a server key. See the README.");
    const { supabase, user } = await requireUser();
    const d = createSchema.parse(input);
    // Row level security only finds my own rows, so this proves the target is mine.
    if (d.kind === "memory") must(await supabase.from("memories").select("id").eq("id", d.target_id ?? "").single());
    if (d.kind === "trip") must(await supabase.from("trips").select("id").eq("id", d.target_id ?? "").single());
    if (d.kind !== "recap" && !d.target_id) throw new Error("Nothing to share.");
    const token = randomBytes(32).toString("base64url");
    must(
      await supabase.from("shares").insert({
        user_id: user.id,
        kind: d.kind,
        target_id: d.kind === "recap" ? null : d.target_id,
        year: d.kind === "recap" ? d.year : null,
        token,
        expires_at: d.expires_in_days ? new Date(Date.now() + d.expires_in_days * 86400000).toISOString() : null,
        config: d.config,
      }),
    );
    refreshAll();
    return ok({ token });
  } catch (e) {
    return fail(e);
  }
}

export type ShareRow = Share & { label: string };

/** My links that still work, newest first, with something to call them by. */
export async function listShares(filter?: { kind: Share["kind"]; targetId: string | null; year: number | null }): Promise<ActionResult<ShareRow[]>> {
  try {
    const { supabase } = await requireUser();
    let query = supabase.from("shares").select("*").is("revoked_at", null).order("created_at", { ascending: false });
    if (filter) {
      query = query.eq("kind", filter.kind);
      if (filter.kind === "recap") query = filter.year === null ? query.is("year", null) : query.eq("year", filter.year);
      else query = query.eq("target_id", filter.targetId ?? "");
    }
    const rows = must(await query).filter((s) => !s.expires_at || new Date(s.expires_at) > new Date());
    const ids = (kind: string) => rows.filter((r) => r.kind === kind && r.target_id).map((r) => r.target_id!);
    const [memories, trips] = await Promise.all([ids("memory").length ? supabase.from("memories").select("id, title, date").in("id", ids("memory")) : Promise.resolve({ data: [] }), ids("trip").length ? supabase.from("trips").select("id, title").in("id", ids("trip")) : Promise.resolve({ data: [] })]);
    return ok(
      rows.map((s) => ({
        ...s,
        label:
          s.kind === "recap"
            ? `${s.year ?? "All-time"} recap`
            : s.kind === "trip"
              ? ((trips.data ?? []) as { id: string; title: string }[]).find((t) => t.id === s.target_id)?.title ?? "Trip"
              : ((memories.data ?? []) as { id: string; title: string | null; date: string }[]).find((m) => m.id === s.target_id)?.title || "Memory",
      })),
    );
  } catch (e) {
    return fail(e);
  }
}

/** Stops the link at once. The row stays, marked revoked, and the public route answers 404. */
export async function revokeShare(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    must(await supabase.from("shares").update({ revoked_at: new Date().toISOString() }).eq("id", z.uuid().parse(id)));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

export type SharePhotoOption = { id: string; thumb: string | null };

/** The photos a memory or trip link would show, for the per-photo checkboxes. */
export async function listSharePhotos(kind: "memory" | "trip", targetId: string): Promise<ActionResult<SharePhotoOption[]>> {
  try {
    const { supabase } = await requireUser();
    const id = z.uuid().parse(targetId);
    let memoryIds = [id];
    if (kind === "trip") memoryIds = must(await supabase.from("memories").select("id").eq("trip_id", id)).map((m) => m.id);
    if (!memoryIds.length) return ok([]);
    const photos = must(await supabase.from("photos").select("id, path, thumb_path").eq("entity_type", "memory").in("entity_id", memoryIds).order("order_index"));
    const urls = await signPhotoPaths(supabase, photos.map((p) => p.thumb_path ?? p.path));
    return ok(photos.map((p) => ({ id: p.id, thumb: urls[p.thumb_path ?? p.path] ?? null })));
  } catch (e) {
    return fail(e);
  }
}
