"use client";
import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { verifyMfaLogin } from "@/actions/mfa";
import type { ActionResult } from "@/lib/types";
import { Input } from "@/components/ui/input";

/** Large digit input that submits itself on the sixth digit. */
export function MfaForm({ next, verify = verifyMfaLogin, onDone }: { next: string; verify?: (code: string) => Promise<ActionResult>; onDone?: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const submit = (value: string) =>
    start(async () => {
      setError(null);
      const res = await verify(value);
      if (res.ok) {
        if (onDone) onDone();
        // A full load, so every server component sees the upgraded session.
        else window.location.assign(next);
        return;
      }
      setError(res.error);
      setCode("");
      input.current?.focus();
    });

  return (
    <form
      className="mt-8 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) submit(code);
      }}
    >
      <div className="relative">
        <Input
          ref={input}
          autoFocus
          value={code}
          disabled={pending}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(value);
            if (value.length === 6) submit(value);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="6-digit code"
          aria-describedby={error ? "mfa-error" : undefined}
          placeholder="000000"
          className="num h-16 text-center text-[34px] font-semibold tracking-[0.3em] max-md:h-16 max-md:text-[34px]"
        />
        {pending && <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted" />}
      </div>
      {error && (
        <p id="mfa-error" role="alert" className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
