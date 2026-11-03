import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Cover } from "./cover";
import { FlagChip } from "./flag";
import { cn } from "@/lib/utils";

/** 4:3 photo card: gradient overlay, flag chip top-left, status chip top-right, serif title. */
export function PhotoCard({
  href,
  title,
  subtitle,
  coverUrl,
  seed,
  countryCode,
  fallbackFlag,
  fallbackIcon,
  status,
  footer,
  className,
  topLeft,
}: {
  href: string;
  title: string;
  subtitle?: React.ReactNode;
  coverUrl: string | null;
  seed: string;
  countryCode?: string;
  fallbackFlag?: string;
  fallbackIcon?: LucideIcon;
  status?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  topLeft?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "card card-hover group relative block overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      <Cover src={coverUrl} alt={title} seed={seed} flag={fallbackFlag} icon={fallbackIcon} className="aspect-[4/3]">
        <div className="photo-gradient absolute inset-0" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          {topLeft ?? (countryCode ? <FlagChip code={countryCode} onPhoto /> : <span />)}
          {status}
        </div>
        <div className="absolute inset-x-4 bottom-3.5 text-white">
          <h3 className="line-clamp-2 text-[22px] font-semibold leading-tight drop-shadow-sm">{title}</h3>
          {subtitle ? <div className="mt-1 text-[13px] text-white/85">{subtitle}</div> : null}
        </div>
      </Cover>
      {footer ? <div className="border-t border-border px-4 py-3 text-sm">{footer}</div> : null}
    </Link>
  );
}
