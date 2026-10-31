import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { BUCKETS, DOCUMENT_URL_TTL, PHOTO_URL_TTL } from "@/lib/config";
import type { Photo, PhotoView } from "@/lib/types";

/** Batch-sign photo paths (1 hour). Returns path → signed URL. Never log the result. */
export async function signPhotoPaths(supabase: ServerSupabase, paths: (string | null | undefined)[]) {
  const unique = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  const map: Record<string, string> = {};
  if (!unique.length) return map;
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const { data } = await supabase.storage.from(BUCKETS.photos).createSignedUrls(chunk, PHOTO_URL_TTL);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
    }
  }
  return map;
}

/** Attach signed URLs to photo rows (thumbnail + full size) in one batch call. */
export async function withPhotoUrls(supabase: ServerSupabase, photos: Photo[]): Promise<PhotoView[]> {
  const urls = await signPhotoPaths(
    supabase,
    photos.flatMap((p) => [p.path, p.thumb_path]),
  );
  return photos.map((p) => ({
    ...p,
    url: urls[p.path] ?? null,
    thumb_url: (p.thumb_path && urls[p.thumb_path]) || urls[p.path] || null,
  }));
}

/** Attach `cover_url` to any rows that have a `cover_path`. */
export async function withCoverUrls<T extends { cover_path: string | null }>(
  supabase: ServerSupabase,
  rows: T[],
): Promise<(T & { cover_url: string | null })[]> {
  const urls = await signPhotoPaths(supabase, rows.map((r) => r.cover_path));
  return rows.map((r) => ({ ...r, cover_url: r.cover_path ? (urls[r.cover_path] ?? null) : null }));
}

export async function signDocumentPath(supabase: ServerSupabase, path: string, download?: string) {
  const { data, error } = await supabase.storage
    .from(BUCKETS.documents)
    .createSignedUrl(path, DOCUMENT_URL_TTL, download ? { download } : undefined);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Remove storage objects (best effort). */
export async function removeFiles(supabase: ServerSupabase, bucket: keyof typeof BUCKETS, paths: (string | null | undefined)[]) {
  const list = Array.from(new Set(paths.filter((p): p is string => Boolean(p))));
  for (let i = 0; i < list.length; i += 100) {
    await supabase.storage.from(BUCKETS[bucket]).remove(list.slice(i, i + 100));
  }
}

/** Delete photo rows + files for a set of entities. Used before deleting entities. */
export async function cleanupEntityPhotos(supabase: ServerSupabase, entityIds: string[]) {
  if (!entityIds.length) return;
  const paths: string[] = [];
  for (let i = 0; i < entityIds.length; i += 200) {
    const chunk = entityIds.slice(i, i + 200);
    const { data } = await supabase.from("photos").select("id, path, thumb_path").in("entity_id", chunk);
    for (const p of data ?? []) {
      paths.push(p.path);
      if (p.thumb_path) paths.push(p.thumb_path);
    }
    await supabase.from("photos").delete().in("entity_id", chunk);
  }
  await removeFiles(supabase, "photos", paths);
}
