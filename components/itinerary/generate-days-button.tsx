"use client";
import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateDays } from "@/actions/itinerary";
import { pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function GenerateDaysButton({ countryId, hasDates, variant = "primary", label = "Generate days" }: { countryId: string; hasDates: boolean; variant?: "primary" | "secondary"; label?: string }) {
  const [pending, start] = useTransition();
  const [count, setCount] = useState("3");
  const [open, setOpen] = useState(false);
  const run = (blank?: number) =>
    start(async () => {
      const res = await generateDays(countryId, blank);
      if (!res.ok) return void toast.error(res.error);
      setOpen(false);
      if (res.data.created) toast.success(`Added ${pluralize(res.data.created, "day")}`, { description: "Existing plans weren't changed." });
      else toast.success("No days are missing");
    });
  if (hasDates) {
    return (
      <Button variant={variant} disabled={pending} onClick={() => run()}>
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {label}
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant}>
          <Sparkles /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(Math.max(1, Math.min(60, Number(count) || 3)));
          }}
        >
          <p className="text-sm">No dates yet. How many blank days?</p>
          <Input type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} aria-label="Number of days" autoFocus />
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Create days
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
