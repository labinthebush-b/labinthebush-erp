"use client";

/* eslint-disable @next/next/no-img-element -- foto vem do CDN da loja (Nuvemshop) ou de uma URL qualquer */

import * as React from "react";
import { toast } from "sonner";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/common/segmented";
import { calculateProductCost } from "@/lib/catalog/calculations";
import type { StoreProduct } from "@/lib/catalog/store-import";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/common/currency-input";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { DrawerForm, DrawerFormActions } from "@/components/common/drawer-form";
import { CostComponentsEditor } from "@/components/catalog/cost-components-editor";
import { CostSummary } from "@/components/catalog/cost-summary";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useTasks } from "@/lib/tasks/tasks-provider";
import { formatCurrencyCents } from "@/lib/currency";
import type { CostComponent, Product, ProductStatus } from "@/lib/catalog/types";

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: "rascunho", label: "Rascunho" },
  { value: "ativo", label: "Ativo" },
  { value: "arquivado", label: "Arquivado" },
];

function parseListInput(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ProductForm({ product, onDone }: { product?: Product; onDone: () => void }) {
  const { addProduct, updateProduct } = useCatalog();
  const { sales } = useSales();
  const { tasks } = useTasks();
  const isEditing = Boolean(product);

  const relatedSales = product ? sales.filter((s) => s.items.some((item) => item.productId === product.id)) : [];
  const relatedTasks = product ? tasks.filter((t) => t.relations?.productId === product.id) : [];

  const [name, setName] = React.useState(product?.name ?? "");
  const [status, setStatus] = React.useState<ProductStatus>(product?.status ?? "rascunho");
  const [price, setPrice] = React.useState(product?.price ?? 0);
  const [costComponents, setCostComponents] = React.useState<CostComponent[]>(product?.costComponents ?? []);

  const [category, setCategory] = React.useState(product?.category ?? "");
  const [collection, setCollection] = React.useState(product?.collection ?? "");
  const [sku, setSku] = React.useState(product?.sku ?? "");
  const [supplier, setSupplier] = React.useState(product?.supplier ?? "");
  const [sizes, setSizes] = React.useState((product?.sizes ?? []).join(", "));
  const [colors, setColors] = React.useState((product?.colors ?? []).join(", "));
  const [image, setImage] = React.useState(product?.image ?? "");
  const [description, setDescription] = React.useState(product?.description ?? "");
  const [notes, setNotes] = React.useState(product?.notes ?? "");
  const [storeUrl, setStoreUrl] = React.useState(product?.storeUrl ?? "");
  const [importing, setImporting] = React.useState(false);

  /** Puxa da página da loja o que ela sabe; o resto (custos, fornecedor...) você completa. */
  async function importFromStore() {
    if (!storeUrl.trim()) return toast.error("Cole o link do produto na loja.");
    setImporting(true);
    try {
      const res = await fetch(`/api/products/import?url=${encodeURIComponent(storeUrl.trim())}`);
      const body = (await res.json().catch(() => ({}))) as Partial<StoreProduct> & { error?: string };
      if (!res.ok || !body.name) {
        toast.error(body.error ?? "Não foi possível ler esse link.");
        return;
      }
      setStoreUrl(body.storeUrl ?? storeUrl);
      setName(body.name);
      if (body.price) setPrice(body.price);
      if (body.image) setImage(body.image);
      if (body.description) setDescription(body.description);
      if (body.collection) setCollection(body.collection);
      if (body.sizes?.length) setSizes(body.sizes.join(", "));
      if (body.colors?.length) setColors(body.colors.join(", "));
      if (status === "rascunho") setStatus("ativo");
      toast.success("Dados puxados da loja — agora complete os custos.");
    } catch {
      toast.error("Não foi possível falar com a loja agora.");
    } finally {
      setImporting(false);
    }
  }

  const unitCost = calculateProductCost(costComponents);
  const unitProfit = price - unitCost;
  const margin = price > 0 ? (unitProfit / price) * 100 : 0;

  const hasExtraFields = Boolean(
    product?.category || product?.collection || product?.sku || product?.supplier ||
    product?.image || product?.description || product?.notes
  );

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Dê um nome ao produto.");
      return;
    }

    const changes: Partial<Product> = {
      name,
      status,
      price: price > 0 ? price : undefined,
      costComponents,
      category: category || undefined,
      collection: collection || undefined,
      sku: sku || undefined,
      supplier: supplier || undefined,
      sizes: sizes ? parseListInput(sizes) : undefined,
      colors: colors ? parseListInput(colors) : undefined,
      image: image || undefined,
      storeUrl: storeUrl.trim() || undefined,
      description: description || undefined,
      notes: notes || undefined,
    };

    if (isEditing && product) {
      updateProduct(product.id, changes);
      toast.success("Produto atualizado.");
    } else {
      const created = addProduct({ name, status, price: changes.price });
      updateProduct(created.id, changes);
      toast.success("Produto criado.");
    }
    onDone();
  }

  return (
    <>
      <DrawerForm>
        <Field label="Link do produto na loja" optional hint="Cole o link de labinthebush.com/produtos/… e o ERP puxa nome, preço, foto, descrição, coleção e tamanhos.">
          <div className="flex gap-2">
            <Input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void importFromStore();
                }
              }}
              placeholder="labinthebush.com/produtos/…"
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={importFromStore} disabled={importing}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Puxar dados
            </Button>
          </div>
        </Field>

        <div aria-label="Prévia do produto" className="brand-gradient flex gap-4 rounded-3xl p-3">
          {image ? (
            <img src={image} alt="" className="size-32 shrink-0 rounded-2xl bg-white object-cover" />
          ) : (
            <div className="flex size-32 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-center text-caption">sem foto</div>
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1 pr-2">
            <span className="truncate font-display text-subheading">{name || "Novo produto"}</span>
            <div className="flex justify-between text-body"><span>Preço</span><span className="font-semibold">{price > 0 ? formatCurrencyCents(price) : "—"}</span></div>
            <div className="flex justify-between text-body"><span>Lucro por peça</span><span className="font-semibold">{price > 0 ? formatCurrencyCents(unitProfit) : "—"}</span></div>
            <div className="h-2 rounded-full bg-white/70">
              <div className={margin < 30 ? "h-2 rounded-full bg-tangerine" : "h-2 rounded-full bg-primary"} style={{ width: `${Math.max(0, Math.min(100, margin))}%` }} />
            </div>
            <span className="text-caption">
              {price > 0 ? `Margem ${Math.round(margin)}%` : "Defina o preço"}
              {unitCost === 0 && price > 0 ? " · faltam os custos" : ""}
            </span>
            {storeUrl && product?.storeUrl === storeUrl ? (
              <a href={storeUrl} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1 text-caption font-medium underline">
                Ver na loja <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </div>

        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Camiseta Oversized Preta" autoFocus />
        </Field>

        <Field label="Preço de venda" optional>
          <CurrencyInput value={price} onValueChange={setPrice} />
        </Field>

        <Field label="Status">
          <Segmented label="Status" variant="chips" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tamanhos" optional>
            <Input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="P, M, G, GG" />
          </Field>
          <Field label="Cores" optional>
            <Input value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Preto, Branco" />
          </Field>
          <p className="col-span-2 -mt-1 text-caption text-muted-foreground">
            Separe por vírgula. É por tamanho e cor que o estoque é controlado e que a venda pergunta qual peça saiu.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-body font-medium text-foreground">Custos</span>
          <CostComponentsEditor components={costComponents} onChange={setCostComponents} />
          {(costComponents.length > 0 || price > 0) ? (
            <CostSummary components={costComponents} price={price} />
          ) : null}
        </div>

        {isEditing && (relatedSales.length > 0 || relatedTasks.length > 0) ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            {relatedSales.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-caption font-medium text-muted-foreground">
                  Vendas deste produto ({relatedSales.length})
                </span>
                {relatedSales.slice(0, 3).map((sale) => (
                  <div key={sale.id} className="flex justify-between text-caption">
                    <span className="text-foreground">{new Date(sale.date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                    <span className="text-muted-foreground">{formatCurrencyCents(sale.totalAmount)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {relatedTasks.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-caption font-medium text-muted-foreground">
                  Tarefas relacionadas ({relatedTasks.length})
                </span>
                {relatedTasks.slice(0, 3).map((task) => (
                  <span key={task.id} className="text-caption text-foreground">
                    • {task.title}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <CollapsibleSection defaultOpen={hasExtraFields}>
          <Field label="Categoria" optional>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Camisetas" />
          </Field>
          <Field label="Coleção" optional>
            <Input value={collection} onChange={(e) => setCollection(e.target.value)} placeholder="Ex: Verão 2026" />
          </Field>
          <Field label="SKU" optional>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </Field>
          <Field label="Fornecedor" optional>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </Field>
          <Field label="Imagem" optional hint="URL da imagem">
            <div className="flex items-start gap-3">
              <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className="flex-1" />
              {image ? (
                <img
                  src={image}
                  alt=""
                  className="size-10 shrink-0 rounded-md border border-border object-cover"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                  onLoad={(e) => {
                    e.currentTarget.style.visibility = "visible";
                  }}
                />
              ) : null}
            </div>
          </Field>
          <Field label="Descrição" optional>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </Field>
          <Field label="Observações" optional>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </CollapsibleSection>
      </DrawerForm>
      <DrawerFormActions
        onCancel={onDone}
        onSubmit={handleSubmit}
        submitLabel={isEditing ? "Salvar alterações" : "Criar produto"}
      />
    </>
  );
}
