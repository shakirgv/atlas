import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

const COLORS: Record<string, string> = { p1: "#d9774a", p2: "#6f8f5f", p3: "#7c8db5" };

/** Development only: stands in for the share photo route on the fixture page. */
export async function GET(_req: Request, { params }: RouteContext<"/dev/preview/share/photo/[photoId]">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { photoId } = await params;
  const color = COLORS[photoId] ?? "#35506b";
  return new NextResponse(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${color}"/></svg>`, { headers: { "Content-Type": "image/svg+xml" } });
}
