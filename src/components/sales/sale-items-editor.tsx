"use client";

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
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const sizes = optionsOf(product?.sizes);
        const colors = optionsOf(product?.colors);
        const variantReady = (sizes.length === 0 || Boolean(item.size)) && (colors.length === 0 || Boolean(item.color));
        const showStock = Boolean(product) && isTracked(item.productId) && variantReady;
        const available = showStock ? availableFor(item) : 0;

        return (
          <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-2">
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
        Adicionar produto
      </Button>
    </div>
  );
}
