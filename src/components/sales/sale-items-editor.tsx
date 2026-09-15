"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/common/combobox";
import { CurrencyInput } from "@/components/common/currency-input";
import { formatCurrencyCents } from "@/lib/currency";
import { buildSaleItem } from "@/lib/sales/calculations";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import type { SaleItem } from "@/lib/sales/types";

/**
 * Um ou mais produtos por venda. `subtotal` nunca é digitado — é sempre
 * recalculado a partir de quantidade × preço unitário (ver buildSaleItem),
 * então os três nunca ficam inconsistentes entre si.
 */
export function SaleItemsEditor({ items, onChange }: { items: SaleItem[]; onChange: (items: SaleItem[]) => void }) {
  const { products } = useCatalog();

  function updateItem(id: string, changes: Partial<Pick<SaleItem, "productId" | "quantity" | "unitPrice">>) {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...changes };
        return buildSaleItem({ id: item.id, productId: next.productId, quantity: next.quantity, unitPrice: next.unitPrice });
      })
    );
  }

  function handleProductChange(id: string, productId: string) {
    // Sugere o preço do catálogo ao trocar de produto — mas nunca sobrescreve
    // um preço unitário que o usuário já tenha digitado para ESTE item além
    // do sugerido, já que trocar de produto naturalmente deveria trazer o
    // preço daquele outro produto.
    const product = products.find((p) => p.id === productId);
    updateItem(id, { productId, unitPrice: product?.price ?? 0 });
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    const firstProduct = products[0];
    onChange([...items, buildSaleItem({ productId: firstProduct?.id ?? "", quantity: 1, unitPrice: firstProduct?.price ?? 0 })]);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-end gap-2 rounded-lg border border-border p-2.5">
          <div className="flex-1 min-w-0">
            <Combobox
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              value={item.productId}
              onValueChange={(value) => handleProductChange(item.id, value)}
              placeholder="Selecionar produto"
            />
          </div>
          <div className="w-16">
            <Input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              aria-label="Quantidade"
            />
          </div>
          <div className="w-28">
            <CurrencyInput value={item.unitPrice} onValueChange={(unitPrice) => updateItem(item.id, { unitPrice })} />
          </div>
          <div className="w-24 shrink-0 text-right text-body text-foreground">{formatCurrencyCents(item.subtotal)}</div>
          <Button variant="ghost" size="icon-sm" aria-label="Remover produto" onClick={() => removeItem(item.id)} disabled={items.length <= 1}>
            <X className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-fit" onClick={addItem} type="button">
        <Plus className="size-3.5" />
        Adicionar produto
      </Button>
    </div>
  );
}
