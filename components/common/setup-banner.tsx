"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { House, X } from "lucide-react";

const KEY = "atlas:setup-banner-dismissed";

/** Gentle, dismissible nudge when home or passport country is missing. */
export function SetupBanner({ missingHome, missingPassport }: { missingHome: boolean; missingPassport: boolean }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    const t = setTimeout(() => setHidden(dismissed), 0);
    return () => clearTimeout(t);
  }, []);
  if (hidden || (!missingHome && !missingPassport)) return null;
  const what = missingHome && missingPassport ? "home and passport country" : missingHome ? "home city" : "passport country";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-[var(--shadow-card)]">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft">
        <House className="size-4 text-accent" />
      </span>
      <p className="min-w-0 flex-1">
        Set your {what} to unlock jet lag and visa checks.{" "}
        <Link href="/settings#home" className="font-medium text-accent hover:underline">
          Open settings
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
          setHidden(true);
        }}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
