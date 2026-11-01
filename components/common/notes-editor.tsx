"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Eye, Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { Markdown } from "./markdown";

/** Notes with debounced autosave and a markdown preview. */
export function NotesEditor({ initial, onSave, placeholder }: { initial: string | null; onSave: (v: string) => Promise<ActionResult>; placeholder?: string }) {
  const [value, setValue] = useState(initial ?? "");
  const [mode, setMode] = useState<"edit" | "preview">(initial ? "preview" : "edit");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const last = useRef(initial ?? "");

  useEffect(() => {
    if (value === last.current) return;
    const t = setTimeout(async () => {
      setState("saving");
      const res = await onSave(value);
      if (!res.ok) {
        toast.error(res.error);
        setState("idle");
        return;
      }
      last.current = value;
      setState("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [value, onSave]);

  return (
    <div className="card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <Segmented
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "edit", label: "Write", icon: <PenLine /> },
            { value: "preview", label: "Preview", icon: <Eye /> },
          ]}
        />
        <span className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
          {state === "saving" && (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </>
          )}
          {state === "saved" && (
            <>
              <Check className="size-3.5 text-visited" /> Saved
            </>
          )}
        </span>
      </div>
      {mode === "edit" ? (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={12}
          placeholder={placeholder ?? "Tips, must-dos, phrases, things to remember… Markdown works."}
          className="min-h-72 border-transparent bg-surface-2 font-[450] focus-visible:bg-surface"
          aria-label="Notes"
        />
      ) : value ? (
        <Markdown className="min-h-32">{value}</Markdown>
      ) : (
        <button type="button" onClick={() => setMode("edit")} className="min-h-32 rounded-xl bg-surface-2 text-sm text-muted">
          No notes yet — tap to write.
        </button>
      )}
    </div>
  );
}
