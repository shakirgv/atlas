"use client";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { Step } from "@/lib/trip";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/shell/workspace";

export function NextSteps({ steps, tripId, onEditTrip }: { steps: Step[]; tripId: string; onEditTrip?: () => void }) {
  const ws = useWorkspace();
  const done = steps.filter((s) => s.done).length;
  const nextIndex = steps.findIndex((s) => !s.done);
  const act = (s: Step) => {
    if (s.href) return null;
    if (s.key === "countries") return () => ws.openQuickAdd({ kind: "country", tripId });
    if (s.key === "cities") return () => ws.openQuickAdd("city");
    if (s.key === "budget") return onEditTrip ?? (() => ws.openQuickAdd("expense"));
    if (s.key === "documents") return () => ws.openQuickAdd("document");
    return null;
  };
  return (
    <section className="card p-5" aria-labelledby="next-steps">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="next-steps" className="text-xl font-semibold">
          Next steps
        </h2>
        <span className="num text-sm text-muted">
          {done} of {steps.length}
        </span>
      </div>
      <div className="mb-4 flex gap-1">
        {steps.map((s) => (
          <span key={s.key} className={cn("h-1.5 flex-1 rounded-full", s.done ? "bg-visited" : "bg-ink/10 dark:bg-white/10")} />
        ))}
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map((s, i) => {
          const onClick = act(s);
          const isNext = i === nextIndex;
          const inner = (
            <>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  s.done ? "bg-visited text-white" : isNext ? "bg-accent text-white" : "bg-surface-2 text-muted ring-1 ring-border",
                )}
              >
                {s.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-sm font-medium", s.done && "text-muted line-through decoration-border")}>{s.label}</span>
                <span className="truncate text-xs text-muted">{s.hint}</span>
              </span>
              {!s.done && <ArrowRight className={cn("size-4 shrink-0", isNext ? "text-accent" : "text-muted")} />}
            </>
          );
          const cls = cn(
            "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
            !s.done && "hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]",
            isNext && "bg-accent-soft hover:bg-accent-soft",
          );
          return (
            <li key={s.key}>
              {s.done ? (
                <div className={cls}>{inner}</div>
              ) : s.href ? (
                <Link href={s.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={onClick ?? undefined} className={cls}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
