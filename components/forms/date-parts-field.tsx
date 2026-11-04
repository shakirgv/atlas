"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { daysInMonth, INCOMPLETE_DATE, joinDate, MONTH_NAMES, splitDate, type DateParts } from "@/lib/dates";
import { Input, NativeSelect } from "@/components/ui/input";

/**
 * A date as day, month name and year. The browser's own date field shows whatever numeric order the device
 * is set to, where 04/01 can be read two ways. A part-filled date stays in the form as INCOMPLETE_DATE, so saving refuses it.
 */
export function DatePartsField({ id, label, value, onChange, invalid, autoFocus, shortMonths }: { id: string; label: string; value: string | null | undefined; onChange: (value: string) => void; invalid?: boolean; autoFocus?: boolean; shortMonths?: boolean }) {
  const [draft, setDraft] = useState<DateParts>({ day: "", month: "", year: "" });
  const parts = value === INCOMPLETE_DATE ? draft : splitDate(value);
  const update = (patch: Partial<DateParts>) => {
    const next = { ...parts, ...patch };
    // 31 January moved to February lands on its last day, not on an invalid date.
    if (Number(next.day) > daysInMonth(next.year, next.month)) next.day = String(daysInMonth(next.year, next.month)).padStart(2, "0");
    setDraft(next);
    onChange(joinDate(next));
  };
  const filled = Boolean(parts.day || parts.month || parts.year);
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <NativeSelect id={id} autoFocus={autoFocus} aria-label={`${label} day`} aria-invalid={invalid || undefined} value={parts.day} onChange={(e) => update({ day: e.target.value })} className="w-[5.25rem] shrink-0">
        <option value="">Day</option>
        {Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => String(i + 1).padStart(2, "0")).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect aria-label={`${label} month`} aria-invalid={invalid || undefined} value={parts.month} onChange={(e) => update({ month: e.target.value })} className="min-w-0 flex-1">
        <option value="">Month</option>
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, "0")}>
            {shortMonths ? name.slice(0, 3) : name}
          </option>
        ))}
      </NativeSelect>
      <Input aria-label={`${label} year`} aria-invalid={invalid || undefined} inputMode="numeric" maxLength={4} placeholder="Year" value={parts.year} onChange={(e) => update({ year: e.target.value.replace(/\D/g, "") })} className="num w-[4.75rem] shrink-0" />
      <button type="button" onClick={() => update({ day: "", month: "", year: "" })} disabled={!filled} aria-label={`Clear ${label.toLowerCase()} date`} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5 disabled:invisible max-md:size-11">
        <X className="size-4" />
      </button>
    </div>
  );
}
