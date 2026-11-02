import { NextResponse } from "next/server";
import { z } from "zod";
import { BUCKETS } from "@/lib/config";
import { findShare, loadPublicView, shareablePhotoPath } from "@/lib/server/share-data";
import { createAdminClient } from "@/lib/supabase/admin";

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * GET /s/[token]/photo/[photoId]?size=thumb|full. Streams the file, so no signed URL ever reaches a
 * visitor. The token and the photo's place in this share are checked on every request, which is what
 * makes revoking immediate.
 */
export async function GET(req: Request, { params }: RouteContext<"/s/[token]/photo/[photoId]">) {
  const { token, photoId } = await params;
  const id = z.uuid().safeParse(photoId);
  const share = await findShare(token);
  const view = share && id.success ? await loadPublicView(share) : null;
  if (!share || !view || !id.success) return notFound();
  const size = new URL(req.url).searchParams.get("size") === "thumb" ? "thumb" : "full";
  const path = await shareablePhotoPath(share, view, id.data, size);
  if (!path) return notFound();
  const { data, error } = await createAdminClient().storage.from(BUCKETS.photos).download(path);
  if (error || !data) return notFound();
  return new NextResponse(data.stream(), { headers: { "Content-Type": data.type || "image/webp", "Cache-Control": "private, max-age=300" } });
}
