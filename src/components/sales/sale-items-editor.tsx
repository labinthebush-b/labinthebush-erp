"use client";

/* eslint-disable @next/next/no-img-element -- fotos dos produtos vêm do CDN da loja */

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/common/combobox";
import { CurrencyInput } from "@/components/common/currency-input";
import { formatCurrencyCents } from "@/lib/currency";
import { buildSaleItem } from "@/lib/sales/calculations";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useStock } from "@/lib/stock/stock-provider";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/catalog/types";
import type { SaleItem } from "@/lib/sales/types";

function optionsOf(list?: string[]): string[] {
  return (list ?? []).map((value) => value.trim()).filter(Boolean);
}

/** Se o produto só tem uma opção (um tamanho, uma cor), já vem escolhida — menos um clique por venda. */
function defaultVariant(product?: Product): { size?: string; color?: string } {
  const sizes = optionsOf(product?.sizes);
  const colors = optionsOf(product?.colors);
  return { size: sizes.length === 1 ? sizes[0] : undefined, color: colors.length === 1 ? colors[0] : undefined };
}

function LabeledField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-caption text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * Um ou mais produtos por venda. `subtotal` nunca é digitado — é sempre
 * recalculado a partir de quantidade × preço unitário (ver buildSaleItem),
 * então os três nunca ficam inconsistentes entre si. Quando o produto tem
 * tamanhos/cores cadastrados, cada item escolhe a sua variante (é dela que o
 * estoque baixa).
 */
export function SaleItemsEditor({ items, onChange }: { items: SaleItem[]; onChange: (items: SaleItem[]) => void }) {
  const { products } = useCatalog();
  const { movements, getLevel, isTracked } = useStock();

  function updateItem(id: string, changes: Partial<Pick<SaleItem, "productId" | "size" | "color" | "quantity" | "unitPrice">>) {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...changes };
        return buildSaleItem({
          id: item.id,
          productId: next.productId,
          size: next.size,
          color: next.color,
          quantity: next.quantity,
          unitPrice: next.unitPrice,
        });
      })
    );
  }

  function handleProductChange(id: string, productId: string) {
    // Trocar de produto traz o preço e as opções DAQUELE produto: o tamanho/cor
    // do produto anterior não valem para o novo.
    const product = products.find((p) => p.id === productId);
    const variant = defaultVariant(product);
    updateItem(id, { productId, unitPrice: product?.price ?? 0, size: variant.size, color: variant.color });
  }

  /**
   * Toque na foto: se a peça já está na venda e não tem tamanho/cor a escolher,
   * soma 1; se a venda só tem a linha vazia inicial, ela vira esta peça; senão
   * entra uma linha nova.
   */
  function pickProduct(product: Product) {
    const variant = defaultVariant(product);
    const needsChoice = optionsOf(product.sizes).length > 1 || optionsOf(product.colors).length > 1;
    const existing = items.find((i) => i.productId === product.id);
    if (existing && !needsChoice) {
      updateItem(existing.id, { quantity: existing.quantity + 1 });
      return;
    }
    const blank = items.find((i) => !i.productId);
    if (blank) {
      updateItem(blank.id, { productId: product.id, unitPrice: product.price ?? 0, size: variant.size, color: variant.color, quantity: 1 });
      return;
    }
    onChange([...items, buildSaleItem({ productId: product.id, ...variant, quantity: 1, unitPrice: product.price ?? 0 })]);
  }

  const pickable = products.filter((p) => p.status !== "arquivado");
  const quantityOf = (productId: string) => items.filter((i) => i.productId === productId).reduce((sum, i) => sum + i.quantity, 0);

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    const firstProduct = products[0];
    onChange([
      ...items,
      buildSaleItem({
        productId: firstProduct?.id ?? "",
        ...defaultVariant(firstProduct),
        quantity: 1,
        unitPrice: firstProduct?.price ?? 0,
      }),
    ]);
  }

  /** Estoque que ESTE item pode usar: o saldo atual + o que a própria venda já tinha baixado dele (ao editar). */
  function availableFor(item: SaleItem): number {
    const ownDeduction = movements
      .filter((m) => m.saleItemId === item.id)
      .reduce((sum, m) => sum - m.quantity, 0);
    return getLevel(item) + ownDeduction;
  }

  return (
    <div className="flex flex-col gap-3">
      {pickable.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {pickable.map((product) => {
            const qty = quantityOf(product.id);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => pickProduct(product)}
                aria-label={`Adicionar ${product.name}`}
                className={cn(
                  "flex flex-col gap-1.5 rounded-2xl border-2 p-1.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  qty > 0 ? "border-primary bg-sidebar-accent" : "border-border bg-card hover:bg-paper-mist"
                )}
              >
                <span className="relative block">
                  {product.image ? (
                    <img src={product.image} alt="" className="aspect-square w-full rounded-xl bg-paper-mist object-cover" />
                  ) : (
                    <span className="flex aspect-square w-full items-center justify-center rounded-xl bg-paper-mist text-caption text-muted-foreground">sem foto</span>
                  )}
                  {qty > 0 ? (
                    <span className="absolute top-1.5 right-1.5 flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-caption font-semibold text-primary-foreground">{qty}</span>
                  ) : null}
                </span>
                <span className="line-clamp-2 px-1 text-caption font-medium">{product.name}</span>
                <span className="px-1 pb-1 text-caption text-muted-foreground">{product.price ? formatCurrencyCents(product.price) : "sem preço"}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const sizes = optionsOf(product?.sizes);
        const colors = optionsOf(product?.colors);
        const variantReady = (sizes.length === 0 || Boolean(item.size)) && (colors.length === 0 || Boolean(item.color));
        const showStock = Boolean(product) && isTracked(item.productId) && variantReady;
        const available = showStock ? availableFor(item) : 0;

        return (
          <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5">
            <div className="flex items-center gap-2">
              {product?.image ? <img src={product.image} alt="" className="size-10 shrink-0 rounded-xl bg-paper-mist object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <Combobox
                  options={products.map((p) => ({ value: p.id, label: p.name }))}
                  value={item.productId}
                  onValueChange={(value) => handleProductChange(item.id, value)}
                  placeholder="Selecionar produto"
                />
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Remover produto" onClick={() => removeItem(item.id)} disabled={items.length <= 1}>
                <X className="size-3.5" />
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              {sizes.length > 0 ? (
                <LabeledField label="Tamanho" className="w-24">
                  <Select value={item.size ?? ""} onValueChange={(size) => updateItem(item.id, { size })}>
                    <SelectTrigger className="w-full" aria-label="Tamanho"><SelectValue placeholder="Escolher" /></SelectTrigger>
                    <SelectContent>
                      {sizes.map((size) => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </LabeledField>
              ) : null}
              {colors.length > 0 ? (
                <LabeledField label="Cor" className="w-28">
                  <Select value={item.color ?? ""} onValueChange={(color) => updateItem(item.id, { color })}>
                    <SelectTrigger className="w-full" aria-label="Cor"><SelectValue placeholder="Escolher" /></SelectTrigger>
                    <SelectContent>
                      {colors.map((color) => (
                        <SelectItem key={color} value={color}>{color}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </LabeledField>
              ) : null}
              <LabeledField label="Qtd" className="w-16">
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  aria-label="Quantidade"
                />
              </LabeledField>
              <LabeledField label="Preço unitário" className="w-28">
                <CurrencyInput value={item.unitPrice} onValueChange={(unitPrice) => updateItem(item.id, { unitPrice })} />
              </LabeledField>
              <div className="ml-auto pb-2 text-right text-body text-foreground">{formatCurrencyCents(item.subtotal)}</div>
            </div>

            {showStock ? (
              <p className={available < item.quantity ? "text-caption text-destructive" : "text-caption text-muted-foreground"}>
                {available < item.quantity
                  ? `Estoque insuficiente: ${Math.max(available, 0)} em estoque, venda de ${item.quantity}.`
                  : `${available} em estoque.`}
              </p>
            ) : null}
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-fit" onClick={addItem} type="button">
        <Plus className="size-3.5" />
        Adicionar outra linha
      </Button>
    </div>
  );
}
