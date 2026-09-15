"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Sparkline } from "@/components/common/chart-placeholder";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { Tag, type TagColor } from "@/components/common/tag";
import { useFinance } from "@/lib/finance/finance-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { buildWeeklyCashFlowSeries, buildSalesTrendSeries } from "@/lib/dashboard/calculations";
import {
  deriveFinanceNotifications,
  deriveMarginNotifications,
} from "@/lib/notifications/business";
import { formatCurrencyCents } from "@/lib/currency";
import { describeSaleItems } from "@/lib/sales/calculations";
import type { Sale, SalesChannel } from "@/lib/sales/types";
import type { Transaction } from "@/lib/finance/types";

const CHANNEL_TAG_COLOR: Record<SalesChannel, TagColor> = {
  nuvemshop: "blue",
  instagram: "violet",
  whatsapp: "green",
  outro: "neutral",
};

const CHANNEL_LABELS: Record<SalesChannel, string> = {
  nuvemshop: "Nuvemshop",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  outro: "Outro",
};

export function WeeklyCashFlowCard({ todayISO }: { todayISO: string }) {
  const { transactions } = useFinance();
  const series = buildWeeklyCashFlowSeries(transactions, todayISO);
  const hasData = series.some((d) => d.value > 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Fluxo de caixa da semana</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <BarChart data={series} />
        ) : (
          <EmptyState
            title="Sem entradas nos últimos 7 dias"
            description="Assim que houver receitas ou aportes confirmados, eles aparecem aqui."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function SalesTrendCard({ todayISO }: { todayISO: string }) {
  const { sales } = useSales();
  const series = buildSalesTrendSeries(sales, todayISO);
  const hasData = series.some((v) => v > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendência de vendas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hasData ? (
          <>
            <Sparkline data={series} className="h-16 w-full" />
            <p className="text-caption text-muted-foreground">Últimos 10 dias</p>
          </>
        ) : (
          <p className="text-body text-muted-foreground">Nenhuma venda registrada nos últimos 10 dias.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentSalesCard() {
  const { sales } = useSales();
  const { products } = useCatalog();
  const { contacts } = useContacts();

  const recent = [...sales].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  const columns: DataTableColumn<Sale>[] = [
    { key: "cliente", header: "Cliente", render: (row) => (row.contactId ? contacts.find((c) => c.id === row.contactId)?.name ?? "—" : "—") },
    { key: "produto", header: "Produto", render: (row) => describeSaleItems(row.items, (id) => products.find((p) => p.id === id)?.name) },
    { key: "canal", header: "Canal", render: (row) => <Tag color={CHANNEL_TAG_COLOR[row.channel]}>{CHANNEL_LABELS[row.channel]}</Tag> },
    { key: "valor", header: "Valor", align: "right", render: (row) => formatCurrencyCents(row.totalAmount) },
    { key: "data", header: "Data", align: "right", render: (row) => new Date(row.date + "T00:00:00").toLocaleDateString("pt-BR") },
  ];

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Últimas vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={recent}
          emptyTitle="Nenhuma venda registrada ainda"
          emptyDescription="Registre sua primeira venda para vê-la aqui."
        />
      </CardContent>
    </Card>
  );
}

export function UpcomingPaymentsCard() {
  const { transactions } = useFinance();
  const upcoming = transactions
    .filter((t) => t.type === "expense" && t.status === "pendente" && t.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 5);

  const columns: DataTableColumn<Transaction>[] = [
    { key: "descricao", header: "Descrição", render: (row) => row.description },
    { key: "vencimento", header: "Vencimento", render: (row) => new Date(row.dueDate! + "T00:00:00").toLocaleDateString("pt-BR") },
    { key: "valor", header: "Valor", align: "right", render: (row) => formatCurrencyCents(row.amount) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos pagamentos</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={upcoming}
          emptyTitle="Nada a pagar no momento"
          emptyDescription="Contas a pagar pendentes aparecem aqui."
        />
      </CardContent>
    </Card>
  );
}

export function AlertsCard({ todayISO }: { todayISO: string }) {
  const { transactions } = useFinance();
  const { products } = useCatalog();
  const { settings } = useSettings();

  // Reuses the exact same derivations shown in the notifications inbox —
  // no separate "alerts" data source.
  const overdueFinance = deriveFinanceNotifications(transactions, todayISO).filter((n) => n.title.includes("atrasada"));
  const lowMargin = deriveMarginNotifications(products, settings.marginThresholdPercent, todayISO);
  const alerts = [...overdueFinance, ...lowMargin].slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {alerts.length === 0 ? (
          <EmptyState className="border-0 py-6" title="Nenhum alerta" description="Está tudo em dia." />
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="flex gap-2.5 rounded-lg bg-paper-mist p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-tangerine" />
              <div>
                <p className="text-body font-medium text-foreground">{alert.title}</p>
                <p className="text-caption text-muted-foreground">{alert.description}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
