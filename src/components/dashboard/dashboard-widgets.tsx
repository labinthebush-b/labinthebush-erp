"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { Tag, type TagColor } from "@/components/common/tag";
import { useFinance } from "@/lib/finance/finance-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import {
  deriveFinanceNotifications,
  deriveLowStockNotifications,
  deriveMarginNotifications,
} from "@/lib/notifications/business";
import { useStock } from "@/lib/stock/stock-provider";
import { listVariantStocks } from "@/lib/stock/calculations";
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
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-subheading">Últimas vendas</CardTitle>
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
        <CardTitle className="font-display text-subheading">Próximos pagamentos</CardTitle>
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
  const { movements } = useStock();

  // Reuses the exact same derivations shown in the notifications inbox —
  // no separate "alerts" data source.
  const overdueFinance = deriveFinanceNotifications(transactions, todayISO).filter((n) => n.title.includes("atrasada"));
  const lowMargin = deriveMarginNotifications(products, settings.marginThresholdPercent, todayISO);
  const lowStock = deriveLowStockNotifications(
    listVariantStocks(
      products.filter((p) => p.status !== "arquivado"),
      movements,
      settings.lowStockThreshold
    ),
    (id) => products.find((p) => p.id === id)?.name,
    todayISO
  );
  const alerts = [...overdueFinance, ...lowStock, ...lowMargin].slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-subheading">Alertas</CardTitle>
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
