"use client";

import * as React from "react";
import { Segmented } from "@/components/common/segmented";
import { useSettings } from "@/lib/settings/settings-provider";
import { DASHBOARD_WIDGETS } from "@/lib/settings/types";
import { DashboardPriorityTasksCard } from "@/components/dashboard/dashboard-tasks-summary";
import { RecentSalesCard, UpcomingPaymentsCard, AlertsCard } from "@/components/dashboard/dashboard-widgets";
import {
  CaixaCard,
  CollectionHero,
  NextActionCard,
  RecentActivityCard,
  TodayStrip,
  TopProductCard,
  type TodayItem,
} from "@/components/dashboard/dashboard-overview";
import { useFinance } from "@/lib/finance/finance-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useTasks } from "@/lib/tasks/tasks-provider";
import { useMarketing } from "@/lib/marketing/use-marketing";
import { todayISO } from "@/lib/finance/actions";
import { calculateCaixa } from "@/lib/finance/calculations";
import { buildCashflowSeries } from "@/lib/finance/overview";
import { getSalePaymentStatus, indexTransactionsById } from "@/lib/sales/payment";
import { summarizeSales } from "@/lib/sales/summary";
import { buildProductsReport } from "@/lib/reports/products-report";
import { resolveStageId } from "@/lib/contacts/pipeline";
import { getTasksForDate, isOverdue } from "@/lib/tasks/filters";
import { pickNextAction } from "@/lib/dashboard/next-action";
import { formatCurrencyCents } from "@/lib/currency";
import type { PeriodRange } from "@/lib/reports/period-range";

type Choice = "tudo" | "30" | "7";

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

const WEEKDAY = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });

export default function DashboardPage() {
  const { settings } = useSettings();
  const { transactions } = useFinance();
  const { sales } = useSales();
  const { products, getProduct } = useCatalog();
  const { contacts } = useContacts();
  const { tasks } = useTasks();
  // Períodos que o Google Analytics também sabe responder — assim "visitas" bate com o resto.
  const [choice, setChoice] = React.useState<Choice>("tudo");
  const marketing = useMarketing(choice === "tudo" ? "tudo" : choice === "30" ? 30 : 7);

  const today = todayISO();
  const range: PeriodRange =
    choice === "tudo"
      ? { start: "2000-01-01", end: today, label: "Desde o início" }
      : { start: addDaysISO(today, -(Number(choice) - 1)), end: today, label: `Últimos ${choice} dias` };

  const isHidden = (id: string) => settings.hiddenDashboardWidgets.includes(id);

  const byId = React.useMemo(() => indexTransactionsById(transactions), [transactions]);
  const statusOf = React.useCallback((s: (typeof sales)[number]) => getSalePaymentStatus(s, byId), [byId]);
  const summary = summarizeSales(sales, statusOf, getProduct, range);
  const top = buildProductsReport(sales.filter((s) => statusOf(s) === "pago" || statusOf(s) === "pendente"), products, range)[0];
  const topProduct = top ? getProduct(top.productId) : undefined;

  const caixa = calculateCaixa(transactions);
  const caixaSeries = buildCashflowSeries(transactions, { kind: "tudo" }, today);

  const pendingOut = transactions.filter(
    (t) => t.status === "pendente" && (t.type === "expense" || t.type === "owner_withdrawal")
  );
  const dueOf = (t: (typeof transactions)[number]) => t.dueDate ?? t.date;
  const overduePayables = pendingOut.filter((t) => dueOf(t) < today);
  const dueToday = pendingOut.filter((t) => dueOf(t) === today);
  const tasksToday = getTasksForDate(tasks, today).filter((t) => t.status !== "concluido");
  const overdueTasks = tasks.filter((t) => isOverdue(t, today));
  const openLeads = contacts.filter((c) => {
    const stage = resolveStageId(c, settings.pipelineStages);
    return stage !== "cliente" && stage !== "perdido";
  }).length;

  const todayItems: TodayItem[] = [
    ...tasksToday.slice(0, 2).map((t) => ({ id: `task-${t.id}`, strong: "Tarefa", text: t.title, href: "/tarefas" })),
    ...(tasksToday.length > 2 ? [{ id: "tasks-more", strong: `+${tasksToday.length - 2}`, text: "tarefas hoje", href: "/tarefas" }] : []),
    ...(dueToday.length > 0
      ? [{ id: "due", strong: "Vence hoje", text: `${dueToday.length === 1 ? dueToday[0].description : `${dueToday.length} contas`} · ${formatCurrencyCents(dueToday.reduce((a, t) => a + t.amount, 0))}`, href: "/financeiro" }]
      : []),
    ...(overduePayables.length > 0
      ? [{ id: "late", strong: "Atrasado", text: `${overduePayables.length} ${overduePayables.length === 1 ? "conta" : "contas"} a pagar`, href: "/financeiro" }]
      : []),
    ...(summary.receivableCount > 0
      ? [{ id: "recv", strong: "A receber", text: formatCurrencyCents(summary.receivable), href: "/vendas" }]
      : []),
  ];

  const nextAction = pickNextAction({
    overduePayablesCount: overduePayables.length,
    overduePayablesAmount: overduePayables.reduce((a, t) => a + t.amount, 0),
    receivableCount: summary.receivableCount,
    receivableAmount: summary.receivable,
    overdueTasksCount: overdueTasks.length,
    openLeads,
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-body text-muted-foreground first-letter:uppercase">
            {greeting()} · {WEEKDAY.format(new Date())}
          </span>
          <h1 className="font-display text-display">Visão geral da marca</h1>
        </div>
        <Segmented
          label="Período"
          value={choice}
          onChange={setChoice}
          options={[
            { value: "tudo", label: "Desde o início" },
            { value: "30", label: "30 dias" },
            { value: "7", label: "7 dias" },
          ]}
        />
      </header>

      <TodayStrip items={todayItems} />

      <div className="flex flex-wrap items-stretch gap-5">
        <div className="min-w-0 flex-[2_1_520px]">
          <CollectionHero revenue={summary.revenue} salesCount={summary.count} profit={summary.profit} visits={marketing.ga4?.sessions} />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          {!isHidden("fluxo-caixa") ? <CaixaCard caixa={caixa} series={caixaSeries} /> : null}
          {!isHidden("tendencia-vendas") && top ? (
            <TopProductCard name={top.nome} image={topProduct?.image} quantity={top.quantidadeVendida} revenue={top.faturamento} />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {!isHidden("proxima-acao") ? <NextActionCard action={nextAction} /> : null}
        {!isHidden("ultimas-vendas") ? <RecentSalesCard /> : null}
        {!isHidden("atividades") ? <RecentActivityCard /> : null}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {!isHidden("proximos-pagamentos") ? <UpcomingPaymentsCard /> : null}
        {!isHidden("tarefas-prioritarias") ? <DashboardPriorityTasksCard /> : null}
        {!isHidden("alertas") ? <AlertsCard todayISO={today} /> : null}
      </div>

      {DASHBOARD_WIDGETS.every((w) => isHidden(w.id)) ? (
        <p className="text-center text-body text-muted-foreground">Todos os widgets estão ocultos. Reative-os em Configurações.</p>
      ) : null}
    </div>
  );
}
