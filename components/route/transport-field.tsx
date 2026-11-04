"use client";
import { TRANSPORT_OPTIONS } from "@/lib/transport";
import { cn } from "@/lib/utils";
import { Field, Input } from "@/components/ui/input";

/** "How do I get here?" — icon select + optional short note. Used in country and city forms. */
export function TransportField({
  value,
  onChange,
  noteProps,
  isFirst,
  previousStop,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  noteProps: React.ComponentProps<"input">;
  isFirst?: boolean;
  previousStop?: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Field label="How do I get here?" hint={isFirst ? "For the first stop this means from home." : previousStop ? `From ${previousStop}, the previous stop.` : "From the previous stop."}>
        <div role="radiogroup" aria-label="Transport mode" className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
          {TRANSPORT_OPTIONS.map((o) => {
            const active = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(active ? null : o.value)}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-medium transition-colors",
                  active ? "border-ink bg-ink text-bg" : "border-border bg-surface text-ink/80 hover:border-ink/30",
                )}
              >
                <o.icon className={cn("size-4", !active && "text-accent")} />
                {o.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Input aria-label="Transport note" placeholder="Optional note, e.g. Pegasus PC123, 09:40" maxLength={160} {...noteProps} />
    </div>
  );
}
