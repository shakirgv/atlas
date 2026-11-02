"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { confirmMfaEnroll, disableMfa, startMfaEnroll } from "@/actions/mfa";
import { removeVaultPin, setLockTimeout, setVaultPin } from "@/actions/vault";
import { LOCK_TIMEOUTS, PIN_PATTERN } from "@/lib/vault-mask";
import { SubmitButton } from "@/components/forms/form-bits";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { LOCK_ON_HIDE_KEY } from "@/components/vault/vault-lock";

function CodeField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return <Input id={id} autoFocus value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="num text-center text-xl tracking-[0.3em]" />;
}

function TwoFactor({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");

  const begin = () =>
    start(async () => {
      const res = await startMfaEnroll();
      if (!res.ok) return void toast.error(res.error);
      setCode("");
      setEnroll(res.data);
    });
  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enroll) return;
    start(async () => {
      const res = await confirmMfaEnroll(enroll.factorId, code);
      if (!res.ok) return void toast.error(res.error);
      setEnroll(null);
      toast.success("Two-factor login is on");
      router.refresh();
    });
  };
  const disable = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await disableMfa(code);
      if (!res.ok) return void toast.error(res.error);
      setDisabling(false);
      setCode("");
      toast.success("Two-factor login is off");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <Smartphone className="size-4 text-accent" /> Authenticator app
        </span>
        {enabled ? (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-visited-soft px-2 text-[11px] font-medium">
            <CircleCheck className="size-3 text-visited" /> Enabled
          </span>
        ) : (
          <span className="text-xs text-muted">Off</span>
        )}
      </div>
      <p className="text-sm text-muted">{enabled ? "Signing in asks for a code from your app. Even with your password, nobody can reach your data without it." : "Ask for a code from an authenticator app when signing in, so a leaked password isn't enough."}</p>
      <div>
        {enabled ? (
          <Button variant="secondary" size="sm" onClick={() => (setCode(""), setDisabling(true))}>
            Turn off
          </Button>
        ) : (
          <Button size="sm" onClick={begin} disabled={pending}>
            Set up
          </Button>
        )}
      </div>

      {enroll && (
        <ResponsiveDialog
          open
          onOpenChange={(o) => !o && setEnroll(null)}
          title="Set up your authenticator"
          description="Scan this with your app, then type the code it shows."
          footer={
            <SubmitButton form="mfa-enroll" pending={pending} disabled={code.length !== 6}>
              Turn on
            </SubmitButton>
          }
        >
          <form id="mfa-enroll" onSubmit={confirm} className="flex flex-col items-center gap-4 pb-2">
            <img src={enroll.qr} alt="QR code for your authenticator app" className="size-48 rounded-xl bg-white p-2" />
            <div className="w-full text-center">
              <p className="text-xs text-muted">Can&apos;t scan it? Enter this key:</p>
              <p className="mt-0.5 break-all font-mono text-sm">{enroll.secret}</p>
            </div>
            <Field label="6-digit code" htmlFor="mfa-new" className="w-full">
              <CodeField id="mfa-new" value={code} onChange={setCode} />
            </Field>
          </form>
        </ResponsiveDialog>
      )}
      {disabling && (
        <ResponsiveDialog
          open
          onOpenChange={setDisabling}
          title="Turn off two-factor login?"
          description="Enter a current code to confirm."
          footer={
            <SubmitButton form="mfa-off" pending={pending} disabled={code.length !== 6}>
              Turn off
            </SubmitButton>
          }
        >
          <form id="mfa-off" onSubmit={disable} className="pb-2">
            <Field label="6-digit code" htmlFor="mfa-current">
              <CodeField id="mfa-current" value={code} onChange={setCode} />
            </Field>
          </form>
        </ResponsiveDialog>
      )}
    </div>
  );
}

function PinDialog({ hasPin, onOpenChange }: { hasPin: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const valid = PIN_PATTERN.test(pin) && pin === again && password.length > 0;
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await setVaultPin({ password, pin });
      if (!res.ok) return void toast.error(res.error);
      toast.success(hasPin ? "PIN changed" : "PIN set. Sensitive documents are locked.");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={hasPin ? "Change your PIN" : "Set a PIN"}
      description="Your password confirms it's you. Forgotten your PIN? Set a new one here."
      footer={
        <SubmitButton form="pin-form" pending={pending} disabled={!valid}>
          Save PIN
        </SubmitButton>
      }
    >
      <form id="pin-form" onSubmit={save} className="flex flex-col gap-4 pb-2">
        <Field label="Account password" htmlFor="pin-password">
          <Input id="pin-password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="New PIN (4 to 8 digits)" htmlFor="pin-new">
            <Input id="pin-new" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(digits(e.target.value))} />
          </Field>
          <Field label="Repeat PIN" htmlFor="pin-again" error={again && pin !== again ? "Doesn't match" : undefined}>
            <Input id="pin-again" type="password" inputMode="numeric" autoComplete="new-password" value={again} onChange={(e) => setAgain(digits(e.target.value))} />
          </Field>
        </div>
      </form>
    </ResponsiveDialog>
  );
}

function RemovePinDialog({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await removeVaultPin({ password });
      if (!res.ok) return void toast.error(res.error);
      toast.success("PIN removed. Documents are no longer locked.");
      onOpenChange(false);
      router.refresh();
    });
  };
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="Remove your PIN?"
      description="Sensitive documents will open without a PIN."
      footer={
        <SubmitButton form="pin-remove" pending={pending} disabled={!password}>
          Remove PIN
        </SubmitButton>
      }
    >
      <form id="pin-remove" onSubmit={save} className="pb-2">
        <Field label="Account password" htmlFor="pin-remove-password">
          <Input id="pin-remove-password" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </form>
    </ResponsiveDialog>
  );
}

function PinVault({ hasPin, timeout }: { hasPin: boolean; timeout: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [minutes, setMinutes] = useState(timeout);
  const [hideLock, setHideLock] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setHideLock(localStorage.getItem(LOCK_ON_HIDE_KEY) === "1"), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <KeyRound className="size-4 text-accent" /> PIN for sensitive documents
        </span>
        {hasPin ? (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-visited-soft px-2 text-[11px] font-medium">
            <CircleCheck className="size-3 text-visited" /> On
          </span>
        ) : (
          <span className="text-xs text-muted">Off</span>
        )}
      </div>
      {!hasPin && <p className="rounded-xl bg-planned-soft px-3 py-2 text-sm">Set a PIN to lock your passport, visas, ID and insurance, even when your phone is unlocked.</p>}
      {hasPin && <p className="text-sm text-muted">Passport, ID, visa, insurance and vaccination documents need the PIN to open, and any other document you mark as sensitive.</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={hasPin ? "secondary" : "primary"} onClick={() => setEditing(true)}>
          {hasPin ? "Change PIN" : "Set a PIN"}
        </Button>
        {hasPin && (
          <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
            Remove PIN
          </Button>
        )}
      </div>
      {hasPin && (
        <>
          <Field label="Lock again after" htmlFor="lock-timeout" hint="Without activity. The vault also locks when you tap Lock now.">
            <NativeSelect
              id="lock-timeout"
              value={String(minutes)}
              onChange={(e) => {
                const value = Number(e.target.value);
                const before = minutes;
                setMinutes(value);
                start(async () => {
                  const res = await setLockTimeout(value);
                  if (!res.ok) {
                    toast.error(res.error);
                    setMinutes(before);
                  } else router.refresh();
                });
              }}
            >
              {LOCK_TIMEOUTS.map((m) => (
                <option key={m} value={m}>
                  {m} minute{m === 1 ? "" : "s"}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            Lock when this tab is hidden
            <Switch
              checked={hideLock}
              onCheckedChange={(v) => {
                setHideLock(v);
                localStorage.setItem(LOCK_ON_HIDE_KEY, v ? "1" : "0");
              }}
              aria-label="Lock when this tab is hidden"
            />
          </label>
        </>
      )}
      {editing && <PinDialog hasPin={hasPin} onOpenChange={setEditing} />}
      {removing && <RemovePinDialog onOpenChange={setRemoving} />}
    </div>
  );
}

/** Settings → Security. */
export function SecuritySection({ mfaEnabled, hasPin, timeout }: { mfaEnabled: boolean; hasPin: boolean; timeout: number }) {
  return (
    <div className="flex flex-col gap-4" data-testid="security-section">
      <TwoFactor enabled={mfaEnabled} />
      <PinVault hasPin={hasPin} timeout={timeout} />
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" /> Lost your authenticator? The README has the recovery steps.
      </p>
    </div>
  );
}
