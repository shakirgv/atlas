"use client";
import { Building2, Camera, FileText, Flag, MapPin, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspace, type QuickAddKind } from "./workspace";

export const QUICK_ADD_ITEMS: { kind: QuickAddKind; label: string; icon: typeof Plus; hint: string }[] = [
  { kind: "country", label: "Country", icon: Flag, hint: "Bulk-add to the route" },
  { kind: "city", label: "City", icon: Building2, hint: "Search and pin" },
  { kind: "place", label: "Place", icon: MapPin, hint: "Sights and spots" },
  { kind: "expense", label: "Expense", icon: Wallet, hint: "Planned or spent" },
  { kind: "memory", label: "Memory", icon: Camera, hint: "Photos and notes" },
  { kind: "document", label: "Document", icon: FileText, hint: "Passport, visa, tickets" },
];

export function QuickAddMenu() {
  const ws = useWorkspace();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9">
          <Plus /> <span className="max-lg:sr-only">Quick add</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Add to {ws.isAll ? "your trips" : (ws.trips.find((t) => t.id === ws.activeTripId)?.title ?? "trip")}</DropdownMenuLabel>
        {QUICK_ADD_ITEMS.map((i) => (
          <DropdownMenuItem key={i.kind} onSelect={() => ws.openQuickAdd(i.kind)}>
            <i.icon />
            <span className="flex flex-col">
              <span>{i.label}</span>
              <span className="text-xs text-muted">{i.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
