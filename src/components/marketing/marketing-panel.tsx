"use client";

import * as React from "react";
import { Eye, Globe, Heart, Link2, MousePointerClick, RefreshCw, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/common/stat-card";
import { CardSkeleton } from "@/components/common/loading";
import { useSales } from "@/lib/sales/sales-provider";
import { useFinance } from "@/lib/finance/finance-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { getSalePaymentStatus, indexTransactionsById } from "@/lib/sales/payment";
import { summarizeSales } from "@/lib/sales/summary";
import { resolvePeriodRange } from "@/lib/reports/period-range";
import { todayISO } from "@/lib/finance/actions";
import { formatCurrencyCents } from "@/lib/currency";
import type { MarketingPeriodDays, MarketingResponse } from "@/lib/marketing/types";

const integer = new Intl.NumberFormat("pt-BR");

function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function SourceError({ message }: { message: string }) {
  return <p className="rounded-lg bg-paper-mist p-3 text-caption text-muted-foreground">{message}</p>;
}

export function MarketingPanel() {
  const [days, setDays] = React.useState<MarketingPeriodDays>(30);
  const [data, setData] = React.useState<MarketingResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const { sales } = useSales();
  const { transactions } = useFinance();
  const { getProduct } = useCatalog();

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/marketing?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "Sessão expirada — entre de novo." : `Erro ${res.status}`);
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

  function changeDays(next: MarketingPeriodDays) {
    setLoading(true);
    setDays(next);
  }

  // Vendas do ERP no MESMO período, para ler os números do site/Instagram ao lado do que virou venda.
  const erp = React.useMemo(() => {
    const today = todayISO();
    const range = resolvePeriodRange("personalizado", today, { start: addDaysISO(today, -(days - 1)), end: today });
    const byId = indexTransactionsById(transactions);
    return summarizeSales(sales, (s) => getSalePaymentStatus(s, byId), getProduct, range);
  }, [days, sales, transactions, getProduct]);

  const ga4 = data?.ga4;
  const instagram = data?.instagram;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={String(days)} onValueChange={(value) => changeDays(value === "7" ? 7 : 30)}>
          <TabsList>
            <TabsTrigger value="7">Últimos 7 dias</TabsTrigger>
            <TabsTrigger value="30">Últimos 30 dias</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => {
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
          disabled={loading}
        >
          <RefreshCw className="size-3.5" />
          Atualizar
        </Button>
      </div>

      {failed ? <SourceError message={`Não foi possível carregar o marketing: ${failed}`} /> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-body font-medium text-foreground">Vendas do ERP no período</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard label="Vendas" icon={ShoppingBag} value={String(erp.count)} footer={<span className="text-caption text-muted-foreground">registradas no ERP</span>} />
          <StatCard label="Receita" icon={ShoppingBag} value={formatCurrencyCents(erp.revenue)} />
          <StatCard label="Ticket médio" icon={ShoppingBag} value={formatCurrencyCents(erp.averageTicket)} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="size-4" /> Loja (Google Analytics)</CardTitle>
            <CardDescription>Visitas ao site e o caminho até a compra.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading && !data ? (
              <div className="grid grid-cols-2 gap-3"><CardSkeleton /><CardSkeleton /></div>
            ) : ga4 && !ga4.ok ? (
              <SourceError message={ga4.error} />
            ) : ga4 && ga4.ok ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Sessões" icon={MousePointerClick} value={integer.format(ga4.data.sessions)} />
                  <StatCard label="Visitantes" icon={Users} value={integer.format(ga4.data.totalUsers)} />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Funil de compra</span>
                  {ga4.data.funnel.map((step) => {
                    const max = Math.max(1, ...ga4.data.funnel.map((s) => s.count));
                    return (
                      <div key={step.event} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between text-body">
                          <span className="text-foreground">{step.label}</span>
                          <span className="text-foreground">
                            {integer.format(step.count)}
                            {step.rateFromPrevious !== undefined ? (
                              <span className="ml-2 text-caption text-muted-foreground">{step.rateFromPrevious.toFixed(0)}% da etapa anterior</span>
                            ) : null}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-paper-mist">
                          <div className="h-2 rounded-full bg-electric-blue" style={{ width: `${(step.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {ga4.data.funnel.find((s) => s.event === "purchase")?.count === 0 && erp.count > 0 ? (
                    <p className="text-caption text-[#92400e]">
                      O site não registrou nenhuma compra no período, mas o ERP tem {erp.count} {erp.count === 1 ? "venda" : "vendas"}. Se alguma foi pela Nuvemshop, o evento de compra do Google Analytics pode não estar configurado na loja.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Heart className="size-4" /> Instagram</CardTitle>
            <CardDescription>Alcance e engajamento orgânico da conta.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="grid grid-cols-2 gap-3"><CardSkeleton /><CardSkeleton /></div>
            ) : instagram && !instagram.ok ? (
              <SourceError message={instagram.error} />
            ) : instagram && instagram.ok ? (
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Alcance" icon={Users} value={integer.format(instagram.data.reach)} footer={<span className="text-caption text-muted-foreground">contas únicas que viram</span>} />
                <StatCard label="Visualizações" icon={Eye} value={integer.format(instagram.data.views)} />
                <StatCard label="Contas engajadas" icon={Heart} value={integer.format(instagram.data.accountsEngaged)} />
                <StatCard label="Interações" icon={Heart} value={integer.format(instagram.data.totalInteractions)} footer={<span className="text-caption text-muted-foreground">curtidas, comentários, salvos…</span>} />
                <StatCard
                  label="Toques no link da bio"
                  icon={Link2}
                  value={integer.format(instagram.data.profileLinksTaps)}
                  className="col-span-2"
                  footer={
                    instagram.data.profileLinksTaps === 0 ? (
                      <span className="text-caption text-[#92400e]">Nenhum toque — confira se a bio do Instagram tem o link da loja.</span>
                    ) : (
                      <span className="text-caption text-muted-foreground">pessoas que foram do perfil para o link</span>
                    )
                  }
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
