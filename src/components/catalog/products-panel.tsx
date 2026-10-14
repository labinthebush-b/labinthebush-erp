"use client";

import * as React from "react";
import { toast } from "sonner";
import { MoreHorizontal, Plus, FlaskConical, Search, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatusBadge, type Status } from "@/components/common/status-badge";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useStock } from "@/lib/stock/stock-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { listVariantStocks, summarizeProductStock } from "@/lib/stock/calculations";
import { StockMovementForm } from "@/components/stock/stock-movement-form";
import { useUI } from "@/components/providers/ui-provider";
import { ProductForm } from "@/components/catalog/product-form";
import { ProductSimulator } from "@/components/catalog/product-simulator";
import { calculateMargin, calculateProductCost } from "@/lib/catalog/calculations";
import { formatCurrencyCents } from "@/lib/currency";
import type { Product, ProductStatus } from "@/lib/catalog/types";

const STATUS_MAP: Record<ProductStatus, Status> = {
  ativo: "concluido",
  rascunho: "rascunho",
  arquivado: "cancelado",
};

export function ProductsPanel() {
  const { products, deleteProduct } = useCatalog();
  const { openDrawer, closeDrawer, confirm } = useUI();
  const { movements } = useStock();
  const { settings } = useSettings();
  const [search, setSearch] = React.useState("");

  const stocks = React.useMemo(
    () => listVariantStocks(products, movements, settings.lowStockThreshold),
    [products, movements, settings.lowStockThreshold]
  );

  const filtered = products.filter((p) =>
    search.trim() ? p.name.toLowerCase().includes(search.trim().toLowerCase()) : true
  );

  function openCreate() {
    openDrawer({
      title: "Novo produto",
      description: "Comece com o essencial — você pode detalhar depois.",
      content: <ProductForm onDone={closeDrawer} />,
    });
  }

  function openEdit(product: Product) {
    openDrawer({
      title: "Editar produto",
      content: <ProductForm product={product} onDone={closeDrawer} />,
    });
  }

  function openSimulate(product: Product) {
    openDrawer({
      title: `Simular — ${product.name}`,
      description: "A simulação nunca altera o produto real, a menos que você aplique.",
      widthClassName: "sm:max-w-lg",
      content: <ProductSimulator product={product} onDone={closeDrawer} />,
    });
  }

  function openStockEntry(product: Product) {
    openDrawer({
      title: `Estoque — ${product.name}`,
      description: "O estoque é a soma das movimentações — nada é digitado direto no saldo.",
      content: <StockMovementForm initial={{ productId: product.id }} onDone={closeDrawer} />,
    });
  }

  function handleDelete(product: Product) {
    confirm({
      title: "Excluir produto?",
      description: `"${product.name}" será removido do catálogo. Vendas já registradas não são afetadas.`,
      onConfirm: () => {
        deleteProduct(product.id);
        toast.success("Produto excluído.");
      },
    });
  }

  const columns: DataTableColumn<Product>[] = [
    {
      key: "name",
      header: "Produto",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          {row.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, arbitrary URL
            <img
              src={row.image}
              alt=""
              className="size-8 shrink-0 rounded-md border border-border object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <span className="text-foreground">{row.name}</span>
        </div>
      ),
    },
    {
      key: "cost",
      header: "Custo",
      align: "right",
      render: (row) => formatCurrencyCents(calculateProductCost(row.costComponents)),
    },
    {
      key: "price",
      header: "Preço",
      align: "right",
      render: (row) => (row.price ? formatCurrencyCents(row.price) : "—"),
    },
    {
      key: "margin",
      header: "Margem",
      align: "right",
      render: (row) => {
        const cost = calculateProductCost(row.costComponents);
        const { marginPercent } = calculateMargin(row.price ?? 0, cost);
        return row.price ? `${marginPercent.toFixed(0)}%` : "—";
      },
    },
    {
      key: "stock",
      header: "Estoque",
      align: "right",
      render: (row) => {
        const summary = summarizeProductStock(stocks, row.id);
        if (!summary) return <span className="text-muted-foreground">Sem controle</span>;
        return (
          <div className="flex flex-col items-end">
            <span className="text-foreground">{summary.units} {summary.units === 1 ? "peça" : "peças"}</span>
            {summary.attentionCount > 0 ? (
              <span className="text-caption text-[#92400e]">
                {summary.attentionCount} {summary.attentionCount === 1 ? "variação em falta" : "variações em falta"}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={STATUS_MAP[row.status]} />,
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
            <DropdownMenuItem onSelect={() => openSimulate(row)}>
              <FlaskConical /> Simular
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openStockEntry(row)}>
              <Boxes /> Movimentar estoque
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto..." className="pl-8" />
        </div>
        <Button className="ml-auto" onClick={openCreate}>
          <Plus className="size-4" />
          Novo produto
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle="Nenhum produto cadastrado"
        emptyDescription="Crie seu primeiro produto — você pode começar só com o nome."
        emptyAction={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Adicionar produto
          </Button>
        }
      />
    </div>
  );
}
