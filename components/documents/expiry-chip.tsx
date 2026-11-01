import { AlarmClock, CalendarCheck, TriangleAlert } from "lucide-react";
import { daysUntil, fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function expiryLevel(expiry: string | null | undefined): "none" | "ok" | "soon" | "urgent" {
  const n = daysUntil(expiry);
  if (n === null) return "none";
  if (n < 30) return "urgent";
  if (n < 90) return "soon";
  return "ok";
}

/** Amber if < 90 days, red if < 30 days or expired. */
export function ExpiryChip({ expiry, className }: { expiry: string | null; className?: string }) {
  const n = daysUntil(expiry);
  const level = expiryLevel(expiry);
  if (level === "none") return null;
  const label = n! < 0 ? `Expired ${fmtDate(expiry)}` : n === 0 ? "Expires today" : level === "ok" ? `Valid until ${fmtDate(expiry)}` : `Expires in ${n} days`;
  const Icon = level === "urgent" ? TriangleAlert : level === "soon" ? AlarmClock : CalendarCheck;
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        level === "urgent" && "bg-danger-soft text-danger",
        level === "soon" && "bg-planned-soft text-[#8a5a10] dark:text-planned",
        level === "ok" && "bg-visited-soft text-ink",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
