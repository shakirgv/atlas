import type { Expense, ExpenseCategory } from "@/lib/types";
import { EXPENSE_CATEGORY_ICON } from "@/lib/icons";
import { EXPENSE_CATEGORY_META, formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";

export function ExpenseRow({ e, base }: { e: Expense; base: string }) {
  const cat = e.category as ExpenseCategory;
  const Icon = EXPENSE_CATEGORY_ICON[cat] ?? EXPENSE_CATEGORY_ICON.other;
  const meta = EXPENSE_CATEGORY_META[cat] ?? EXPENSE_CATEGORY_META.other;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `${meta.color}22` }}>
        <Icon className="size-4" style={{ color: meta.color }} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{e.title || meta.label}</span>
        <span className="text-xs text-muted">
          {fmtDate(e.date)} · {e.kind === "planned" ? "Planned" : "Spent"}
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span className="num text-sm font-medium">{formatMoney(Number(e.amount_base), base)}</span>
        {e.currency !== base && <span className="num text-xs text-muted">{formatMoney(Number(e.amount), e.currency)}</span>}
      </span>
    </li>
  );
}
