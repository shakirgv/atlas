"use client";
import { useActionState } from "react";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { signIn, type SignInState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, undefined);
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus className="pl-9" placeholder="you@example.com" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input id="password" name="password" type="password" autoComplete="current-password" required className="pl-9" placeholder="••••••••" />
        </div>
      </div>
      {state?.error ? (
        <p role="alert" className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Sign in
        {!pending ? <ArrowRight /> : null}
      </Button>
      <p className="text-center text-xs text-muted">Private app · single account · sign-ups are disabled</p>
    </form>
  );
}
