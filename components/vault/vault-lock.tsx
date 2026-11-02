"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LockOpen } from "lucide-react";
import { toast } from "sonner";
import { lockVault } from "@/actions/vault";
import { Button } from "@/components/ui/button";

export const LOCK_ON_HIDE_KEY = "atlas:lock-on-hide";

/** "Lock now" in the top bar while the vault is open, plus the optional lock-when-hidden. */
export function VaultLockButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const lock = () =>
    start(async () => {
      const res = await lockVault();
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === "hidden" && localStorage.getItem(LOCK_ON_HIDE_KEY) === "1") void lockVault();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return (
    <Button variant="secondary" size="sm" onClick={lock} disabled={pending} className="max-md:size-10 max-md:px-0" aria-label="Lock documents now">
      <LockOpen className="text-accent" /> <span className="max-md:sr-only">Lock now</span>
    </Button>
  );
}
