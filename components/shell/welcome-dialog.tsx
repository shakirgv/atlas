"use client";
import { useState, useTransition } from "react";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { completeWelcome } from "@/actions/settings";
import { APP_NAME } from "@/lib/config";
import { CURRENCIES } from "@/lib/money";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/forms/form-bits";

/** First run: ask for a display name and base currency. */
export function WelcomeDialog({ open }: { open: boolean }) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dismissed, setDismissed] = useState(false);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await completeWelcome({ display_name: name, base_currency: currency });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Welcome, ${name.split(" ")[0]}!`);
      setDismissed(true);
    });
  };
  return (
    <Dialog open={open && !dismissed}>
      <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} className="max-w-md">
        <form onSubmit={submit} className="contents">
          <DialogHeader className="items-start">
            <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-ink text-bg">
              <Compass className="size-5" />
            </div>
            <DialogTitle>Welcome to {APP_NAME}</DialogTitle>
            <DialogDescription>Two quick things and you are ready to plan.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 pb-5">
            <Field label="What should we call you?" htmlFor="welcome-name">
              <Input id="welcome-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus required maxLength={80} />
            </Field>
            <Field label="Base currency" htmlFor="welcome-cur" hint="All budgets and totals are shown in this currency.">
              <NativeSelect id="welcome-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
          </DialogBody>
          <DialogFooter>
            <SubmitButton pending={pending} disabled={!name.trim()} className="w-full sm:w-auto">
              Start planning
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
