"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { documentSchema, type DocumentInput } from "@/lib/validation";
import { removeFiles, signDocumentPath } from "@/lib/storage";
import { assertDocumentOpen } from "@/lib/vault";
import { SENSITIVE_TYPES } from "@/lib/vault-mask";
import type { ServerSupabase } from "@/lib/supabase/server";
import { MAX_UPLOAD_BYTES } from "@/lib/config";
import { fail, must, ok, refreshAll } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

/** Reads the real flag from the database, so a caller can't talk its way past the vault. */
async function assertOpen(supabase: ServerSupabase, id: string) {
  await assertDocumentOpen(must(await supabase.from("documents").select("sensitive").eq("id", id).single()));
}

export async function createDocument(input: DocumentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireUser();
    const data = documentSchema.parse(input);
    const row = must(await supabase.from("documents").insert({ ...data, sensitive: data.sensitive ?? SENSITIVE_TYPES.includes(data.type) }).select("id").single());
    refreshAll();
    return ok({ id: row.id });
  } catch (e) {
    return fail(e);
  }
}

export async function updateDocument(id: string, input: DocumentInput): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const data = documentSchema.parse(input);
    const did = z.uuid().parse(id);
    await assertOpen(supabase, did);
    must(await supabase.from("documents").update(data).eq("id", did));
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Record the uploaded file (uploaded by the browser straight to the private bucket). */
export async function attachDocumentFile(
  id: string,
  file: { path: string; name: string; mime: string; size: number },
): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireUser();
    const did = z.uuid().parse(id);
    await assertOpen(supabase, did);
    const f = z
      .object({ path: z.string().min(10).max(400), name: z.string().max(255), mime: z.string().max(120), size: z.number().int().max(MAX_UPLOAD_BYTES) })
      .parse(file);
    if (!f.path.startsWith(`${user.id}/document/${did}/`)) throw new Error("Invalid upload path");
    const prev = must(await supabase.from("documents").select("file_path").eq("id", did).single());
    must(await supabase.from("documents").update({ file_path: f.path, file_name: f.name, mime_type: f.mime, size_bytes: f.size }).eq("id", did));
    if (prev.file_path && prev.file_path !== f.path) await removeFiles(supabase, "documents", [prev.file_path]);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}

/** Short-lived (5 min) signed URL for preview or download. */
export async function getDocumentUrl(id: string, download = false): Promise<ActionResult<{ url: string; mime: string | null; name: string | null }>> {
  try {
    const { supabase } = await requireUser();
    const doc = must(await supabase.from("documents").select("file_path, file_name, mime_type, sensitive").eq("id", z.uuid().parse(id)).single());
    // Before anything is signed: this is the check the vault depends on.
    await assertDocumentOpen(doc);
    if (!doc.file_path) throw new Error("No file attached to this document.");
    const url = await signDocumentPath(supabase, doc.file_path, download ? (doc.file_name ?? "document") : undefined);
    if (!url) throw new Error("Could not open the file. Try again.");
    return ok({ url, mime: doc.mime_type, name: doc.file_name });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const did = z.uuid().parse(id);
    const doc = must(await supabase.from("documents").select("file_path, sensitive").eq("id", did).single());
    await assertDocumentOpen(doc);
    must(await supabase.from("documents").delete().eq("id", did));
    await removeFiles(supabase, "documents", [doc.file_path]);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
