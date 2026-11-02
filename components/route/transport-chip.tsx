"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setCityTransport } from "@/actions/cities";
import { setCountryTransport } from "@/actions/countries";
import { TRANSPORT_OPTIONS, transportMeta } from "@/lib/transport";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/** Small mode chip between stops. Click to change the mode inline (when `owner` is given). */
export function TransportChip({
  mode,
  note,
  owner,
  toName,
  className,
}: {
  mode: string | null;
  note?: string | null;
  owner?: { kind: "city" | "country"; id: string } | null;
  toName?: string;
  className?: string;
}) {
  const meta = transportMeta(mode);
  const Icon = meta.icon;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [pending, start] = useTransition();
  const chip = (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        mode ? "bg-accent-soft text-ink" : "border border-dashed border-border text-muted",
        className,
      )}
    >
      <Icon className={cn("size-3.5 shrink-0", mode ? "text-accent" : "text-muted")} />
      <span className="truncate">{mode ? meta.label : owner ? "Add transport" : "Transport not set"}</span>
      {note && <span className="truncate text-muted max-sm:hidden">· {note}</span>}
    </span>
  );
  if (!owner) return chip;

  const save = (m: string | null, n?: string) =>
    start(async () => {
      const res = owner.kind === "city" ? await setCityTransport(owner.id, m, n) : await setCountryTransport(owner.id, m, n);
      if (!res.ok) return void toast.error(res.error);
      setOpen(false);
    });

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o && setDraft(note ?? ""))}>
      <PopoverTrigger asChild>
        <button type="button" className="max-w-full rounded-full focus-visible:outline-2 focus-visible:outline-accent" aria-label={`How do I get to ${toName ?? "this stop"}? Currently ${mode ? meta.label : "not set"}`}>
          {chip}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="mb-2 text-sm font-medium">How do I get to {toName ?? "here"}?</p>
        <div role="radiogroup" aria-label="Transport mode" className="grid grid-cols-4 gap-1.5">
          {TRANSPORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={mode === o.value}
              disabled={pending}
              onClick={() => save(o.value, draft)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-medium transition-colors",
                mode === o.value ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
              )}
            >
              <o.icon className="size-4 text-accent" />
              {o.label}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(mode, draft);
          }}
        >
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Note, e.g. Pegasus PC123, 09:40" aria-label="Transport note" maxLength={160} />
          <Button type="submit" size="sm" variant="secondary" disabled={pending} className="h-10">
            {pending ? <Loader2 className="animate-spin" /> : "Save"}
          </Button>
        </form>
        {mode && (
          <button type="button" onClick={() => save(null, draft)} className="mt-2 text-xs font-medium text-muted hover:text-danger" disabled={pending}>
            Clear mode
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
