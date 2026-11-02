import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardPreview } from "./dashboard-preview";

export const metadata: Metadata = { title: "Preview: dashboard" };

/** Development only: the whole dashboard on fixtures, to check the bento without a database. */
export default function DashboardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DashboardPreview />;
}
