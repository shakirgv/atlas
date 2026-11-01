import type { LucideIcon } from "lucide-react";
import { Cover } from "./cover";
import { cn } from "@/lib/utils";

/** Photo-forward page hero with bottom gradient, actions top-right and content bottom-left. */
export function Hero({
  coverUrl,
  seed,
  flag,
  icon,
  alt,
  actions,
  topLeft,
  children,
  className,
}: {
  coverUrl: string | null;
  seed: string;
  flag?: string;
  icon?: LucideIcon;
  alt: string;
  actions?: React.ReactNode;
  topLeft?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Cover
      src={coverUrl}
      alt={alt}
      seed={seed}
      flag={flag}
      icon={icon}
      eager
      glyphClassName="inset-auto right-6 top-16 opacity-90 sm:right-12 sm:top-1/4 [&_span]:text-[64px] sm:[&_span]:text-[96px] [&_svg]:size-14 sm:[&_svg]:size-20"
      className={cn("min-h-[300px] overflow-hidden rounded-[20px] shadow-card sm:min-h-[340px] md:min-h-[380px]", className)}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.25)_0%,rgb(0_0_0/0)_30%,rgb(0_0_0/0.15)_55%,rgb(0_0_0/0.78)_100%)]" />
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
        <div>{topLeft}</div>
        <div className="flex items-center gap-1.5">{actions}</div>
      </div>
      <div className="absolute inset-x-5 bottom-5 text-white sm:inset-x-7 sm:bottom-7">{children}</div>
    </Cover>
  );
}

export function HeroButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full bg-black/40 px-3 text-[13px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/55 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
