"use client";
import * as React from "react";
import { Drawer } from "vaul";
import { useIsDesktop } from "@/hooks/use-media-query";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./sheet";

/** Right-side drawer on desktop, bottom sheet on mobile. Children render their own layout. */
export function ResponsiveSheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-w-[520px] overflow-y-auto p-0">
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <SheetDescription className="sr-only">Details for {title}</SheetDescription>
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-overlay" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col overflow-hidden rounded-t-[22px] bg-surface outline-none">
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">Details for {title}</Drawer.Description>
          <div className="absolute left-1/2 top-2 z-20 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/70 shadow" />
          <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
