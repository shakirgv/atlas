import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[16px] border border-dashed border-border bg-surface/60 text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 -m-3 rounded-full bg-accent-soft blur-md" aria-hidden />
        <div className={cn("relative grid place-items-center rounded-2xl bg-surface shadow-sm ring-1 ring-border", compact ? "size-11" : "size-14")}>
          <Icon className={cn("text-accent", compact ? "size-5" : "size-6")} strokeWidth={1.75} />
        </div>
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className={cn("font-display font-semibold", compact ? "text-base" : "text-lg")}>{title}</p>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
