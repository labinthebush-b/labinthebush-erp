"use client";

import * as React from "react";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/common/combobox";
import { DateInput } from "@/components/common/date-input";
import { DrawerForm, DrawerFormActions } from "@/components/common/drawer-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useStock } from "@/lib/stock/stock-provider";
import { adjustmentDelta, missingVariantChoice, signedQuantity, variantLabel } from "@/lib/stock/calculations";
import type { StockMovementKind, VariantRef } from "@/lib/stock/types";

export type MovementFormKind = StockMovementKind;

const KIND_OPTIONS: { value: MovementFormKind; label: string; hint: string }[] = [
  { value: "entrada", label: "Entrada", hint: "Chegaram peças: produção, compra ou devolução." },
  { value: "saida", label: "Saída", hint: "Saíram peças sem ser por uma venda registrada: brinde, perda, defeito." },
  { value: "ajuste", label: "Contagem real", hint: "Você contou as peças e o número é outro: o sistema lança só a diferença." },
];

function toISODate(date?: Date): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function optionsOf(list?: string[]): string[] {
  return (list ?? []).map((value) => value.trim()).filter(Boolean);
}

export function StockMovementForm({
  initial,
  defaultKind = "entrada",
  onDone,
}: {
  initial?: Partial<VariantRef>;
  defaultKind?: MovementFormKind;
  onDone: () => void;
}) {
  const { products } = useCatalog();
  const { addMovement, getLevel, isTracked } = useStock();

  const [kind, setKind] = React.useState<MovementFormKind>(defaultKind);
  const [productId, setProductId] = React.useState(initial?.productId ?? "");
  const [size, setSize] = React.useState(initial?.size ?? "");
  const [color, setColor] = React.useState(initial?.color ?? "");
  const [quantity, setQuantity] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [note, setNote] = React.useState("");

  const product = products.find((p) => p.id === productId);
  const sizes = optionsOf(product?.sizes);
  const colors = optionsOf(product?.colors);
  const variant: VariantRef = { productId, size: size || undefined, color: color || undefined };
  const variantChosen = Boolean(product) && missingVariantChoice(product, variant) === null;
  const currentLevel = variantChosen ? getLevel(variant) : 0;
  const amount = Math.round(Number(quantity.replace(",", ".")));
  const kindInfo = KIND_OPTIONS.find((option) => option.value === kind);

  function handleProductChange(id: string) {
    setProductId(id);
    const next = products.find((p) => p.id === id);
    const nextSizes = optionsOf(next?.sizes);
    const nextColors = optionsOf(next?.colors);
    setSize(nextSizes.length === 1 ? nextSizes[0] : "");
    setColor(nextColors.length === 1 ? nextColors[0] : "");
  }

  function handleSubmit() {
    if (!product) {
      toast.error("Escolha o produto.");
      return;
    }
    const missing = missingVariantChoice(product, variant);
    if (missing) {
      toast.error(missing === "cor" ? "Escolha a cor." : "Escolha o tamanho.");
      return;
    }
    if (!date) {
      toast.error("Selecione a data.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0 || (kind !== "ajuste" && amount === 0)) {
      toast.error(kind === "ajuste" ? "Informe a quantidade contada (0 ou mais)." : "Informe uma quantidade maior que zero.");
      return;
    }

    const delta = kind === "ajuste" ? adjustmentDelta(amount, currentLevel) : signedQuantity(kind, amount);
    if (delta === 0) {
      toast.info("A contagem já bate com o estoque — nada a ajustar.");
      return;
    }

    const wasTracked = isTracked(product.id);
    addMovement({
      productId: product.id,
      size: variant.size,
      color: variant.color,
      kind,
      quantity: delta,
      date: toISODate(date),
      note: note.trim() || undefined,
    });
    toast.success(
      wasTracked
        ? "Movimentação registrada."
        : `Movimentação registrada — o estoque de “${product.name}” agora é controlado e baixa a cada venda.`
    );
    onDone();
  }

  const resultingLevel = kind === "ajuste" ? amount : currentLevel + (Number.isFinite(amount) ? signedQuantity(kind, amount) : 0);

  return (
    <>
      <DrawerForm>
        <Field label="Tipo">
          <Select value={kind} onValueChange={(value) => setKind(value as MovementFormKind)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {kindInfo ? <p className="mt-1 text-caption text-muted-foreground">{kindInfo.hint}</p> : null}
        </Field>

        <Field label="Produto">
          <Combobox
            options={products.filter((p) => p.status !== "arquivado").map((p) => ({ value: p.id, label: p.name }))}
            value={productId}
            onValueChange={handleProductChange}
            placeholder="Selecionar produto"
          />
        </Field>

        {sizes.length > 0 || colors.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {sizes.length > 0 ? (
              <Field label="Tamanho">
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>
                    {sizes.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {colors.length > 0 ? (
              <Field label="Cor">
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>
                    {colors.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
        ) : null}

        <Field label={kind === "ajuste" ? "Quantidade contada" : "Quantidade"}>
          <Input
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
          />
          {variantChosen && quantity !== "" ? (
            <p className="mt-1 text-caption text-muted-foreground">
              {variantLabel(variant)}: {currentLevel} em estoque → {resultingLevel} depois desta movimentação.
            </p>
          ) : null}
        </Field>

        <Field label="Data">
          <DateInput value={date} onValueChange={setDate} />
        </Field>

        <Field label="Observação" optional>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={kind === "entrada" ? "Ex: lote de produção de outubro" : kind === "saida" ? "Ex: brinde para parceiro" : "Ex: contagem de fim de mês"}
          />
        </Field>
      </DrawerForm>
      <DrawerFormActions onCancel={onDone} onSubmit={handleSubmit} submitLabel="Registrar" />
    </>
  );
}
