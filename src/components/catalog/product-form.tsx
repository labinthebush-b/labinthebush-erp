"use client";

import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/common/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const hasExtraFields = Boolean(
    product?.category || product?.collection || product?.sku || product?.supplier ||
    product?.sizes?.length || product?.colors?.length || product?.image ||
    product?.description || product?.notes
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
        <Field label="Nome">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Camiseta Oversized Preta" autoFocus />
        </Field>

        <Field label="Preço de venda" optional>
          <CurrencyInput value={price} onValueChange={setPrice} />
        </Field>

        <Field label="Status">
          <Select value={status} onValueChange={(value) => setStatus(value as ProductStatus)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

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
          <Field label="Tamanhos" optional hint="Separados por vírgula">
            <Input value={sizes} onChange={(e) => setSizes(e.target.value)} placeholder="P, M, G, GG" />
          </Field>
          <Field label="Cores" optional hint="Separadas por vírgula">
            <Input value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Preto, Branco" />
          </Field>
          <Field label="Imagem" optional hint="URL da imagem">
            <div className="flex items-start gap-3">
              <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." className="flex-1" />
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- external, arbitrary URL; next/image would require configuring every possible remote host
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
