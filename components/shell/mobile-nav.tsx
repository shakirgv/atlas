"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Plus } from "lucide-react";
import { signOut } from "@/actions/auth";
import { updateSettings } from "@/actions/settings";
import { MOBILE_TABS, NAV_GROUPS, SETTINGS_ITEM, isActive } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { QUICK_ADD_ITEMS } from "./quick-add-menu";
import { ThemeToggle } from "./theme-toggle";
import { useWorkspace } from "./workspace";

export function MobileNav() {
  const pathname = usePathname();
  const ws = useWorkspace();
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const moreActive = !MOBILE_TABS.some((t) => isActive(pathname, t.href));

  return (
    <>
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        hidden={pathname === "/map"}
        className="no-print fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-[0_10px_30px_rgb(201_66_31/0.4)] transition-transform active:scale-95 md:hidden"
        aria-label="Quick add"
      >
        <Plus className="size-6" />
      </button>
      <nav
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Primary"
      >
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((t) => {
            const active = isActive(pathname, t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted", active && "text-ink")}
              >
                <t.icon className={cn("size-[22px]", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} />
                {t.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted", moreActive && "text-ink")}
          >
            <Menu className={cn("size-[22px]", moreActive && "text-accent")} />
            More
          </button>
        </div>
      </nav>

      <ResponsiveDialog open={addOpen} onOpenChange={setAddOpen} title="Quick add">
        <div className="grid grid-cols-2 gap-2 pb-2">
          {QUICK_ADD_ITEMS.map((i) => (
            <button
              key={i.kind}
              type="button"
              onClick={() => {
                setAddOpen(false);
                ws.openQuickAdd(i.kind);
              }}
              className="flex min-h-20 flex-col items-start justify-between gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left active:scale-[0.98]"
            >
              <i.icon className="size-5 text-accent" />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{i.label}</span>
                <span className="text-xs text-muted">{i.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </ResponsiveDialog>

      <ResponsiveDialog open={moreOpen} onOpenChange={setMoreOpen} title="Menu">
        <div className="flex flex-col gap-5 pb-2">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <div className="eyebrow mb-2">{g.label}</div>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface-2 p-2 text-center text-xs font-medium",
                      isActive(pathname, item.href) && "border-accent/40 bg-accent-soft",
                    )}
                  >
                    <item.icon className="size-5 text-accent" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Link
              href={SETTINGS_ITEM.href}
              onClick={() => setMoreOpen(false)}
              className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 text-sm font-medium"
            >
              <SETTINGS_ITEM.icon className="size-4 text-muted" /> Settings
            </Link>
            <form action={signOut}>
              <button type="submit" className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 text-sm font-medium">
                <LogOut className="size-4 text-muted" /> Sign out
              </button>
            </form>
          </div>
          <ThemeToggle onChange={(theme) => void updateSettings({ theme })} />
        </div>
      </ResponsiveDialog>
    </>
  );
}
