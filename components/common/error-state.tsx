"use client";
import { CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[16px] border border-border bg-surface px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <CloudOff className="size-6" />
      </div>
      <div className="flex max-w-md flex-col gap-1">
        <p className="font-display text-lg font-semibold">{title}</p>
        <p className="text-sm text-muted">{message ?? "We couldn't load this page. Check your connection and try again."}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      ) : null}
    </div>
  );
}
