"use client";

import * as React from "react";
import { PageHeader } from "@/components/common/page-header";
import { SalesPanel } from "@/components/sales/sales-panel";
import { ChannelBreakdown, RevenueChart, SalesGoalCard } from "@/components/sales/sales-overview";
import { Card } from "@/components/ui/card";
import { useSales } from "@/lib/sales/sales-provider";
import { useFinance } from "@/lib/finance/finance-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { usePlanning } from "@/lib/planning/planning-provider";
import { getSalePaymentStatus, indexTransactionsById } from "@/lib/sales/payment";
import { summarizeSales } from "@/lib/sales/summary";
import { SALES_GOAL_CATEGORY_ID, buildMonthlyRevenue } from "@/lib/sales/goal";
import { isWithinRange, resolvePeriodRange } from "@/lib/reports/period-range";
import { todayISO } from "@/lib/finance/actions";
import { formatCurrencyCents, formatSignedCurrencyCents } from "@/lib/currency";
import type { SalesChannel } from "@/lib/sales/types";

const CHANNELS: SalesChannel[] = ["nuvemshop", "instagram", "whatsapp", "outro"];

export default function VendasPage() {
  const { sales } = useSales();
  const { transactions } = useFinance();
  const { getProduct } = useCatalog();
  const { getBudget } = usePlanning();
  const today = todayISO();
  const monthRange = resolvePeriodRange("mes", today);

  const byId = React.useMemo(() => indexTransactionsById(transactions), [transactions]);
  const statusOf = React.useCallback((s: (typeof sales)[number]) => getSalePaymentStatus(s, byId), [byId]);
  const month = summarizeSales(sales, statusOf, getProduct, monthRange);
  const revenueSeries = buildMonthlyRevenue(sales, statusOf, today);
  const goalBudget = getBudget(SALES_GOAL_CATEGORY_ID);
  const goal = goalBudget?.kind === "valor" ? goalBudget.value : 0;

  const channelRows = CHANNELS.map((channel) => {
    const inMonth = sales.filter((s) => {
      const st = statusOf(s);
      return s.channel === channel && (st === "pago" || st === "pendente") && isWithinRange(s.date, monthRange);
    });
    return { channel, revenue: inMonth.reduce((a, s) => a + s.totalAmount, 0), count: inMonth.length };
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Vendas"
        description="Pedidos da Nuvemshop, Instagram e WhatsApp — este mês."
        stats={[
          { value: String(month.count), label: month.count === 1 ? "venda" : "vendas" },
          { value: formatCurrencyCents(month.averageTicket), label: "ticket médio" },
        ]}
      />

      <div className="flex flex-wrap items-stretch gap-5">
        <SalesGoalCard revenue={month.revenue} monthId={today.slice(0, 7)} todayISO={today} className="min-w-0 flex-[1_1_340px]" />
        <RevenueChart data={revenueSeries} goal={goal} className="min-w-0 flex-[2_1_480px]" />
      </div>

      <div className="flex flex-wrap items-stretch gap-5">
        <Card className="min-w-0 flex-[1_1_240px] gap-1 px-5">
          <span className="text-caption text-muted-foreground">A receber</span>
          <span className="font-display text-heading">{formatCurrencyCents(month.receivable)}</span>
          <span className="text-caption text-muted-foreground">
            {month.receivableCount === 0 ? "Nenhuma venda esperando pagamento" : `${month.receivableCount} ${month.receivableCount === 1 ? "venda esperando" : "vendas esperando"} pagamento, de qualquer mês`}
          </span>
        </Card>
        <Card className="min-w-0 flex-[1_1_240px] gap-1 px-5">
          <span className="text-caption text-muted-foreground">Lucro estimado do mês</span>
          <span className="font-display text-heading">{formatSignedCurrencyCents(month.profit)}</span>
          <span className="text-caption text-muted-foreground">receita − custo dos produtos</span>
        </Card>
        <ChannelBreakdown rows={channelRows} className="min-w-0 flex-[2_1_360px]" />
      </div>

      <section aria-labelledby="lista-vendas" className="flex flex-col gap-3">
        <h2 id="lista-vendas" className="font-display text-heading-sm">Todas as vendas</h2>
        <Card className="px-5">
          <SalesPanel />
        </Card>
      </section>
    </div>
  );
}
