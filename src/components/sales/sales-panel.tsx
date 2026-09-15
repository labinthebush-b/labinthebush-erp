"use client";

import * as React from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { Tag, type TagColor } from "@/components/common/tag";
import { useSales } from "@/lib/sales/sales-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useUI } from "@/components/providers/ui-provider";
import { SaleForm } from "@/components/sales/sale-form";
import { calculateSaleProfit, describeSaleItems } from "@/lib/sales/calculations";
import { formatCurrencyCents, formatSignedCurrencyCents } from "@/lib/currency";
import type { DiscountKind, Sale, SalesChannel } from "@/lib/sales/types";

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

const DISCOUNT_KIND_SHORT_LABEL: Record<DiscountKind, string> = {
  percentual: "% desconto",
  valor_fixo: "desconto fixo",
  frete_gratis: "frete grátis",
};

export function SalesPanel() {
  const { sales, deleteSale } = useSales();
  const { getProduct } = useCatalog();
  const { getContact } = useContacts();
  const { openDrawer, closeDrawer, confirm } = useUI();
  const [search, setSearch] = React.useState("");

  const sorted = [...sales].sort((a, b) => (a.date < b.date ? 1 : -1));
  const filtered = sorted.filter((s) => {
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
    { key: "product", header: "Produto", render: (row) => describeSaleItems(row.items, (id) => getProduct(id)?.name) },
    { key: "contact", header: "Cliente", render: (row) => (row.contactId ? getContact(row.contactId)?.name ?? "—" : "—") },
    { key: "quantity", header: "Qtd", align: "right", render: (row) => row.items.reduce((sum, item) => sum + item.quantity, 0) },
    { key: "channel", header: "Canal", render: (row) => <Tag color={CHANNEL_TAG_COLOR[row.channel]}>{CHANNEL_LABELS[row.channel]}</Tag> },
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
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Ações">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openEdit(row)}>Editar</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(row)}>
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
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
        emptyTitle="Nenhuma venda registrada"
        emptyDescription="Registre sua primeira venda — a receita entra no Financeiro automaticamente."
        emptyAction={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Registrar venda
          </Button>
        }
      />
    </div>
  );
}
