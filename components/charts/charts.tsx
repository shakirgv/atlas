"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EXPENSE_CATEGORY_META, formatMoney } from "@/lib/money";
import { fmtShort } from "@/lib/dates";
import type { ExpenseCategory } from "@/lib/types";
import { useReducedMotion } from "@/hooks/use-media-query";

const axisTick = { fill: "var(--muted)", fontSize: 12 };

function ChartTooltip({ active, payload, label, currency, labelFormat }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { fill?: string } }[]; label?: string | number; currency: string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {label !== undefined && label !== "" && <p className="mb-1 font-medium">{labelFormat ? labelFormat(String(label)) : label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          <span className="text-muted">{p.name}</span>
          <span className="num ml-auto font-medium">{formatMoney(Number(p.value ?? 0), currency)}</span>
        </p>
      ))}
    </div>
  );
}

/** Donut of actual spend by category. */
export function CategoryDonut({ data, currency, height = 220, center }: { data: { category: ExpenseCategory; value: number }[]; currency: string; height?: number; center?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const rows = data.filter((d) => d.value > 0).map((d) => ({ name: EXPENSE_CATEGORY_META[d.category].label, value: Math.round(d.value * 100) / 100, fill: EXPENSE_CATEGORY_META[d.category].color }));
  if (!rows.length) return <div className="grid place-items-center text-sm text-muted" style={{ height }}>No spending yet</div>;
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="94%" paddingAngle={2} cornerRadius={4} stroke="var(--surface)" strokeWidth={2} isAnimationActive={!reduce}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.fill} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip currency={currency} />} />
        </PieChart>
      </ResponsiveContainer>
      {center ? <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div> : null}
    </div>
  );
}

export function DonutLegend({ data, currency }: { data: { category: ExpenseCategory; value: number }[]; currency: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ul className="flex flex-col gap-1.5">
      {data
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((d) => (
          <li key={d.category} className="flex items-center gap-2 text-sm">
            <span className="size-2.5 rounded-[3px]" style={{ background: EXPENSE_CATEGORY_META[d.category].color }} />
            <span className="flex-1 text-ink/80">{EXPENSE_CATEGORY_META[d.category].label}</span>
            <span className="num text-xs text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            <span className="num w-20 text-right font-medium">{formatMoney(d.value, currency, { compact: d.value >= 10000 })}</span>
          </li>
        ))}
    </ul>
  );
}

/** Grouped bars: planned vs actual per country. */
export function PlannedVsActual({ data, currency, height = 280 }: { data: { name: string; flag: string; planned: number; actual: number }[]; currency: string; height?: number }) {
  const reduce = useReducedMotion();
  if (!data.length) return <div className="grid place-items-center text-sm text-muted" style={{ height }}>Link expenses to countries to compare</div>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, label: `${d.flag} ${d.name.length > 10 ? `${d.name.slice(0, 9)}…` : d.name}` }))} barGap={3} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width="auto" tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })} />
          <Tooltip cursor={{ fill: "var(--accent-soft)" }} content={<ChartTooltip currency={currency} />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
          <Bar dataKey="planned" name="Planned" fill="var(--planned)" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} />
          <Bar dataKey="actual" name="Spent" fill="var(--visited)" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={!reduce} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Cumulative spend over time. */
export function CumulativeSpend({ data, currency, budget, height = 260 }: { data: { date: string; spent: number }[]; currency: string; budget?: number; height?: number }) {
  const reduce = useReducedMotion();
  if (data.length < 1) return <div className="grid place-items-center text-sm text-muted" style={{ height }}>Your spending curve appears here</div>;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(d: string) => fmtShort(d)} minTickGap={24} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width="auto" tickFormatter={(v: number) => formatMoney(v, currency, { compact: true })} domain={[0, (max: number) => Math.max(max, budget ?? 0) * 1.05]} />
          <Tooltip content={<ChartTooltip currency={currency} labelFormat={(l) => fmtShort(l)} />} />
          <Area type="monotone" dataKey="spent" name="Spent so far" stroke="var(--accent)" strokeWidth={2.5} fill="url(#spendFill)" isAnimationActive={!reduce} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small ring for "Budget used". */
export function Ring({ value, size = 56, stroke = 6, color = "var(--visited)" }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={value > 1 ? "var(--danger)" : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="transition-[stroke-dashoffset] duration-1000 ease-out" />
    </svg>
  );
}
