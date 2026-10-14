"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Boxes, MoreHorizontal, PackageX, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { StatCard } from "@/components/common/stat-card";
import { Tag } from "@/components/common/tag";
import { EmptyState } from "@/components/common/empty-state";
import { StockMovementForm, type MovementFormKind } from "@/components/stock/stock-movement-form";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useStock } from "@/lib/stock/stock-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { useUI } from "@/components/providers/ui-provider";
import { listVariantStocks, summarizeStock, variantKey, variantLabel, type VariantStock } from "@/lib/stock/calculations";
import { calculateProductCost } from "@/lib/catalog/calculations";
import { formatCurrencyCents } from "@/lib/currency";
import type { StockLevelStatus, StockMovement, VariantRef } from "@/lib/stock/types";

type StatusFilter = "todos" | "baixo" | "esgotado";
/** DataTable identifica cada linha por `id`; a variação não tem um, então usamos a chave dela. */
type StockRow = VariantStock & { id: string };

const STATUS_LABEL: Record<StockLevelStatus, string> = { ok: "Em estoque", baixo: "Estoque baixo", esgotado: "Esgotado" };
const KIND_LABEL: Record<StockMovement["kind"], string> = { entrada: "Entrada", saida: "Saída", ajuste: "Contagem" };

function StatusTag({ status }: { status: StockLevelStatus }) {
  if (status === "ok") return <Tag color="green">{STATUS_LABEL.ok}</Tag>;
  if (status === "baixo") return <Tag color="orange">{STATUS_LABEL.baixo}</Tag>;
  return <Tag className="bg-[#fee2e2] text-[#991b1b]">{STATUS_LABEL.esgotado}</Tag>;
}

export function StockPanel() {
  const { products, getProduct } = useCatalog();
  const { movements, isTracked, deleteMovement } = useStock();
  const { settings } = useSettings();
  const { openDrawer, closeDrawer, confirm } = useUI();
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<StatusFilter>("todos");

  const activeProducts = React.useMemo(() => products.filter((p) => p.status !== "arquivado"), [products]);

  const stocks = React.useMemo(
    () => listVariantStocks(activeProducts, movements, settings.lowStockThreshold),
    [activeProducts, movements, settings.lowStockThreshold]
  );
  const totals = React.useMemo(
    () => summarizeStock(stocks, (productId) => calculateProductCost(getProduct(productId)?.costComponents ?? [])),
    [stocks, getProduct]
  );
  const untracked = activeProducts.filter((p) => !isTracked(p.id));

  const rows = stocks
    .filter((row) => (filter === "todos" ? true : row.status === filter))
    .filter((row) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (getProduct(row.variant.productId)?.name ?? "").toLowerCase().includes(term) || variantLabel(row.variant).toLowerCase().includes(term);
    })
    .sort((a, b) => {
      const byName = (getProduct(a.variant.productId)?.name ?? "").localeCompare(getProduct(b.variant.productId)?.name ?? "", "pt-BR");
      return byName !== 0 ? byName : variantLabel(a.variant).localeCompare(variantLabel(b.variant), "pt-BR");
    });

  const history = [...movements]
    .filter((m) => getProduct(m.productId))
    .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1))
    .slice(0, 30);

  function openMovement(kind: MovementFormKind, initial?: Partial<VariantRef>) {
    openDrawer({
      title: kind === "entrada" ? "Registrar entrada" : kind === "saida" ? "Registrar saída" : "Contagem real",
      description: "O estoque é a soma das movimentações — nada é digitado direto no saldo.",
      content: <StockMovementForm initial={initial} defaultKind={kind} onDone={closeDrawer} />,
    });
  }

  function handleDelete(movement: StockMovement) {
    confirm({
      title: "Excluir movimentação?",
      description: "O saldo desta variação será recalculado sem esta movimentação. Essa ação não pode ser desfeita.",
      onConfirm: () => {
        deleteMovement(movement.id);
        toast.success("Movimentação excluída.");
      },
    });
  }

  const columns: DataTableColumn<StockRow>[] = [
    { key: "product", header: "Produto", render: (row) => <span className="text-foreground">{getProduct(row.variant.productId)?.name ?? "—"}</span> },
    {
      key: "variant",
      header: "Variação",
      render: (row) => (
        <span>
          {variantLabel(row.variant)}
          {row.undeclared ? <span className="ml-1.5 text-caption text-muted-foreground">(não consta mais no produto)</span> : null}
        </span>
      ),
    },
    {
      key: "level",
      header: "Estoque",
      align: "right",
      render: (row) => <span className={row.level <= 0 ? "text-destructive" : "text-foreground"}>{row.level}</span>,
    },
    { key: "status", header: "Situação", render: (row) => <StatusTag status={row.status} /> },
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
            <DropdownMenuItem onSelect={() => openMovement("entrada", row.variant)}>Registrar entrada</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openMovement("saida", row.variant)}>Registrar saída</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openMovement("ajuste", row.variant)}>Contagem real</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const historyColumns: DataTableColumn<StockMovement>[] = [
    { key: "date", header: "Data", render: (row) => new Date(row.date + "T00:00:00").toLocaleDateString("pt-BR") },
    { key: "product", header: "Produto", render: (row) => `${getProduct(row.productId)?.name ?? "—"} · ${variantLabel(row)}` },
    { key: "kind", header: "Tipo", render: (row) => KIND_LABEL[row.kind] },
    {
      key: "quantity",
      header: "Qtd",
      align: "right",
      render: (row) => <span className={row.quantity > 0 ? "text-vivid-green" : "text-destructive"}>{row.quantity > 0 ? `+${row.quantity}` : row.quantity}</span>,
    },
    {
      key: "origin",
      header: "Origem",
      render: (row) =>
        row.saleId ? (
          <Link href="/vendas" className="text-electric-blue hover:underline">Venda</Link>
        ) : (
          <span className="text-muted-foreground">{row.note ?? "Manual"}</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        row.saleId ? null : (
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
            Excluir
          </Button>
        ),
    },
  ];

  if (activeProducts.length === 0) {
    return (
      <EmptyState
        title="Cadastre um produto primeiro"
        description="O estoque é controlado por tamanho e cor de cada produto. Comece criando a peça em Produtos."
        action={
          <Button asChild>
            <Link href="/produtos">Ir para Produtos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Peças em estoque"
          icon={Boxes}
          value={String(totals.units)}
          footer={<span className="text-caption text-muted-foreground">{stocks.length} {stocks.length === 1 ? "variação controlada" : "variações controladas"}</span>}
        />
        <StatCard
          label="Valor em estoque"
          icon={Wallet}
          value={formatCurrencyCents(totals.value)}
          footer={<span className="text-caption text-muted-foreground">ao custo de cada peça</span>}
        />
        <StatCard
          label="Estoque baixo"
          icon={AlertTriangle}
          value={String(totals.lowCount)}
          footer={<span className="text-caption text-muted-foreground">até {settings.lowStockThreshold} {settings.lowStockThreshold === 1 ? "peça" : "peças"}</span>}
        />
        <StatCard
          label="Esgotados"
          icon={PackageX}
          value={String(totals.outCount)}
          footer={<span className="text-caption text-muted-foreground">variações sem peças</span>}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="baixo">Estoque baixo ({totals.lowCount})</TabsTrigger>
              <TabsTrigger value="esgotado">Esgotados ({totals.outCount})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-48 max-w-xs flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou tamanho..." className="pl-8" />
          </div>
          <Button className="ml-auto" onClick={() => openMovement("entrada")}>
            <Plus className="size-4" />
            Registrar movimentação
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={rows.map((row): StockRow => ({ ...row, id: variantKey(row.variant) }))}
          emptyTitle={stocks.length === 0 ? "Nenhum produto com estoque controlado" : "Nada encontrado"}
          emptyDescription={
            stocks.length === 0
              ? "Registre a primeira entrada de um produto para começar. A partir daí, cada venda baixa o estoque sozinha."
              : "Ajuste a busca ou o filtro para ver outras variações."
          }
          emptyAction={
            stocks.length === 0 ? (
              <Button onClick={() => openMovement("entrada")}>
                <Plus className="size-4" />
                Registrar primeira entrada
              </Button>
            ) : undefined
          }
        />
      </div>

      {untracked.length > 0 && stocks.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-body font-medium text-foreground">Sem controle de estoque</h2>
          <p className="text-caption text-muted-foreground">
            Estes produtos ainda não têm nenhuma entrada. Enquanto isso, vendê-los não baixa nem avisa nada.
          </p>
          <div className="flex flex-wrap gap-2">
            {untracked.map((product) => (
              <Button key={product.id} variant="outline" size="sm" onClick={() => openMovement("entrada", { productId: product.id })}>
                <Plus className="size-3.5" />
                {product.name}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-body font-medium text-foreground">Últimas movimentações</h2>
          <DataTable columns={historyColumns} data={history} />
        </section>
      ) : null}
    </div>
  );
}
