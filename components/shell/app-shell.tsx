"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/components/ui/confirm";
import { MotionProvider } from "@/components/common/motion";
import { TripDialog } from "@/components/forms/trip-dialog";
import { AddCountriesDialog } from "@/components/forms/add-countries-dialog";
import { AddCitiesDialog } from "@/components/forms/add-cities-dialog";
import { PlaceDialog } from "@/components/forms/place-dialog";
import { ExpenseSheet } from "@/components/forms/expense-sheet";
import { MemoryDialog } from "@/components/forms/memory-composer";
import { DocumentDialog } from "@/components/forms/document-dialog";
import { BookingDialog } from "@/components/forms/booking-dialog";
import { CommandPalette } from "./command-palette";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { WelcomeDialog } from "./welcome-dialog";
import { WorkspaceProvider, type QuickAddKind, type QuickAddRequest, type Workspace } from "./workspace";

export function AppShell({ workspace, sidebarCollapsed, children }: { workspace: Workspace; sidebarCollapsed: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(sidebarCollapsed);
  const [quick, setQuick] = useState<QuickAddRequest | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { setTheme } = useTheme();

  // First load on a new device: adopt the theme saved in Settings.
  useEffect(() => {
    const saved = workspace.settings?.theme;
    if (saved && !localStorage.getItem("atlas-theme")) setTheme(saved);
  }, [workspace.settings?.theme, setTheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `sidebar=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  const openQuickAdd = useCallback(
    (req: QuickAddRequest | QuickAddKind) => {
      const r = typeof req === "string" ? { kind: req } : req;
      // Most things need a trip first.
      if (r.kind !== "trip" && r.kind !== "document" && !workspace.trips.length) return setQuick({ kind: "trip" });
      setQuick(r);
    },
    [workspace.trips.length],
  );

  const value = useMemo(
    () => ({ ...workspace, openQuickAdd, openPalette: () => setPaletteOpen(true) }),
    [workspace, openQuickAdd],
  );
  const close = (o: boolean) => !o && setQuick(null);

  return (
    <WorkspaceProvider value={value}>
      <MotionProvider>
        <TooltipProvider delayDuration={300}>
          <ConfirmProvider>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
              Skip to content
            </a>
            <div className="flex min-h-dvh">
              <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />
                <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-32 pt-6 has-[[data-full-bleed]]:max-w-none md:px-8 md:pb-16 md:pt-8">
                  {children}
                </main>
              </div>
            </div>
            <MobileNav />
            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
            <WelcomeDialog open={!workspace.settings?.display_name} />
            {quick?.kind === "trip" && <TripDialog open onOpenChange={close} />}
            {quick?.kind === "country" && <AddCountriesDialog open onOpenChange={close} tripId={quick.tripId} />}
            {quick?.kind === "city" && <AddCitiesDialog open onOpenChange={close} tripCountryId={quick.tripCountryId} />}
            {quick?.kind === "place" && <PlaceDialog open onOpenChange={close} cityId={quick.cityId} />}
            {quick?.kind === "expense" && <ExpenseSheet open onOpenChange={close} tripCountryId={quick.tripCountryId} preset={quick.preset} />}
            {quick?.kind === "memory" && <MemoryDialog open onOpenChange={close} preset={{ tripCountryId: quick.tripCountryId, cityId: quick.cityId }} />}
            {quick?.kind === "document" && <DocumentDialog open onOpenChange={close} />}
            {quick?.kind === "booking" && <BookingDialog open onOpenChange={close} />}
          </ConfirmProvider>
        </TooltipProvider>
      </MotionProvider>
    </WorkspaceProvider>
  );
}
