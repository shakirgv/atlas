"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2, Lock } from "lucide-react";
import { unlockVault, type UnlockResult } from "@/actions/vault";
import type { ActionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

function lockoutText(until: string) {
  const minutes = Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 60000));
  return `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** Numeric keypad: submits itself at the PIN's length, shakes on a wrong one. Digits on a keyboard work too. */
export function PinPad({ length, lockedUntil, submit, onUnlocked, title = "Enter your PIN" }: { length: number | null; lockedUntil?: string | null; submit: (pin: string) => Promise<ActionResult<UnlockResult>>; onUnlocked: () => void; title?: string }) {
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState<string | null>(lockedUntil ? lockoutText(lockedUntil) : null);
  const [locked, setLocked] = useState(Boolean(lockedUntil));
  const [shake, setShake] = useState(false);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const size = length ?? 8;

  const send = useCallback(
    (value: string) =>
      start(async () => {
        const res = await submit(value);
        if (!res.ok) {
          setPin("");
          setMessage(res.error);
          return;
        }
        if (res.data.unlocked) {
          setMessage(null);
          onUnlocked();
          return;
        }
        setPin("");
        // On a timer: with reduced motion no animation runs, so there would be no end event to clear it.
        setShake(true);
        setTimeout(() => setShake(false), 400);
        navigator.vibrate?.(80);
        if (res.data.lockedUntil) {
          setLocked(true);
          setMessage(lockoutText(res.data.lockedUntil));
        } else {
          setMessage(`Wrong PIN. ${res.data.attemptsLeft} ${res.data.attemptsLeft === 1 ? "try" : "tries"} left.`);
        }
      }),
    [submit, onUnlocked],
  );

  const press = (digit: string) => {
    if (pending || locked || pin.length >= size) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === length) send(next);
  };
  const back = () => !pending && !locked && setPin((p) => p.slice(0, -1));

  useEffect(() => {
    box.current?.focus();
  }, []);

  return (
    <div
      ref={box}
      tabIndex={-1}
      data-testid="pin-pad"
      className="mx-auto flex w-full max-w-[280px] flex-col items-center gap-4 outline-none"
      onKeyDown={(e) => {
        if (/^\d$/.test(e.key)) press(e.key);
        else if (e.key === "Backspace") back();
        else if (e.key === "Enter" && !length && pin.length >= 4) send(pin);
      }}
    >
      <span className="grid size-11 place-items-center rounded-full bg-accent-soft">
        <Lock className="size-5 text-accent" />
      </span>
      <p className="font-display text-xl font-semibold">{title}</p>
      <div
        role="status"
        aria-label={`${pin.length} digit${pin.length === 1 ? "" : "s"} entered`}
        className={cn("flex h-5 items-center gap-2.5", shake && "pin-shake")}
      >
        {Array.from({ length: length ?? Math.max(4, pin.length) }, (_, i) => (
          <span key={i} className={cn("size-3 rounded-full border-2 border-ink/40 transition-colors", i < pin.length && "border-ink bg-ink")} />
        ))}
      </div>
      <p role="alert" className={cn("min-h-5 text-center text-sm", locked ? "font-medium text-danger" : "text-muted")}>
        {pending ? <Loader2 className="inline size-4 animate-spin" /> : message}
      </p>
      <div className="grid w-full grid-cols-3 gap-2" role="group" aria-label="Keypad">
        {KEYS.map((k) => (
          <button key={k} type="button" disabled={locked} onClick={() => press(k)} className="num h-14 rounded-2xl bg-surface-2 text-xl font-semibold ring-1 ring-border transition-colors hover:bg-ink/5 active:bg-ink/10 disabled:opacity-40">
            {k}
          </button>
        ))}
        {length ? (
          <span />
        ) : (
          <button type="button" disabled={locked || pin.length < 4} onClick={() => send(pin)} className="h-14 rounded-2xl text-sm font-medium text-accent disabled:opacity-40">
            OK
          </button>
        )}
        <button type="button" disabled={locked} onClick={() => press("0")} className="num h-14 rounded-2xl bg-surface-2 text-xl font-semibold ring-1 ring-border transition-colors hover:bg-ink/5 active:bg-ink/10 disabled:opacity-40">
          0
        </button>
        <button type="button" disabled={locked} onClick={back} aria-label="Delete last digit" className="grid h-14 place-items-center rounded-2xl text-muted hover:bg-ink/5 disabled:opacity-40">
          <Delete className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** The keypad wired to the vault. On success the page reloads its data from the server, now unmasked. */
export function VaultGate({ length, lockedUntil, onUnlocked }: { length: number | null; lockedUntil?: string | null; onUnlocked?: () => void }) {
  const router = useRouter();
  return (
    <div className="relative overflow-hidden rounded-2xl py-6">
      <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(0deg,var(--border)_0_10px,transparent_10px_26px)] opacity-40 blur-md" />
      <div className="relative">
        <PinPad
          length={length}
          lockedUntil={lockedUntil}
          submit={unlockVault}
          onUnlocked={() => {
            onUnlocked?.();
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
