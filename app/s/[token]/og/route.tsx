import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { APP_NAME, BUCKETS } from "@/lib/config";
import { parseShareConfig } from "@/lib/share";
import { findShare, loadPublicView, shareablePhotoPath } from "@/lib/server/share-data";
import { createAdminClient } from "@/lib/supabase/admin";

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** The picture messengers show next to the link: the cover and the title, nothing else. */
export async function GET(_req: Request, { params }: RouteContext<"/s/[token]/og">) {
  const { token } = await params;
  const share = await findShare(token);
  const view = share ? await loadPublicView(share) : null;
  if (!share || !view || !parseShareConfig(share.config).preview_image) return notFound();

  let cover: string | null = null;
  if (view.coverId) {
    const path = await shareablePhotoPath(share, view, view.coverId, "full");
    const file = path ? await createAdminClient().storage.from(BUCKETS.photos).download(path) : null;
    if (file?.data) {
      // The image renderer can't read WebP.
      const jpeg = await sharp(Buffer.from(await file.data.arrayBuffer())).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
      cover = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }
  }

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0D1117" }}>
      {cover && <img src={cover} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, objectFit: "cover" }} />}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 64, background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.8) 100%)" }}>
        <div style={{ display: "flex", color: "white", fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{view.title.slice(0, 80)}</div>
        <div style={{ display: "flex", color: "rgba(255,255,255,0.8)", fontSize: 30, marginTop: 16 }}>{APP_NAME}</div>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "private, max-age=300" } },
  );
}
