"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/common/segmented";
import { CashflowChart } from "@/components/finance/cashflow-chart";
import { ResultadoPanel } from "@/components/finance/resultado-panel";
import { ExpensesByCategory } from "@/components/finance/expenses-by-category";
import { PlanningPanel } from "@/components/finance/planning-panel";
import { TransactionsPanel } from "@/components/finance/transactions-panel";
import { RecurringRulesPanel } from "@/components/finance/recurring-rules-panel";
import { MonthClosingPanel } from "@/components/finance/month-closing-panel";
import { TransactionForm } from "@/components/finance/transaction-form";
import { QuickTransactionForm } from "@/components/finance/quick-transaction-form";
import { useUI } from "@/components/providers/ui-provider";
import { useFinance } from "@/lib/finance/finance-provider";
import { todayISO } from "@/lib/finance/actions";
import { calculateCaixa, calculateCashFlow, calculateResultado } from "@/lib/finance/calculations";
import { formatMonthLabel } from "@/lib/finance/period";
import {
  availableMonthIds,
  availableYears,
  buildCashflowSeries,
  resolveFinancePeriod,
  type FinancePeriodSelection,
} from "@/lib/finance/overview";
import { percentChange } from "@/lib/reports/period-range";
import { formatCurrencyCents } from "@/lib/currency";
import { cn } from "@/lib/utils";

type Kind = FinancePeriodSelection["kind"];

function Variation({ percent, upIsGood }: { percent?: number; upIsGood: boolean }) {
  if (percent === undefined) return null;
  const up = percent >= 0;
  const good = up === upIsGood;
  return (
    <span className={cn("flex items-center gap-0.5 text-caption font-semibold", good ? "text-vivid-green" : "text-tangerine")}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(Math.round(percent))}% vs anterior
    </span>
  );
}

function Ring({ percent, label }: { percent: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={label} className="shrink-0">
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--color-paper-mist)" strokeWidth="7" />
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--color-brand-blue)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(clamped / 100) * c} ${c}`} transform="rotate(-90 34 34)" />
      <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-charcoal)">{Math.round(percent)}%</text>
    </svg>
  );
}

export default function FinanceiroPage() {
  const { transactions, categories } = useFinance();
  const { openDrawer, closeDrawer, openModal } = useUI();
  const today = todayISO();

  const monthIds = React.useMemo(() => availableMonthIds(transactions, today), [transactions, today]);
  const years = React.useMemo(() => availableYears(transactions, today), [transactions, today]);
  const [kind, setKind] = React.useState<Kind>("tudo");
  const [monthId, setMonthId] = React.useState(today.slice(0, 7));
  const [year, setYear] = React.useState(today.slice(0, 4));

  const selection: FinancePeriodSelection = kind === "tudo" ? { kind } : kind === "ano" ? { kind, year } : { kind, monthId };
  const resolved = resolveFinancePeriod(selection, today);
  const { period, previous } = resolved;

  const caixa = calculateCaixa(transactions);
  const flow = calculateCashFlow(transactions, period, 0);
  const prevFlow = previous ? calculateCashFlow(transactions, previous, 0) : undefined;
  const resultado = calculateResultado(transactions, period, categories);
  const margin = resultado.receita > 0 ? (resultado.lucroLiquido / resultado.receita) * 100 : 0;
  const series = buildCashflowSeries(transactions, selection, today);

  function openQuick() {
    openDrawer({
      title: "Novo lançamento",
      description: "Valor, categoria, quando — e pronto.",
      content: (
        <QuickTransactionForm
          onDone={closeDrawer}
          onMoreOptions={() =>
            openDrawer({
              title: "Novo lançamento",
              description: "Tipo → categoria → dados essenciais → salvar.",
              content: <TransactionForm onDone={closeDrawer} />,
            })
          }
        />
      ),
    });
  }

  function openClosing() {
    openModal({
      title: `Fechar ${formatMonthLabel(resolved.monthId)}`,
      description: "Mês fechado não aceita novos lançamentos nem edições.",
      content: <MonthClosingPanel monthId={resolved.monthId} />,
      widthClassName: "sm:max-w-lg",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
          <div className="flex flex-col gap-1">
            <span className="text-body text-muted-foreground">{resolved.label}</span>
            <h1 className="font-display text-display">Financeiro</h1>
          </div>
          <div className="flex flex-col">
            <span className="text-caption text-muted-foreground">Caixa agora</span>
            <span className="font-display text-heading-lg">{formatCurrencyCents(caixa)}</span>
          </div>
          <div className="flex gap-6 text-body">
            <div className="flex flex-col"><span className="text-caption text-muted-foreground">A receber</span><span className="font-semibold">{formatCurrencyCents(flow.aReceber)}</span></div>
            <div className="flex flex-col"><span className="text-caption text-muted-foreground">A pagar</span><span className="font-semibold">{formatCurrencyCents(flow.aPagar)}</span></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Período"
            value={kind}
            onChange={setKind}
            options={[
              { value: "tudo", label: "Tudo" },
              { value: "ano", label: "Ano" },
              { value: "mes", label: "Mês" },
            ]}
          />
          {kind === "ano" ? (
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-11 w-28 rounded-full bg-card" aria-label="Ano"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
          {kind === "mes" ? (
            <Select value={monthId} onValueChange={setMonthId}>
              <SelectTrigger className="h-11 w-48 rounded-full bg-card" aria-label="Mês"><SelectValue /></SelectTrigger>
              <SelectContent>{monthIds.map((id) => <SelectItem key={id} value={id}>{formatMonthLabel(id)}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
          <Button variant="outline" size="lg" className="bg-card" onClick={openClosing}>
            <Lock className="size-4" /> Fechar mês
          </Button>
          <Button size="lg" onClick={openQuick}>
            <Plus className="size-4" /> Novo lançamento
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-stretch gap-5">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-4">
          <Card className="flex-row items-center justify-between gap-3 px-5">
            <div className="flex flex-col gap-1">
              <span className="text-caption text-muted-foreground">Entradas</span>
              <span className="font-display text-heading">{formatCurrencyCents(flow.entradas)}</span>
              <Variation percent={prevFlow ? percentChange(flow.entradas, prevFlow.entradas) : undefined} upIsGood />
            </div>
            <Ring percent={margin} label={`Margem de ${Math.round(margin)}% sobre a receita`} />
          </Card>
          <Card className="gap-1 px-5">
            <span className="text-caption text-muted-foreground">Saídas</span>
            <span className="font-display text-heading">{formatCurrencyCents(flow.saidas)}</span>
            <Variation percent={prevFlow ? percentChange(flow.saidas, prevFlow.saidas) : undefined} upIsGood={false} />
          </Card>
          <div className="brand-gradient brand-gradient-animated flex flex-col gap-1 rounded-2xl px-5 py-5">
            <span className="text-caption">Lucro líquido</span>
            <span className="font-display text-heading">{formatCurrencyCents(resultado.lucroLiquido)}</span>
            <span className="text-caption">margem de {Math.round(margin)}% sobre a receita</span>
          </div>
        </div>
        <CashflowChart data={series} className="min-w-0 flex-[3_1_520px]" />
      </div>

      <div className="flex flex-wrap items-stretch gap-5">
        <ResultadoPanel period={period} className="min-w-0 flex-[1_1_320px]" />
        <ExpensesByCategory period={period} className="min-w-0 flex-[1_1_320px]" />
      </div>

      <section aria-labelledby="planejamento" className="flex flex-col gap-3">
        <h2 id="planejamento" className="font-display text-heading-sm">
          Planejamento <span className="font-sans text-body-lg text-muted-foreground">· {formatMonthLabel(resolved.monthId)}</span>
        </h2>
        <PlanningPanel monthId={resolved.monthId} />
      </section>

      <RecurringRulesPanel />

      <section aria-labelledby="transacoes" className="flex flex-col gap-3">
        <h2 id="transacoes" className="font-display text-heading-sm">
          Transações <span className="font-sans text-body-lg text-muted-foreground">· {resolved.label}</span>
        </h2>
        <Card className="px-5">
          <TransactionsPanel period={period} />
        </Card>
      </section>
    </div>
  );
}
