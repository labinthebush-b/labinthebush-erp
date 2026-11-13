"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Link2, Megaphone, RefreshCw, ShoppingBag, UserPlus, Wallet, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { Segmented } from "@/components/common/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useUI } from "@/components/providers/ui-provider";
import { TaskForm } from "@/components/tasks/task-form";
import { ContactForm } from "@/components/contacts/contact-form";
import { SaleForm } from "@/components/sales/sale-form";
import { UtmBuilder } from "@/components/marketing/utm-builder";
import { useSales } from "@/lib/sales/sales-provider";
import { useFinance } from "@/lib/finance/finance-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { resolveStageId } from "@/lib/contacts/pipeline";
import { getSalePaymentStatus, indexTransactionsById } from "@/lib/sales/payment";
import { summarizeSales } from "@/lib/sales/summary";
import { isWithinRange, resolvePeriodRange } from "@/lib/reports/period-range";
import { todayISO } from "@/lib/finance/actions";
import { formatCurrencyCents } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { buildSalesFunnel, deriveFunnelInsights, type FunnelInsight, type FunnelSource, type FunnelStageId } from "@/lib/marketing/funnel";
import type { MarketingPeriodDays, MarketingResponse } from "@/lib/marketing/types";
import { CampaignsSection } from "@/components/marketing/campaigns-section";

const integer = new Intl.NumberFormat("pt-BR");

const STAGE_STYLE: Record<FunnelStageId, { band: string; accent: string; width: string }> = {
  topo: { band: "border-[#ddd6fe] bg-[#f5f3ff]", accent: "text-[#5b21b6]", width: "lg:w-full" },
  meio: { band: "border-[#bfdbfe] bg-[#eff6ff]", accent: "text-[#1e3a8a]", width: "lg:w-[90%]" },
  fundo: { band: "border-[#bbf7d0] bg-[#f0fdf4]", accent: "text-[#166534]", width: "lg:w-[80%]" },
};

const SOURCE_LABEL: Record<FunnelSource, string> = { instagram: "Instagram", site: "Site", erp: "ERP" };

function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function formatRate(rate: number): string {
  if (rate > 0 && rate < 1) return `${rate.toFixed(1)}%`;
  return `${Math.round(rate)}%`;
}

export function MarketingPanel() {
  const [days, setDays] = React.useState<MarketingPeriodDays>("tudo");
  const [data, setData] = React.useState<MarketingResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const { sales } = useSales();
  const { transactions } = useFinance();
  const { getProduct } = useCatalog();
  const { contacts } = useContacts();
  const { settings } = useSettings();
  const { openDrawer, closeDrawer, openModal, closeModal } = useUI();

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/marketing?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "sua sessão expirou — recarregue a página." : `erro ${res.status}.`);
        return (await res.json()) as MarketingResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setFailed(null);
      })
      .catch((error: Error) => {
        if (!cancelled) setFailed(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, reloadKey]);

  const erp = React.useMemo(() => {
    const today = todayISO();
    // "tudo": todas as vendas do ERP, desde a primeira.
    const start = days === "tudo" ? "2000-01-01" : addDaysISO(today, -(days - 1));
    const range = resolvePeriodRange("personalizado", today, { start, end: today });
    const byId = indexTransactionsById(transactions);
    const statusOf = (s: (typeof sales)[number]) => getSalePaymentStatus(s, byId);
    const summary = summarizeSales(sales, statusOf, getProduct, range);
    const paidCount = sales.filter((s) => isWithinRange(s.date, range) && statusOf(s) === "pago").length;
    const openLeads = contacts.filter((c) => {
      const stage = resolveStageId(c, settings.pipelineStages);
      return stage !== "cliente" && stage !== "perdido";
    }).length;
    return {
      openLeads,
      salesCount: summary.count,
      paidCount,
      receivableCount: summary.receivableCount,
      receivableAmount: summary.receivable,
      revenue: summary.revenue,
    };
  }, [days, sales, transactions, getProduct, contacts, settings.pipelineStages]);

  const instagram = data?.instagram.ok ? data.instagram.data : undefined;
  const ga4 = data?.ga4.ok ? data.ga4.data : undefined;
  const funnel = buildSalesFunnel({ instagram, ga4, erp, instagramPartial: days === "tudo" });
  const insights = deriveFunnelInsights({ instagram, ga4, erp });

  const sourceErrors = [data && !data.ga4.ok ? data.ga4.error : null, data && !data.instagram.ok ? data.instagram.error : null].filter(Boolean) as string[];

  function newTask(title: string) {
    openDrawer({ title: "Nova tarefa", description: "Já vem com o título — ajuste e salve.", content: <TaskForm defaultTitle={title} onDone={closeDrawer} /> });
  }
  function newLead() {
    openDrawer({ title: "Novo lead", description: "Quem chamou no Instagram ou WhatsApp — nome e contato bastam.", content: <ContactForm onDone={closeDrawer} /> });
  }
  function newSale() {
    openDrawer({ title: "Nova venda", description: "Registra a receita no Financeiro automaticamente.", content: <SaleForm onDone={closeDrawer} /> });
  }
  function openUtm() {
    openModal({ title: "Gerar link rastreável", description: "Use este link nos posts e mensagens para saber de onde veio cada visita.", content: <UtmBuilder onDone={closeModal} /> });
  }

  function runInsight(insight: FunnelInsight) {
    if (insight.action.kind === "task" && insight.action.taskTitle) newTask(insight.action.taskTitle);
  }

  const stageActions: Record<FunnelStageId, React.ReactNode> = {
    topo: (
      <>
        <Button size="sm" variant="outline" asChild>
          <a href="https://www.instagram.com/labinthebush/" target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" /> Abrir Instagram
          </a>
        </Button>
      </>
    ),
    meio: (
      <>
        <Button size="sm" variant="outline" onClick={openUtm}>
          <Link2 className="size-3.5" /> Gerar link rastreável
        </Button>
        <Button size="sm" variant="outline" onClick={newLead}>
          <UserPlus className="size-3.5" /> Novo lead
        </Button>
      </>
    ),
    fundo: (
      <>
        <Button size="sm" onClick={newSale}>
          <ShoppingBag className="size-3.5" /> Registrar venda
        </Button>
        {erp.receivableCount > 0 ? (
          <Button size="sm" variant="outline" asChild>
            <Link href="/vendas">
              <Wallet className="size-3.5" /> Cobrar {formatCurrencyCents(erp.receivableAmount)}
            </Link>
          </Button>
        ) : null}
      </>
    ),
  };

  const pathMetrics = funnel.flatMap((stage) => stage.metrics.filter((m) => m.inPath).map((m) => ({ ...m, stage: stage.id })));
  const pathMax = Math.max(1, ...pathMetrics.map((m) => m.value ?? 0));
  const parallel = funnel.flatMap((stage) => stage.metrics.filter((m) => !m.inPath).map((m) => ({ ...m, stage: stage.id })));
  const periodLabel = days === "tudo" ? "desde o início" : `nos últimos ${days} dias`;
  const viewItem = ga4?.funnel.find((s) => s.event === "view_item")?.count;
  const purchases = ga4?.funnel.find((s) => s.event === "purchase")?.count;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Marketing"
        description={`Site, Instagram e vendas do ERP — ${periodLabel}.`}
        stats={[
          { value: ga4 ? integer.format(ga4.sessions) : "—", label: "visitas na loja" },
          { value: instagram ? integer.format(instagram.reach) : "—", label: days === "tudo" ? "alcance (30 dias)" : "alcance no Instagram" },
        ]}
        action={
          <>
            <Segmented
              label="Período"
              value={String(days) as "7" | "30" | "tudo"}
              onChange={(value) => {
                setLoading(true);
                setDays(value === "7" ? 7 : value === "tudo" ? "tudo" : 30);
              }}
              options={[
                { value: "tudo", label: "Desde o início" },
                { value: "30", label: "30 dias" },
                { value: "7", label: "7 dias" },
              ]}
            />
            <Button
              variant="outline"
              size="icon-lg"
              className="bg-card"
              aria-label="Atualizar dados"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                setReloadKey((k) => k + 1);
              }}
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </>
        }
      />

      {failed ? <p className="rounded-2xl bg-paper-mist p-3 text-body text-muted-foreground">Não foi possível carregar o marketing: {failed}</p> : null}
      {sourceErrors.map((message) => (
        <p key={message} className="rounded-2xl bg-paper-mist p-3 text-body text-muted-foreground">{message}</p>
      ))}

      <section aria-label="Resumo do período" className="brand-gradient brand-gradient-animated flex flex-wrap items-stretch gap-3 rounded-[28px] p-3">
        {[
          { label: "faturamento no ERP", value: formatCurrencyCents(erp.revenue) },
          { label: erp.salesCount === 1 ? "venda no ERP" : "vendas no ERP", value: integer.format(erp.salesCount) },
          { label: "viram um produto no site", value: viewItem === undefined ? "—" : integer.format(viewItem) },
          { label: "compras vistas pelo site", value: purchases === undefined ? "—" : integer.format(purchases) },
        ].map((stat) => (
          <div key={stat.label} className="flex min-w-40 flex-1 flex-col gap-1 rounded-[22px] bg-white/80 px-5 py-4">
            {loading && stat.value === "—" ? <Skeleton className="h-9 w-20" /> : <span className="font-display text-heading-lg leading-none">{stat.value}</span>}
            <span className="text-body text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="gap-4 px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-subheading">Funil até a compra</h2>
            <span className="text-caption text-muted-foreground">% = quantos passaram da etapa anterior</span>
          </div>
          <ol className="flex flex-col gap-3">
            {pathMetrics.map((metric) => (
              <li key={metric.id} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] items-center gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-body">{metric.label}</span>
                  <span className="text-caption text-muted-foreground">{SOURCE_LABEL[metric.source]} · {metric.stage}</span>
                </div>
                <div className="h-9 rounded-full bg-paper-mist">
                  {metric.value === undefined ? null : (
                    <div
                      className="flex h-9 items-center justify-end rounded-full bg-linear-to-r from-brand-blue to-brand-aqua px-3 text-body font-semibold text-foreground"
                      style={{ width: `${Math.max(8, (metric.value / pathMax) * 100)}%` }}
                    >
                      {integer.format(metric.value)}
                    </div>
                  )}
                </div>
                <span className="text-right text-body font-semibold">
                  {loading && metric.value === undefined ? "…" : metric.rateFromPrevious !== undefined ? formatRate(metric.rateFromPrevious) : "—"}
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            {parallel.map((metric) => (
              <div key={metric.id} className="flex min-w-44 flex-1 flex-col gap-0.5 rounded-2xl border border-dashed border-smoke px-4 py-3">
                <span className="font-display text-heading-sm">{metric.value === undefined ? "—" : integer.format(metric.value)}</span>
                <span className="text-body">{metric.label}</span>
                <span className="text-caption text-muted-foreground">{metric.hint}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {stageActions.topo}
            {stageActions.meio}
            {stageActions.fundo}
          </div>
          <p className="text-caption text-muted-foreground">
            Cada fonte mede pessoas de um jeito (Instagram, Google Analytics e o ERP), então leia como tendência, não como conta exata.
          </p>
        </Card>

        <Card className="h-fit gap-4 px-5">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 font-display text-subheading"><Megaphone className="size-4" /> O que fazer agora</h2>
            <span className="text-caption text-muted-foreground">Os gargalos do funil, com a ação de cada um.</span>
          </div>
          {loading && !data ? (
            <>
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </>
          ) : insights.length === 0 ? (
            <p className="text-body text-muted-foreground">Nenhum gargalo evidente no período.</p>
          ) : (
            insights.map((insight, index) => (
              <div key={insight.id} className={cn("flex flex-col gap-3 rounded-2xl p-4", index === 0 ? "brand-gradient" : "bg-paper-mist")}>
                <div className="flex items-start gap-2">
                  {insight.severity === "atencao" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-tangerine" /> : <Lightbulb className="mt-0.5 size-4 shrink-0 text-electric-blue" />}
                  <div className="flex flex-col gap-0.5">
                    <span className="text-body font-medium">{insight.title}</span>
                    <span className="text-caption">{insight.description}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-[10px] uppercase tracking-wide", STAGE_STYLE[insight.stage].accent)}>{insight.stage}</span>
                  {insight.action.kind === "task" ? (
                    <Button size="sm" variant="outline" className="bg-card" onClick={() => runInsight(insight)}>{insight.action.label}</Button>
                  ) : insight.action.kind === "external" ? (
                    <Button size="sm" variant="outline" className="bg-card" asChild><a href={insight.action.href} target="_blank" rel="noreferrer">{insight.action.label}</a></Button>
                  ) : (
                    <Button size="sm" variant="outline" className="bg-card" asChild><Link href={insight.action.href ?? "/"}>{insight.action.label}</Link></Button>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      <CampaignsSection />
    </div>
  );
}
