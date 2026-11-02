import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PublicShareView } from "@/components/share/public-view";
import { APP_NAME } from "@/lib/config";
import { parseShareConfig } from "@/lib/share";
import { countView, findShare, loadPublicView } from "@/lib/server/share-data";

const NOT_INDEXED = { index: false, follow: false } as const;

export async function generateMetadata({ params }: PageProps<"/s/[token]">): Promise<Metadata> {
  const { token } = await params;
  const share = await findShare(token);
  const view = share ? await loadPublicView(share) : null;
  if (!share || !view) return { title: "Not found", robots: NOT_INDEXED };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return {
    metadataBase: host ? new URL(`${proto}://${host}`) : undefined,
    title: { absolute: `${view.title} · ${APP_NAME}` },
    robots: NOT_INDEXED,
    openGraph: { title: view.title, siteName: APP_NAME, type: "article", images: parseShareConfig(share.config).preview_image ? [{ url: `/s/${token}/og`, width: 1200, height: 630 }] : undefined },
    twitter: { card: parseShareConfig(share.config).preview_image ? "summary_large_image" : "summary", title: view.title },
  };
}

/** The public page. Unknown, revoked and expired tokens all get the same plain 404. */
export default async function SharePage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const share = await findShare(token);
  const view = share ? await loadPublicView(share) : null;
  if (!share || !view) notFound();
  // Set by the proxy for real GET page loads only: not bots, previews or HEAD requests.
  if ((await headers()).get("x-share-count") === "1") await countView(share);
  return <PublicShareView view={view} base={`/s/${token}`} />;
}
