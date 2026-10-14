"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, CalendarPlus, ExternalLink, Link2, Megaphone, RefreshCw, ShoppingBag, UserPlus, Wallet, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { buildSalesFunnel, deriveFunnelInsights, type FunnelInsight, type FunnelSource, type FunnelStage, type FunnelStageId } from "@/lib/marketing/funnel";
import type { MarketingPeriodDays, MarketingResponse } from "@/lib/marketing/types";
import type { MarketingSnapshot } from "@/lib/marketing/assistant";
import { MarketingAssistant } from "@/components/marketing/marketing-assistant";
import { useStock } from "@/lib/stock/stock-provider";
import { listVariantStocks, summarizeProductStock } from "@/lib/stock/calculations";
import { calculateMargin, calculateProductCost } from "@/lib/catalog/calculations";

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

function StageBand({ stage, loading, actions }: { stage: FunnelStage; loading: boolean; actions: React.ReactNode }) {
  const style = STAGE_STYLE[stage.id];
  return (
    <section className={cn("mx-auto flex w-full flex-col gap-3 rounded-2xl border p-4", style.band, style.width)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className={cn("font-display text-body-lg font-medium", style.accent)}>{stage.title}</h2>
          <p className="text-caption text-muted-foreground">{stage.question}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        {stage.metrics.map((metric, index) => (
          <React.Fragment key={metric.id}>
            {metric.inPath && (index > 0 || stage.id !== "topo") ? (
              <div className="hidden flex-col items-center justify-center px-0.5 text-caption text-muted-foreground sm:flex">
                <ArrowRight className="size-3.5" />
                {metric.rateFromPrevious !== undefined ? <span className="font-medium text-foreground">{formatRate(metric.rateFromPrevious)}</span> : null}
              </div>
            ) : null}
            <div
              className={cn(
                "flex min-w-36 flex-1 flex-col gap-1 rounded-xl p-3",
                metric.inPath ? "bg-card shadow-subtle" : "border border-dashed border-border bg-card/60"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption text-muted-foreground">{metric.label}</span>
                <span className="rounded-full bg-paper-mist px-1.5 text-[10px] text-muted-foreground">{SOURCE_LABEL[metric.source]}</span>
              </div>
              {loading && metric.value === undefined ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <span className="font-display text-heading-sm text-foreground">{metric.value === undefined ? "—" : integer.format(metric.value)}</span>
              )}
              {metric.rateFromPrevious !== undefined ? (
                <span className="text-caption text-muted-foreground sm:hidden">{formatRate(metric.rateFromPrevious)} da etapa anterior</span>
              ) : null}
              {metric.hint ? <span className="text-caption text-muted-foreground">{metric.hint}</span> : null}
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function formatRate(rate: number): string {
  if (rate > 0 && rate < 1) return `${rate.toFixed(1)}%`;
  return `${Math.round(rate)}%`;
}

function StageConnector() {
  return (
    <div className="flex justify-center text-muted-foreground" aria-hidden>
      <ArrowDown className="size-4" />
    </div>
  );
}

export function MarketingPanel() {
  const [days, setDays] = React.useState<MarketingPeriodDays>(30);
  const [data, setData] = React.useState<MarketingResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const { sales } = useSales();
  const { transactions } = useFinance();
  const { getProduct, products } = useCatalog();
  const { movements } = useStock();
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
    const range = resolvePeriodRange("personalizado", today, { start: addDaysISO(today, -(days - 1)), end: today });
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
  const funnel = buildSalesFunnel({ instagram, ga4, erp });
  const insights = deriveFunnelInsights({ instagram, ga4, erp });

  // Retrato que vai junto de cada pergunta à IA: os mesmos números da tela,
  // mais o que só o ERP sabe (canais, margem, estoque, o que vendeu).
  const buildSnapshot = (brandNotes: string): MarketingSnapshot => {
    const today = todayISO();
    const range = resolvePeriodRange("personalizado", today, { start: addDaysISO(today, -(days - 1)), end: today });
    const inPeriod = sales.filter((s) => isWithinRange(s.date, range));
    const byChannel = new Map<string, { count: number; revenue: number }>();
    for (const sale of inPeriod) {
      const entry = byChannel.get(sale.channel) ?? { count: 0, revenue: 0 };
      byChannel.set(sale.channel, { count: entry.count + 1, revenue: entry.revenue + sale.totalAmount });
    }
    const stocks = listVariantStocks(products, movements, settings.lowStockThreshold);
    const toBRL = (cents: number) => Math.round(cents) / 100;
    return {
      periodDays: days,
      today,
      funnel: funnel.map((stage) => ({
        stage: stage.title,
        metrics: stage.metrics.map((m) => ({
          label: m.label,
          source: m.source,
          value: m.value ?? null,
          ratePercentFromPrevious: m.rateFromPrevious === undefined ? null : Math.round(m.rateFromPrevious * 10) / 10,
          parallel: !m.inPath,
        })),
      })),
      diagnostics: insights.map((i) => ({ title: i.title, description: i.description })),
      instagram: instagram ?? null,
      sales: {
        count: erp.salesCount,
        revenueBRL: toBRL(erp.revenue),
        averageTicketBRL: erp.salesCount > 0 ? toBRL(erp.revenue / erp.salesCount) : 0,
        receivableCount: erp.receivableCount,
        receivableBRL: toBRL(erp.receivableAmount),
        byChannel: [...byChannel].map(([channel, v]) => ({ channel, count: v.count, revenueBRL: toBRL(v.revenue) })),
      },
      products: products
        .filter((p) => p.status !== "arquivado")
        .slice(0, 40)
        .map((p) => {
          const cost = calculateProductCost(p.costComponents);
          return {
            name: p.name,
            priceBRL: p.price ? toBRL(p.price) : null,
            marginPercent: p.price ? Math.round(calculateMargin(p.price, cost).marginPercent) : null,
            unitsInStock: summarizeProductStock(stocks, p.id)?.units ?? null,
            soldInPeriod: inPeriod.reduce((sum, s) => sum + s.items.filter((i) => i.productId === p.id).reduce((q, i) => q + i.quantity, 0), 0),
          };
        }),
      openLeads: erp.openLeads,
      brandNotes,
    };
  };
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
        <Button size="sm" variant="outline" onClick={() => newTask("Post Instagram: ")}>
          <CalendarPlus className="size-3.5" /> Planejar post
        </Button>
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={String(days)}
          onValueChange={(value) => {
            setLoading(true);
            setDays(value === "7" ? 7 : 30);
          }}
        >
          <TabsList>
            <TabsTrigger value="7">Últimos 7 dias</TabsTrigger>
            <TabsTrigger value="30">Últimos 30 dias</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-caption text-muted-foreground">
          {erp.salesCount} {erp.salesCount === 1 ? "venda" : "vendas"} · {formatCurrencyCents(erp.revenue)} no período
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Atualizar
        </Button>
      </div>

      {failed ? <p className="rounded-lg bg-paper-mist p-3 text-caption text-muted-foreground">Não foi possível carregar o marketing: {failed}</p> : null}
      {sourceErrors.map((message) => (
        <p key={message} className="rounded-lg bg-paper-mist p-3 text-caption text-muted-foreground">{message}</p>
      ))}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-2">
          {funnel.map((stage, index) => (
            <React.Fragment key={stage.id}>
              {index > 0 ? <StageConnector /> : null}
              <StageBand stage={stage} loading={loading} actions={stageActions[stage.id]} />
            </React.Fragment>
          ))}
          <p className="mt-1 text-center text-caption text-muted-foreground">
            As porcentagens seguem o caminho até a compra (alcance → loja → produto → carrinho → checkout → venda → paga). Cartões tracejados são indicadores paralelos. Cada fonte mede pessoas de um jeito, então leia como tendência, não como conta exata.
          </p>
        </div>

        <div className="flex flex-col gap-4">
        <MarketingAssistant buildSnapshot={buildSnapshot} ready={!loading && Boolean(data)} />
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="size-4" /> O que fazer agora</CardTitle>
            <CardDescription>Os gargalos do funil, com a ação de cada um.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading && !data ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : insights.length === 0 ? (
              <p className="text-body text-muted-foreground">Nenhum gargalo evidente no período. 🎯</p>
            ) : (
              insights.map((insight) => (
                <div key={insight.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    {insight.severity === "atencao" ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-tangerine" />
                    ) : (
                      <Lightbulb className="mt-0.5 size-4 shrink-0 text-electric-blue" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-body font-medium text-foreground">{insight.title}</span>
                      <span className="text-caption text-muted-foreground">{insight.description}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-[10px] uppercase tracking-wide", STAGE_STYLE[insight.stage].accent)}>{insight.stage}</span>
                    {insight.action.kind === "task" ? (
                      <Button size="sm" variant="outline" onClick={() => runInsight(insight)}>{insight.action.label}</Button>
                    ) : insight.action.kind === "external" ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={insight.action.href} target="_blank" rel="noreferrer">{insight.action.label}</a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={insight.action.href ?? "/"}>{insight.action.label}</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
