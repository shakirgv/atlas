"use client";
import { Clock4, MoonStar } from "lucide-react";
import { JETLAG_DISCLAIMER, jetLagLabel, jetLagTip, type JetLag } from "@/lib/jetlag";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

/** "+5h east · ~5 days to adjust" — only for shifts of 3h or more. Icon + label, never colour alone. */
export function JetLagChip({ jetlag, onPhoto, className, from }: { jetlag: JetLag | null | undefined; onPhoto?: boolean; className?: string; from?: string }) {
  if (!jetlag || jetlag.severity === "none") return null;
  const strong = jetlag.severity === "strong";
  const Icon = strong ? MoonStar : Clock4;
  return (
    <Tooltip
      content={
        <span className="block max-w-64 font-normal">
          {from ? `From ${from}. ` : ""}
          {jetLagTip(jetlag)} <span className="opacity-70">{JETLAG_DISCLAIMER}</span>
        </span>
      }
    >
      <span
        tabIndex={0}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
          onPhoto ? "bg-black/45 text-white backdrop-blur-md" : strong ? "bg-danger-soft text-ink" : "bg-planned-soft text-ink",
          className,
        )}
      >
        <Icon className={cn("size-3.5", !onPhoto && (strong ? "text-danger" : "text-[#b57a14] dark:text-planned"))} />
        <span className="sr-only">{strong ? "Strong jet lag:" : "Moderate jet lag:"}</span>
        {jetLagLabel(jetlag)}
      </span>
    </Tooltip>
  );
}
