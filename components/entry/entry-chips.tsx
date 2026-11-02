import { CircleCheck, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { ENTRY_STATUS_META, type EntryWarning } from "@/lib/entry";
import type { EntryStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONES = {
  good: { bg: "bg-visited-soft", icon: "text-visited" },
  info: { bg: "bg-wishlist-soft", icon: "text-wishlist" },
  warning: { bg: "bg-planned-soft", icon: "text-[#b57a14] dark:text-planned" },
  danger: { bg: "bg-danger-soft", icon: "text-danger" },
  muted: { bg: "bg-ink/5 dark:bg-white/10", icon: "text-muted" },
} as const;

const chipClass = "inline-flex min-h-6 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-ink [&_svg]:size-3 [&_svg]:shrink-0";

export function EntryStatusChip({ status, className }: { status: EntryStatus; className?: string }) {
  const meta = ENTRY_STATUS_META[status];
  const tone = TONES[meta.tone];
  return (
    <span className={cn(chipClass, tone.bg, className)}>
      <meta.icon className={tone.icon} /> {meta.label}
    </span>
  );
}

const WARNING_ICONS = { danger: CircleAlert, warning: TriangleAlert, info: Info };

/** Severity chip: icon + label, never colour alone. */
export function EntryWarningChip({ warning, className }: { warning: EntryWarning; className?: string }) {
  const Icon = WARNING_ICONS[warning.level];
  const tone = TONES[warning.level];
  return (
    <span className={cn(chipClass, tone.bg, className)}>
      <Icon className={tone.icon} /> {warning.label}
    </span>
  );
}

export function EntryReadyChip({ className }: { className?: string }) {
  return (
    <span className={cn(chipClass, TONES.good.bg, className)}>
      <CircleCheck className={TONES.good.icon} /> Ready
    </span>
  );
}
