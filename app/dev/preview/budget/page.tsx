import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BudgetPreview } from "./budget-preview";

export const metadata: Metadata = { title: "Preview: budget" };

/** Development-only: the Budget page on fixtures, with every country capped or only a few. */
export default async function BudgetPreviewPage({ searchParams }: { searchParams: Promise<{ caps?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { caps } = await searchParams;
  return <BudgetPreview caps={caps === "none" ? "none" : caps === "few" ? "few" : "all"} />;
}
