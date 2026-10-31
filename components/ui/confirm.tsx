"use client";
import * as React from "react";
import { AlertDialog as P } from "radix-ui";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

const ConfirmContext = React.createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = React.useCallback(
    (o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <P.Root open={Boolean(state)} onOpenChange={(o) => !o && close(false)}>
        <P.Portal>
          <P.Overlay className="fixed inset-0 z-[60] bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <P.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-border bg-surface p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]">
            <div className="flex gap-4">
              {state?.destructive !== false && (
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-soft text-danger">
                  <AlertTriangle className="size-5" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <P.Title className="font-display text-xl font-semibold">{state?.title}</P.Title>
                <P.Description className="text-sm text-muted">{state?.description ?? "This cannot be undone."}</P.Description>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <P.Cancel asChild>
                <Button variant="secondary">Cancel</Button>
              </P.Cancel>
              <P.Action asChild>
                <Button variant={state?.destructive === false ? "primary" : "danger"} onClick={() => close(true)}>
                  {state?.confirmLabel ?? "Delete"}
                </Button>
              </P.Action>
            </div>
          </P.Content>
        </P.Portal>
      </P.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}

/** Two-step inline confirmation for use inside sheets and dialogs (no modal inside a modal). */
export function InlineConfirmButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Click again to delete",
  className,
  icon,
  disabled,
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
  confirmLabel?: string;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant={armed ? "danger" : "ghost"}
      className={cn(!armed && "text-danger hover:bg-danger-soft", className)}
      disabled={disabled}
      onClick={async () => {
        if (!armed) return setArmed(true);
        setArmed(false);
        await onConfirm();
      }}
    >
      {icon}
      {armed ? confirmLabel : label}
    </Button>
  );
}
