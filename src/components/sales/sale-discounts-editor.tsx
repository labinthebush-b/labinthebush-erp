"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/common/currency-input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasFreeShippingDiscount } from "@/lib/sales/calculations";
import type { Discount, DiscountKind } from "@/lib/sales/types";

const DISCOUNT_KIND_OPTIONS: { value: DiscountKind; label: string }[] = [
  { value: "percentual", label: "Percentual (%)" },
  { value: "valor_fixo", label: "Valor fixo (R$)" },
  { value: "frete_gratis", label: "Frete grátis" },
];

/**
 * Um ou mais cupons/descontos acumulativos por venda (ver
 * calculateDiscountsTotal). Só um pode ser "frete grátis" — os demais
 * (percentual, valor fixo) continuam livres para acumular com ele ou entre si.
 */
export function SaleDiscountsEditor({ discounts, onChange }: { discounts: Discount[]; onChange: (discounts: Discount[]) => void }) {
  function updateDiscount(index: number, changes: Partial<Discount>) {
    onChange(discounts.map((d, i) => (i === index ? { ...d, ...changes } : d)));
  }

  function removeDiscount(index: number) {
    onChange(discounts.filter((_, i) => i !== index));
  }

  function addDiscount(kind: DiscountKind) {
    if (kind === "frete_gratis" && hasFreeShippingDiscount(discounts)) {
      toast.error("Já existe um desconto de frete grátis nesta venda.");
      return;
    }
    onChange([...discounts, { kind, percent: kind === "percentual" ? 10 : undefined, amount: kind === "valor_fixo" ? 0 : undefined }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {discounts.map((discount, index) => (
        <div key={index} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select
                value={discount.kind}
                onValueChange={(value) => {
                  const kind = value as DiscountKind;
                  if (kind === "frete_gratis" && discounts.some((d, i) => i !== index && d.kind === "frete_gratis")) {
                    toast.error("Já existe um desconto de frete grátis nesta venda.");
                    return;
                  }
                  updateDiscount(index, {
                    kind,
                    percent: kind === "percentual" ? (discount.percent ?? 10) : undefined,
                    amount: kind === "valor_fixo" ? (discount.amount ?? 0) : undefined,
                  });
                }}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISCOUNT_KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remover desconto" onClick={() => removeDiscount(index)}>
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={discount.code ?? ""}
              onChange={(e) => updateDiscount(index, { code: e.target.value || undefined })}
              placeholder="Código do cupom (opcional)"
              className="flex-1"
            />
            {discount.kind === "percentual" ? (
              <div className="flex w-28 items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={discount.percent ?? 0}
                  onChange={(e) => updateDiscount(index, { percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                />
                <span className="text-body text-muted-foreground">%</span>
              </div>
            ) : null}
            {discount.kind === "valor_fixo" ? (
              <div className="w-28">
                <CurrencyInput value={discount.amount ?? 0} onValueChange={(amount) => updateDiscount(index, { amount })} />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between">
            <Input
              value={discount.description ?? ""}
              onChange={(e) => updateDiscount(index, { description: e.target.value || undefined })}
              placeholder="Descrição (opcional)"
              className="flex-1"
            />
            <div className="ml-2 flex items-center gap-2">
              <span className="text-caption text-muted-foreground">Acumulativo</span>
              <Switch checked={discount.acumulativo ?? false} onCheckedChange={(checked) => updateDiscount(index, { acumulativo: checked || undefined })} />
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {DISCOUNT_KIND_OPTIONS.map((option) => (
          <Button key={option.value} variant="outline" size="sm" type="button" onClick={() => addDiscount(option.value)}>
            <Plus className="size-3.5" />
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
