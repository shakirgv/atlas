"use client";
import * as React from "react";
import { Checkbox as CheckboxP, Switch as SwitchP, Progress as ProgressP } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxP.Root>) {
  return (
    <CheckboxP.Root
      className={cn(
        "peer grid size-5 shrink-0 place-items-center rounded-md border border-border bg-surface transition-colors data-[state=checked]:border-visited data-[state=checked]:bg-visited data-[state=checked]:text-white focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxP.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxP.Indicator>
    </CheckboxP.Root>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchP.Root>) {
  return (
    <SwitchP.Root
      className={cn(
        "inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-border transition-colors data-[state=checked]:bg-visited focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchP.Thumb className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchP.Root>
  );
}

export function Progress({ value, className, color = "var(--accent)" }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <ProgressP.Root value={v} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-ink/8 dark:bg-white/8", className)}>
      <ProgressP.Indicator
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${v}%`, background: color }}
      />
    </ProgressP.Root>
  );
}

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-xl bg-ink/[0.06] dark:bg-white/[0.06]", className)} {...props} />;
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn("inline-flex h-5 items-center rounded-md border border-border bg-surface-2 px-1.5 font-sans text-[11px] font-medium text-muted", className)}
      {...props}
    />
  );
}

/** Segmented control for view switching (grid / table / map). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-[10px] border border-border bg-surface p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium text-muted transition-colors hover:text-ink aria-checked:bg-ink aria-checked:text-bg [&_svg]:size-4",
            size === "sm" ? "h-7" : "h-8 max-md:h-10",
          )}
        >
          {o.icon}
          <span className={cn(o.icon && "max-sm:sr-only")}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Pill-shaped filter chip. */
export function FilterChip({
  active,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors max-md:h-10 [&_svg]:size-3.5",
        active ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink/80 hover:border-ink/30",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
