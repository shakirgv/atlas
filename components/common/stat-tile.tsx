"use client";
import type { LucideIcon } from "lucide-react";
import { CountUp } from "./motion";
import { cn } from "@/lib/utils";

export function StatTile({
  icon: Icon,
  label,
  value,
  format,
  suffix,
  className,
  tone = "var(--accent)",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  format?: (n: number) => string;
  suffix?: React.ReactNode;
  className?: string;
  tone?: string;
}) {
  return (
    <div className={cn("card flex flex-col justify-between gap-3 p-4", className)}>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span className="grid size-7 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)` }}>
          <Icon className="size-4" style={{ color: tone }} />
        </span>
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <CountUp value={value} format={format} className="num font-display text-[28px] font-semibold leading-none" />
        {suffix ? <span className="text-sm text-muted">{suffix}</span> : null}
      </div>
    </div>
  );
}
