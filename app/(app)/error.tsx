"use client";
import { ErrorState } from "@/components/common/error-state";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState message={process.env.NODE_ENV === "development" ? error.message : undefined} onRetry={reset} />;
}
