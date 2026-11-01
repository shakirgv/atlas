import type { LucideIcon } from "lucide-react";
import { cn, gradientFor } from "@/lib/utils";

/**
 * Photo with a graceful fallback: a warm gradient plus a flag emoji or category icon.
 * `src` is a short-lived signed URL (or null).
 */
export function Cover({
  src,
  alt,
  seed,
  flag,
  icon: Icon,
  className,
  imgClassName,
  children,
  eager,
  glyphClassName,
}: {
  src: string | null | undefined;
  alt: string;
  seed: string;
  flag?: string;
  icon?: LucideIcon;
  className?: string;
  imgClassName?: string;
  children?: React.ReactNode;
  eager?: boolean;
  /** Position/size override for the fallback flag or icon. */
  glyphClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={cn("absolute inset-0 size-full object-cover", imgClassName)}
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: gradientFor(seed) }}>
          <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_45%),radial-gradient(circle_at_80%_70%,white_0,transparent_40%)]" />
          <div className={cn("absolute inset-0 grid place-items-center", glyphClassName)}>
            {flag ? (
              <span className="text-[56px] leading-none drop-shadow-sm [filter:saturate(1.05)]">{flag}</span>
            ) : Icon ? (
              <Icon className="size-12 text-white/85" strokeWidth={1.5} />
            ) : null}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
