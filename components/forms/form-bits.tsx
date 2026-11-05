"use client";
import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({ pending, children, ...props }: ButtonProps & { pending?: boolean }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

/** Collapsible "More details" section: required fields first, the rest here. */
export function MoreDetails({ children, defaultOpen = false, label = "More details" }: { children: React.ReactNode; defaultOpen?: boolean; label?: string }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-11 w-full items-center justify-between px-3.5 text-sm font-medium text-ink/80 hover:text-ink"
      >
        {label}
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="flex flex-col gap-4 border-t border-border p-3.5">{children}</div> : null}
    </div>
  );
}

/**
 * A titled group of fields that folds away, with a line saying what it holds while it's folded.
 * `forceOpen` keeps it open while something inside has an error, so the error can't hide.
 */
export function FormSection({
  title,
  summary,
  icon: Icon,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const shown = open || forceOpen;
  const id = React.useId();
  return (
    <section className="rounded-xl border border-border" aria-label={title}>
      <button type="button" onClick={() => setOpen(!shown)} aria-expanded={shown} aria-controls={id} className="flex min-h-12 w-full items-center gap-2.5 px-3.5 py-2 text-left">
        {Icon ? <Icon className="size-4 shrink-0 text-accent" /> : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold">{title}</span>
          {summary ? <span className="truncate text-xs text-muted">{summary}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", shown && "rotate-180")} />
      </button>
      {shown ? (
        <div id={id} className="flex flex-col gap-4 border-t border-border p-3.5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Chip-style single choice (status, category, kind). */
export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  className,
  name,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color?: string }[];
  className?: string;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors max-md:h-10",
              active ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink/80 hover:border-ink/30",
            )}
          >
            {o.icon ? <o.icon className="size-3.5" style={!active && o.color ? { color: o.color } : undefined} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
