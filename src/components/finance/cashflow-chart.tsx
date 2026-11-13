"use client";

import * as React from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/common/segmented";
import { formatCurrencyCents } from "@/lib/currency";
import type { CashflowPoint } from "@/lib/finance/overview";

type Series = "fluxo" | "entradas" | "saidas" | "caixa";

const SERIES_OPTIONS: { value: Series; label: string }[] = [
  { value: "fluxo", label: "Entradas e saídas" },
  { value: "entradas", label: "Entradas" },
  { value: "saidas", label: "Saídas" },
  { value: "caixa", label: "Caixa" },
];

// Cores com contraste sobre branco: azul-petróleo (entradas), laranja-tijolo
// (saídas — diferente também em luminosidade), tinta (caixa acumulado).
const COLOR = { entradas: "#2d6f96", saidas: "#c26a3d", caixa: "#0f1f2b" };

/** Eixo em reais curtos: R$ 1,2 mil. */
function compactBRL(cents: number): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(reais)}`;
}

function TooltipCard({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as CashflowPoint;
  return (
    <div className="brand-gradient w-52 rounded-3xl p-4 shadow-lg">
      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-medium uppercase tracking-wide">{label}</span>
        <div className="flex justify-between text-body"><span>Entradas</span><span className="font-semibold">{formatCurrencyCents(point.entradas)}</span></div>
        <div className="flex justify-between text-body"><span>Saídas</span><span className="font-semibold">{formatCurrencyCents(point.saidas)}</span></div>
        <span className="mt-1 text-caption">Saldo do período</span>
        <span className="font-display text-heading-sm leading-none">{formatCurrencyCents(point.saldo)}</span>
        <span className="text-caption">Caixa no fim: {formatCurrencyCents(point.caixa)}</span>
      </div>
    </div>
  );
}

export function CashflowChart({ data, className }: { data: CashflowPoint[]; className?: string }) {
  const [series, setSeries] = React.useState<Series>("fluxo");
  const showIn = series === "fluxo" || series === "entradas";
  const showOut = series === "fluxo" || series === "saidas";
  const showCash = series === "caixa";
  const empty = data.every((p) => p.entradas === 0 && p.saidas === 0);

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5">
        <h2 className="font-display text-subheading">Fluxo de caixa</h2>
        <Segmented label="O que mostrar no gráfico" variant="chips" value={series} onChange={setSeries} options={SERIES_OPTIONS} />
      </div>
      <div className="h-72 px-2" role="img" aria-label="Gráfico do fluxo de caixa realizado no período">
        {empty ? (
          <div className="flex h-full items-center justify-center text-body text-muted-foreground">Nenhuma entrada ou saída realizada neste período.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="cf-in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6aa5cf" stopOpacity={0.45} />
                  <stop offset="1" stopColor="#6aa5cf" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cf-out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#c26a3d" stopOpacity={0.2} />
                  <stop offset="1" stopColor="#c26a3d" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e3eef5" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#4f6475", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={72} tick={{ fill: "#4f6475", fontSize: 12 }} tickFormatter={compactBRL} />
              <Tooltip content={TooltipCard} cursor={{ stroke: "#0f1f2b", strokeDasharray: "3 5" }} />
              {showIn ? <Area type="monotone" dataKey="entradas" name="Entradas" stroke={COLOR.entradas} strokeWidth={3} fill="url(#cf-in)" activeDot={{ r: 6, fill: "#fff", stroke: COLOR.entradas, strokeWidth: 3 }} /> : null}
              {showOut ? <Area type="monotone" dataKey="saidas" name="Saídas" stroke={COLOR.saidas} strokeWidth={2.4} fill="url(#cf-out)" activeDot={{ r: 5, fill: "#fff", stroke: COLOR.saidas, strokeWidth: 3 }} /> : null}
              {showCash ? <Line type="monotone" dataKey="caixa" name="Caixa" stroke={COLOR.caixa} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "#fff", stroke: COLOR.caixa, strokeWidth: 3 }} /> : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-wrap gap-4 px-5 text-caption text-muted-foreground">
        {showIn ? <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full" style={{ background: COLOR.entradas }} />Entradas</span> : null}
        {showOut ? <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full" style={{ background: COLOR.saidas }} />Saídas</span> : null}
        {showCash ? <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full" style={{ background: COLOR.caixa }} />Caixa acumulado</span> : null}
        <span className="ml-auto">Só o que já foi pago ou recebido</span>
      </div>
    </Card>
  );
}
