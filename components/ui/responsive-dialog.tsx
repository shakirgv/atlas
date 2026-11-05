"use client";
import * as React from "react";
import { Drawer } from "vaul";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Mobile only: false stops a swipe or a tap outside from closing the sheet. */
  dismissible?: boolean;
};

/** Centered dialog on desktop, bottom sheet on mobile. */
export function ResponsiveDialog({ open, onOpenChange, title, description, footer, children, className, bodyClassName, dismissible }: Props) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className} aria-describedby={description ? undefined : undefined}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogDescription>}
          </DialogHeader>
          <DialogBody className={bodyClassName}>{children}</DialogBody>
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false} dismissible={dismissible}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[22px] border-t border-border bg-surface outline-none",
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border" />
          <div className="flex shrink-0 flex-col gap-1 px-5 pb-2 pt-3">
            <Drawer.Title className="font-display text-[22px] font-semibold">{title}</Drawer.Title>
            {description ? (
              <Drawer.Description className="text-sm text-muted">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{typeof title === "string" ? title : "Sheet"}</Drawer.Description>
            )}
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3", bodyClassName)}>{children}</div>
          {footer ? (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-surface-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {footer}
            </div>
          ) : (
            <div className="pb-[env(safe-area-inset-bottom)]" />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
