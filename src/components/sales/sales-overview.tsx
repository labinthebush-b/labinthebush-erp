"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CurrencyInput } from "@/components/common/currency-input";
import { usePlanning } from "@/lib/planning/planning-provider";
import { formatCurrencyCents } from "@/lib/currency";
import { formatMonthLabel } from "@/lib/finance/period";
import { SALES_GOAL_CATEGORY_ID, buildSalesGoalProgress, type RevenuePoint } from "@/lib/sales/goal";
import { CHANNEL_LABELS } from "@/components/sales/sale-labels";
import type { SalesChannel } from "@/lib/sales/types";
import { cn } from "@/lib/utils";

function compactBRL(cents: number): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(reais)}`;
}

/**
 * Meta do mês em destaque. A meta é a meta mensal da categoria de receita
 * "venda" no Planejamento — editar aqui ou lá é a mesma coisa.
 */
export function SalesGoalCard({ revenue, monthId, todayISO, className }: { revenue: number; monthId: string; todayISO: string; className?: string }) {
  const { getBudget, setBudget } = usePlanning();
  const budget = getBudget(SALES_GOAL_CATEGORY_ID);
  const goal = budget?.kind === "valor" ? budget.value : 0;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(goal);

  function save() {
    if (draft <= 0) return toast.error("Digite uma meta maior que zero.");
    setBudget(SALES_GOAL_CATEGORY_ID, "valor", draft);
    setEditing(false);
    toast.success("Meta de vendas salva.");
  }

  const p = buildSalesGoalProgress(goal, revenue, monthId, todayISO);

  return (
    <section aria-label="Meta do mês" className={cn("brand-gradient brand-gradient-animated flex flex-col gap-4 rounded-2xl p-6", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption font-semibold uppercase tracking-wide">Meta de {formatMonthLabel(monthId).split(" ")[0].toLowerCase()}</span>
        {goal > 0 && !editing ? (
          <Button size="sm" variant="ghost" className="bg-white/60" onClick={() => { setDraft(goal); setEditing(true); }}>
            <Pencil className="size-3.5" /> Mudar meta
          </Button>
        ) : null}
      </div>

      {goal === 0 || editing ? (
        <div className="flex flex-col gap-3">
          <span className="font-display text-heading leading-tight">{goal === 0 ? "Quanto você quer vender por mês?" : "Nova meta mensal"}</span>
          <div className="flex flex-wrap gap-2">
            <CurrencyInput value={draft} onValueChange={setDraft} className="h-11 w-44 rounded-full bg-white/85" aria-label="Meta de vendas por mês" />
            <Button size="lg" onClick={save}>Salvar meta</Button>
            {editing ? <Button size="lg" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button> : null}
          </div>
          <span className="text-caption">Vale para todo mês — dá para ajustar quando quiser.</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-display leading-none">{formatCurrencyCents(revenue)}</span>
            <span className="text-body-lg">de {formatCurrencyCents(goal)}</span>
          </div>
          <div className="relative h-3 rounded-full bg-white/70">
            <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, p.percent)}%` }} />
            {p.daysLeft > 0 ? (
              <span
                className="absolute -top-1 h-5 w-0.5 rounded-full bg-primary/50"
                style={{ left: `${Math.min(100, (p.expectedByToday / goal) * 100)}%` }}
                title="Onde a receita deveria estar hoje"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-body">
            <span className="font-semibold">{Math.round(p.percent)}% da meta</span>
            {p.remaining === 0 ? (
              <span className="font-semibold">Meta batida 🎯</span>
            ) : p.daysLeft > 0 ? (
              <span>
                Faltam <strong>{formatCurrencyCents(p.remaining)}</strong> · {formatCurrencyCents(p.perDayNeeded)} por dia nos próximos {p.daysLeft} dias
              </span>
            ) : (
              <span>Faltaram {formatCurrencyCents(p.remaining)}</span>
            )}
          </div>
          {p.daysLeft > 0 && p.remaining > 0 ? (
            <span className="text-caption">{p.onPace ? "No ritmo para bater a meta." : `Abaixo do ritmo: hoje o esperado era ${formatCurrencyCents(p.expectedByToday)}.`}</span>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Receita de vendas mês a mês, com a linha da meta e o mês atual destacado. */
export function RevenueChart({ data, goal, className }: { data: RevenuePoint[]; goal: number; className?: string }) {
  const last = data.length - 1;
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5">
        <h2 className="font-display text-subheading">Receita por mês</h2>
        <span className="text-caption text-muted-foreground">vendas pagas e a receber</span>
      </div>
      <div className="h-64 px-2" role="img" aria-label="Receita de vendas por mês, com a linha da meta mensal">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 8 }}>
            <defs>
              <pattern id="rev-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="7" stroke="#88bbde" strokeWidth="2.5" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="#e3eef5" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#4f6475", fontSize: 12 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={72}
              tick={{ fill: "#4f6475", fontSize: 12 }}
              tickFormatter={compactBRL}
              // A escala sempre inclui a meta, senão a linha some quando as vendas estão abaixo dela.
              domain={[0, (dataMax: number) => Math.max(dataMax, goal) * 1.1]}
            />
            <Tooltip
              cursor={{ fill: "#eef5fa" }}
              formatter={(value, _name, item) => [`${formatCurrencyCents(Number(value))} · ${(item.payload as RevenuePoint).count} vendas`, "Receita"]}
              contentStyle={{ borderRadius: 16, border: "1px solid #dcebf4" }}
            />
            {goal > 0 ? <ReferenceLine y={goal} stroke="#0f1f2b" strokeDasharray="6 5" label={{ value: "meta", position: "insideTopRight", fill: "#0f1f2b", fontSize: 12 }} /> : null}
            <Bar dataKey="revenue" radius={[12, 12, 12, 12]} maxBarSize={56}>
              {data.map((point, index) => (
                <Cell key={point.monthId} fill={index === last ? "#2d6f96" : "#6aa5cf"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** De onde vêm as vendas do mês: canais com barra proporcional. */
export function ChannelBreakdown({ rows, className }: { rows: { channel: SalesChannel; revenue: number; count: number }[]; className?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Card className={cn("gap-4 px-5", className)}>
      <h2 className="font-display text-subheading">Por canal</h2>
      {rows.every((r) => r.count === 0) ? (
        <p className="text-body text-muted-foreground">Nenhuma venda neste mês ainda.</p>
      ) : (
        rows
          .filter((r) => r.count > 0)
          .map((r) => (
            <div key={r.channel} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-body">
                <span>{CHANNEL_LABELS[r.channel]}</span>
                <span><span className="font-semibold">{formatCurrencyCents(r.revenue)}</span> <span className="text-muted-foreground">· {r.count}</span></span>
              </div>
              <div className="h-2 rounded-full bg-paper-mist">
                <div className="h-2 rounded-full bg-linear-to-r from-brand-blue to-brand-aqua" style={{ width: `${Math.max(3, (r.revenue / max) * 100)}%` }} />
              </div>
            </div>
          ))
      )}
    </Card>
  );
}
