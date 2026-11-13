"use client";

/* eslint-disable @next/next/no-img-element -- fotos vêm do CDN da loja (Nuvemshop) */

import * as React from "react";
import { toast } from "sonner";
import { ArrowUpRight, Boxes, Download, FlaskConical, Loader2, MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/common/page-header";
import { Segmented } from "@/components/common/segmented";
import { EmptyState } from "@/components/common/empty-state";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useStock } from "@/lib/stock/stock-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { listVariantStocks, summarizeProductStock } from "@/lib/stock/calculations";
import { StockMovementForm } from "@/components/stock/stock-movement-form";
import { useUI } from "@/components/providers/ui-provider";
import { ProductForm } from "@/components/catalog/product-form";
import { ProductSimulator } from "@/components/catalog/product-simulator";
import { calculateMargin, calculateProductCost } from "@/lib/catalog/calculations";
import { guessStoreProductUrl, type StoreProduct } from "@/lib/catalog/store-import";
import { buildProductMonthlyUnits, buildProductsReport } from "@/lib/reports/products-report";
import { todayISO } from "@/lib/finance/actions";
import { STORE_URL } from "@/lib/brand";
import { formatCurrencyCents } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/catalog/types";

type Filter = "todos" | "ativo" | "rascunho" | "baixo";

const STATUS_LABEL: Record<Product["status"], string> = { ativo: "Ativo", rascunho: "Rascunho", arquivado: "Arquivado" };
const ALL_TIME = { start: "2000-01-01", end: "2999-12-31", label: "Desde o início" };

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? 100 / (values.length - 1) : 100;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(28 - (v / max) * 24).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-7 w-24" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="var(--color-electric-blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Photo({ product, className }: { product: Product; className?: string }) {
  return product.image ? (
    <img src={product.image} alt={product.name} className={cn("bg-paper-mist object-cover", className)} />
  ) : (
    <div className={cn("flex items-center justify-center bg-paper-mist text-center text-caption text-muted-foreground", className)}>sem foto</div>
  );
}

export function ProductsPanel() {
  const { products, deleteProduct, updateProduct } = useCatalog();
  const { sales } = useSales();
  const { openDrawer, closeDrawer, confirm } = useUI();
  const { movements } = useStock();
  const { settings } = useSettings();
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("todos");
  const [syncing, setSyncing] = React.useState(false);

  const stocks = React.useMemo(() => listVariantStocks(products, movements, settings.lowStockThreshold), [products, movements, settings.lowStockThreshold]);
  const report = React.useMemo(() => buildProductsReport(sales, products, ALL_TIME), [sales, products]);
  const soldById = new Map(report.map((r) => [r.productId, r]));
  const last6 = React.useMemo(() => {
    const [y, m] = todayISO().slice(0, 7).split("-").map(Number);
    return Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(y, m - 6 + i, 1)).toISOString().slice(0, 7));
  }, []);
  const monthlyUnits = React.useMemo(() => buildProductMonthlyUnits(sales, last6), [sales, last6]);

  const margins = products
    .filter((p) => p.price && p.price > 0)
    .map((p) => calculateMargin(p.price ?? 0, calculateProductCost(p.costComponents)).marginPercent);
  const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : undefined;
  const collections = new Set(products.map((p) => p.collection).filter(Boolean));
  const top = report[0] ? products.find((p) => p.id === report[0].productId) : undefined;

  const filtered = products
    .filter((p) => (search.trim() ? p.name.toLowerCase().includes(search.trim().toLowerCase()) : true))
    .filter((p) => {
      if (filter === "ativo" || filter === "rascunho") return p.status === filter;
      if (filter === "baixo") return (summarizeProductStock(stocks, p.id)?.attentionCount ?? 0) > 0;
      return true;
    })
    .sort((a, b) => (soldById.get(b.id)?.quantidadeVendida ?? 0) - (soldById.get(a.id)?.quantidadeVendida ?? 0));

  const missingPhotos = products.filter((p) => !p.image && p.status !== "arquivado");

  function openCreate() {
    openDrawer({ title: "Novo produto", description: "Cole o link da loja e complete o resto.", content: <ProductForm onDone={closeDrawer} /> });
  }
  function openEdit(product: Product) {
    openDrawer({ title: "Editar produto", content: <ProductForm product={product} onDone={closeDrawer} /> });
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

  /** Para cada produto sem foto, procura a página dele na loja pelo nome e completa só o que está vazio. */
  async function fetchMissingPhotos() {
    setSyncing(true);
    let found = 0;
    for (const product of missingPhotos) {
      const url = product.storeUrl ?? guessStoreProductUrl(product.name, STORE_URL);
      if (!url) continue;
      try {
        const res = await fetch(`/api/products/import?url=${encodeURIComponent(url)}`);
        if (!res.ok) continue;
        const data = (await res.json()) as StoreProduct;
        updateProduct(product.id, {
          image: data.image,
          storeUrl: data.storeUrl,
          price: product.price ?? data.price,
          description: product.description ?? data.description,
          collection: product.collection ?? data.collection,
          sizes: product.sizes?.length ? product.sizes : data.sizes,
          colors: product.colors?.length ? product.colors : data.colors,
        });
        found += 1;
      } catch {
        // segue para o próximo — um produto fora da loja não trava os outros
      }
    }
    setSyncing(false);
    const missed = missingPhotos.length - found;
    if (found > 0) toast.success(`${found} ${found === 1 ? "produto ganhou" : "produtos ganharam"} foto e dados da loja.`);
    if (missed > 0) toast.info(`${missed} ${missed === 1 ? "não foi encontrado" : "não foram encontrados"} na loja pelo nome — cole o link no produto.`);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Produtos"
        description="Catálogo, custos e margem — fotos e preço vindos da loja."
        stats={[
          { value: String(products.filter((p) => p.status === "ativo").length), label: "ativos" },
          ...(collections.size > 0 ? [{ value: String(collections.size), label: collections.size === 1 ? "coleção" : "coleções" }] : []),
          ...(avgMargin !== undefined ? [{ value: `${Math.round(avgMargin)}%`, label: "margem média" }] : []),
        ]}
        action={
          <>
            {missingPhotos.length > 0 ? (
              <Button variant="outline" size="lg" className="bg-card" onClick={fetchMissingPhotos} disabled={syncing}>
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Buscar fotos na loja ({missingPhotos.length})
              </Button>
            ) : null}
            <Button size="lg" onClick={openCreate}>
              <Plus className="size-4" /> Novo produto
            </Button>
          </>
        }
      />

      {top && report[0] ? (
        <Card className="flex-row flex-wrap items-stretch gap-5 p-3">
          <Photo product={top} className="aspect-square w-full max-w-72 shrink-0 rounded-[24px]" />
          <div className="flex min-w-60 flex-1 flex-col gap-4 p-2">
            <span className="w-fit rounded-full bg-primary px-3 py-1 text-caption font-medium text-primary-foreground">Mais vendida</span>
            <h2 className="font-display text-heading leading-tight">{top.name}</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { label: "Preço", value: top.price ? formatCurrencyCents(top.price) : "—" },
                { label: "Lucro por peça", value: top.price ? formatCurrencyCents(top.price - calculateProductCost(top.costComponents)) : "—" },
                { label: "Vendidas", value: String(report[0].quantidadeVendida) },
                { label: "Faturamento", value: formatCurrencyCents(report[0].faturamento) },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-0.5 rounded-2xl bg-paper-mist px-4 py-3">
                  <span className="text-caption text-muted-foreground">{stat.label}</span>
                  <span className="font-display text-subheading">{stat.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openEdit(top)}>Editar</Button>
              {top.storeUrl ? (
                <Button variant="ghost" asChild>
                  <a href={top.storeUrl} target="_blank" rel="noreferrer">Ver na loja <ArrowUpRight className="size-4" /></a>
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="gap-4 px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-subheading">Catálogo</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Filtrar produtos"
              variant="chips"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "todos", label: "Todos" },
                { value: "ativo", label: "Ativos" },
                { value: "rascunho", label: "Rascunhos" },
                { value: "baixo", label: "Estoque baixo" },
              ]}
            />
            <div className="relative w-48">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" aria-label="Buscar produto" className="rounded-full pl-8" />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={products.length === 0 ? "Nenhum produto cadastrado" : "Nenhum produto neste filtro"}
            description={products.length === 0 ? "Cole o link de um produto da loja e o ERP puxa foto, preço e descrição." : "Troque o filtro ou a busca."}
            action={products.length === 0 ? <Button onClick={openCreate}><Plus className="size-4" /> Adicionar produto</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-[760px] flex-col">
              <div className="grid grid-cols-[2.4fr_1fr_0.8fr_0.8fr_1.1fr_1fr_88px] gap-3 px-2 pb-2 text-caption text-muted-foreground">
                <span>Produto</span><span>Preço</span><span>Margem</span><span>Vendidas</span><span>Últimos 6 meses</span><span>Estoque</span><span />
              </div>
              {filtered.map((product) => {
                const cost = calculateProductCost(product.costComponents);
                const margin = product.price ? calculateMargin(product.price, cost).marginPercent : undefined;
                const stock = summarizeProductStock(stocks, product.id);
                const sold = soldById.get(product.id)?.quantidadeVendida ?? 0;
                return (
                  <div
                    key={product.id}
                    className="grid grid-cols-[2.4fr_1fr_0.8fr_0.8fr_1.1fr_1fr_88px] items-center gap-3 rounded-2xl border-t border-border px-2 py-2.5 transition-colors hover:bg-paper-mist"
                  >
                    <button type="button" onClick={() => openEdit(product)} className="flex min-w-0 items-center gap-3.5 text-left">
                      <Photo product={product} className="size-16 shrink-0 rounded-2xl" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-body-lg font-medium">{product.name}</span>
                        <span className="text-caption text-muted-foreground">
                          {[product.collection, STATUS_LABEL[product.status]].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </button>
                    <span className="text-body">{product.price ? formatCurrencyCents(product.price) : "—"}</span>
                    <span className={cn("text-body font-semibold", margin !== undefined && margin < settings.marginThresholdPercent && "text-tangerine")}>
                      {margin !== undefined ? `${Math.round(margin)}%` : "—"}
                    </span>
                    <span className="text-body">{sold}</span>
                    <Sparkline values={monthlyUnits.get(product.id) ?? last6.map(() => 0)} label={`Vendas de ${product.name} nos últimos 6 meses`} />
                    <span
                      className={cn(
                        "w-fit rounded-full px-3 py-1 text-caption font-medium",
                        !stock ? "bg-paper-mist text-muted-foreground" : stock.attentionCount > 0 ? "bg-[#f8ece4] text-[#8f3f17]" : "bg-sidebar-accent text-deep-sapphire"
                      )}
                    >
                      {!stock ? "sem controle" : `${stock.units} ${stock.units === 1 ? "peça" : "peças"}`}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      {product.storeUrl ? (
                        <Button variant="outline" size="icon" asChild>
                          <a href={product.storeUrl} target="_blank" rel="noreferrer" aria-label={`Abrir ${product.name} na loja`}>
                            <ArrowUpRight className="size-4" />
                          </a>
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Ações de ${product.name}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(product)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openSimulate(product)}><FlaskConical /> Simular</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openStockEntry(product)}><Boxes /> Movimentar estoque</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => handleDelete(product)}>Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
