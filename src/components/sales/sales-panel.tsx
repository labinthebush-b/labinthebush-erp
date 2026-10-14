"use client";

import * as React from "react";
import { toast } from "sonner";
import { Clock, MoreHorizontal, Plus, Receipt, Search, ShoppingBag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatCard } from "@/components/common/stat-card";
import { Tag } from "@/components/common/tag";
import { useSales } from "@/lib/sales/sales-provider";
import { useFinance } from "@/lib/finance/finance-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useUI } from "@/components/providers/ui-provider";
import { SaleForm } from "@/components/sales/sale-form";
import { SaleDetail } from "@/components/sales/sale-detail";
import { CHANNEL_LABELS, CHANNEL_TAG_COLOR, PAYMENT_TAG_COLOR } from "@/components/sales/sale-labels";
import { calculateSaleProfit } from "@/lib/sales/calculations";
import { PAYMENT_LABELS, getSalePaymentStatus, indexTransactionsById, type SalePaymentStatus } from "@/lib/sales/payment";
import { summarizeSales } from "@/lib/sales/summary";
import { percentChange, previousPeriodRange, resolvePeriodRange } from "@/lib/reports/period-range";
import { todayISO } from "@/lib/finance/actions";
import { formatCurrencyCents, formatSignedCurrencyCents } from "@/lib/currency";
import type { DiscountKind, Sale } from "@/lib/sales/types";

const DISCOUNT_KIND_SHORT_LABEL: Record<DiscountKind, string> = {
  percentual: "% desconto",
  valor_fixo: "desconto fixo",
  frete_gratis: "frete grátis",
};

type PaymentFilter = "todas" | "a_receber" | "pagas";

function matchesFilter(status: SalePaymentStatus, filter: PaymentFilter): boolean {
  if (filter === "a_receber") return status === "pendente";
  if (filter === "pagas") return status === "pago";
  return true;
}

export function SalesPanel() {
  const { sales, deleteSale, setSalePayment } = useSales();
  const { transactions } = useFinance();
  const { getProduct } = useCatalog();
  const { getContact } = useContacts();
  const { openDrawer, closeDrawer, confirm } = useUI();
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<PaymentFilter>("todas");

  const transactionsById = React.useMemo(() => indexTransactionsById(transactions), [transactions]);
  const statusOf = React.useCallback((sale: Sale) => getSalePaymentStatus(sale, transactionsById), [transactionsById]);

  const summary = React.useMemo(() => {
    const range = resolvePeriodRange("mes", todayISO());
    const current = summarizeSales(sales, statusOf, getProduct, range);
    const previous = summarizeSales(sales, statusOf, getProduct, previousPeriodRange(range));
    const trend = percentChange(current.revenue, previous.revenue);
    return { current, revenueTrend: trend === undefined ? undefined : Math.round(trend) };
  }, [sales, statusOf, getProduct]);

  const counts = React.useMemo(
    () => ({
      todas: sales.length,
      a_receber: sales.filter((s) => statusOf(s) === "pendente").length,
      pagas: sales.filter((s) => statusOf(s) === "pago").length,
    }),
    [sales, statusOf]
  );

  const sorted = [...sales].sort((a, b) => (a.date < b.date ? 1 : -1));
  const filtered = sorted.filter((s) => {
    if (!matchesFilter(statusOf(s), filter)) return false;
    if (!search.trim()) return true;
    const productNames = s.items.map((item) => getProduct(item.productId)?.name ?? "").join(" ");
    const contact = s.contactId ? getContact(s.contactId)?.name ?? "" : "";
    const term = search.trim().toLowerCase();
    return productNames.toLowerCase().includes(term) || contact.toLowerCase().includes(term);
  });

  function openCreate() {
    openDrawer({
      title: "Nova venda",
      description: "Registra a receita no Financeiro automaticamente.",
      content: <SaleForm onDone={closeDrawer} />,
    });
  }

  function openEdit(sale: Sale) {
    openDrawer({
      title: "Editar venda",
      description: "Alterações são refletidas nos lançamentos do Financeiro — nada é duplicado.",
      content: <SaleForm sale={sale} onDone={closeDrawer} />,
    });
  }

  function openDetail(sale: Sale) {
    openDrawer({
      title: "Detalhes da venda",
      description: "Itens, valores e resultado desta venda.",
      content: <SaleDetail saleId={sale.id} onEdit={openEdit} />,
      widthClassName: "sm:max-w-lg",
    });
  }

  function handleTogglePayment(sale: Sale, status: SalePaymentStatus) {
    const next = status === "pago" ? "pendente" : "pago";
    setSalePayment(sale.id, next);
    toast.success(next === "pago" ? "Venda marcada como paga — o valor entrou no caixa." : "Venda voltou para “a receber”.");
  }

  function handleDelete(sale: Sale) {
    confirm({
      title: "Excluir venda?",
      description:
        sale.shippingTransactionId || sale.nuvemshopFeeTransactionId
          ? "A venda e os lançamentos correspondentes no Financeiro (receita, frete e/ou taxa do canal) serão removidos. Essa ação não pode ser desfeita."
          : "A venda e o lançamento de receita correspondente no Financeiro serão removidos. Essa ação não pode ser desfeita.",
      onConfirm: () => {
        deleteSale(sale.id);
        toast.success("Venda excluída — os lançamentos financeiros correspondentes também foram removidos.");
      },
    });
  }

  const columns: DataTableColumn<Sale>[] = [
    { key: "date", header: "Data", render: (row) => new Date(row.date + "T00:00:00").toLocaleDateString("pt-BR") },
    {
      key: "items",
      header: "Itens",
      render: (row) => {
        const names = row.items.map((item) => getProduct(item.productId)?.name ?? "Produto removido");
        const quantity = row.items.reduce((sum, item) => sum + item.quantity, 0);
        return (
          <div className="flex max-w-[16rem] flex-col">
            <span className="truncate text-foreground" title={names.join(", ")}>
              {names.join(", ") || "—"}
            </span>
            <span className="text-caption text-muted-foreground">
              {quantity} {quantity === 1 ? "peça" : "peças"}
              {row.items.length > 1 ? ` · ${row.items.length} produtos` : ""}
            </span>
          </div>
        );
      },
    },
    { key: "contact", header: "Cliente", render: (row) => (row.contactId ? getContact(row.contactId)?.name ?? "—" : "—") },
    { key: "channel", header: "Canal", render: (row) => <Tag color={CHANNEL_TAG_COLOR[row.channel]}>{CHANNEL_LABELS[row.channel]}</Tag> },
    {
      key: "payment",
      header: "Pagamento",
      render: (row) => {
        const status = statusOf(row);
        return <Tag color={PAYMENT_TAG_COLOR[status]}>{PAYMENT_LABELS[status]}</Tag>;
      },
    },
    {
      key: "total",
      header: "Valor",
      align: "right",
      render: (row) => (
        <div className="flex flex-col items-end">
          <span>{formatCurrencyCents(row.totalAmount)}</span>
          {row.discounts.length > 0 ? (
            <span className="text-caption text-muted-foreground">
              {row.discounts.map((d) => DISCOUNT_KIND_SHORT_LABEL[d.kind] + (d.code ? ` · ${d.code}` : "")).join(" + ")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "profit",
      header: "Lucro estimado",
      align: "right",
      render: (row) => {
        const profit = calculateSaleProfit(row, getProduct);
        return <span className={profit >= 0 ? "text-vivid-green" : "text-destructive"}>{formatSignedCurrencyCents(profit)}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => {
        const status = statusOf(row);
        const canTogglePayment = status === "pago" || status === "pendente";
        return (
          // Os controles da célula nunca devem abrir o detalhe da linha.
          <div onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Ações">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openDetail(row)}>Ver detalhes</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openEdit(row)}>Editar</DropdownMenuItem>
                {canTogglePayment ? (
                  <DropdownMenuItem onSelect={() => handleTogglePayment(row, status)}>
                    {status === "pago" ? "Voltar para “a receber”" : "Marcar como paga"}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(row)}>
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const { current, revenueTrend } = summary;
  const hasActiveFilter = filter !== "todas" || search.trim() !== "";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Receita do mês"
          icon={TrendingUp}
          value={formatCurrencyCents(current.revenue)}
          trend={revenueTrend}
          footer={<span className="text-caption text-muted-foreground">{current.count} {current.count === 1 ? "venda" : "vendas"} neste mês</span>}
        />
        <StatCard
          label="A receber"
          icon={Clock}
          value={formatCurrencyCents(current.receivable)}
          footer={
            <span className="text-caption text-muted-foreground">
              {current.receivableCount === 0
                ? "Nenhuma venda pendente"
                : `${current.receivableCount} ${current.receivableCount === 1 ? "venda pendente" : "vendas pendentes"}`}
            </span>
          }
        />
        <StatCard
          label="Ticket médio"
          icon={Receipt}
          value={formatCurrencyCents(current.averageTicket)}
          footer={<span className="text-caption text-muted-foreground">por venda, neste mês</span>}
        />
        <StatCard
          label="Lucro estimado"
          icon={ShoppingBag}
          value={formatSignedCurrencyCents(current.profit)}
          footer={<span className="text-caption text-muted-foreground">receita − custo dos produtos</span>}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as PaymentFilter)}>
            <TabsList>
              <TabsTrigger value="todas">Todas ({counts.todas})</TabsTrigger>
              <TabsTrigger value="a_receber">A receber ({counts.a_receber})</TabsTrigger>
              <TabsTrigger value="pagas">Pagas ({counts.pagas})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-48 max-w-xs flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por produto ou cliente..." className="pl-8" />
          </div>
          <Button className="ml-auto" onClick={openCreate}>
            <Plus className="size-4" />
            Nova venda
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={openDetail}
          emptyTitle={hasActiveFilter ? "Nenhuma venda encontrada" : "Nenhuma venda registrada"}
          emptyDescription={
            hasActiveFilter
              ? "Ajuste a busca ou o filtro de pagamento para ver outras vendas."
              : "Registre sua primeira venda — a receita entra no Financeiro automaticamente."
          }
          emptyAction={
            hasActiveFilter ? undefined : (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Registrar venda
              </Button>
            )
          }
        />
      </div>
    </div>
  );
}
