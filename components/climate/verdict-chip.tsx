import { VERDICT_META, type Verdict, type VerdictTone } from "@/lib/climate";
import { cn } from "@/lib/utils";

const TONES: Record<VerdictTone, { bg: string; icon: string }> = {
  good: { bg: "bg-visited-soft", icon: "text-visited" },
  info: { bg: "bg-wishlist-soft", icon: "text-wishlist" },
  warning: { bg: "bg-planned-soft", icon: "text-[#b57a14] dark:text-planned" },
  danger: { bg: "bg-danger-soft", icon: "text-danger" },
};

/** Climate verdict: icon + label, never colour alone. */
export function VerdictChip({ verdict, title, size = "md", className }: { verdict: Verdict; title?: string; size?: "sm" | "md"; className?: string }) {
  const meta = VERDICT_META[verdict];
  const tone = TONES[meta.tone];
  return (
    <span title={title} className={cn("inline-flex shrink-0 items-center gap-1 rounded-full font-medium text-ink", size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs", tone.bg, className)}>
      <meta.icon className={cn(size === "sm" ? "size-3" : "size-3.5", tone.icon)} />
      {meta.label}
    </span>
  );
}
