import type { Product } from "@/lib/catalog/types";
import type { SaleItem } from "@/lib/sales/types";
import type { StockLevelStatus, StockMovement, StockMovementKind, VariantRef } from "./types";

// ---------------------------------------------------------------------------
// Variantes (tamanho × cor)
// ---------------------------------------------------------------------------

function normalizeLabel(label?: string): string {
  return (label ?? "").trim().toLowerCase();
}

/**
 * Chave estável de uma variante. Ignora maiúsculas/minúsculas e espaços nas
 * pontas: "m " e "M" são o mesmo tamanho, então corrigir a grafia no cadastro
 * do produto não "perde" o estoque já movimentado.
 */
export function variantKey(variant: VariantRef): string {
  return `${variant.productId}|${normalizeLabel(variant.size)}|${normalizeLabel(variant.color)}`;
}

/** "M · Preto", "M", "Preto" ou "Único" (produto sem tamanho nem cor). */
export function variantLabel(variant: Pick<VariantRef, "size" | "color">): string {
  const parts = [variant.size?.trim(), variant.color?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Único";
}

/** Todas as variantes declaradas no cadastro do produto: tamanhos × cores (ou uma só, "Único"). */
export function listProductVariants(product: Pick<Product, "id" | "sizes" | "colors">): VariantRef[] {
  const sizes = (product.sizes ?? []).map((s) => s.trim()).filter(Boolean);
  const colors = (product.colors ?? []).map((c) => c.trim()).filter(Boolean);

  if (sizes.length === 0 && colors.length === 0) return [{ productId: product.id }];
  if (colors.length === 0) return sizes.map((size) => ({ productId: product.id, size }));
  if (sizes.length === 0) return colors.map((color) => ({ productId: product.id, color }));
  return sizes.flatMap((size) => colors.map((color) => ({ productId: product.id, size, color })));
}

/** Um produto "tem variação" quando exige escolher tamanho e/ou cor na venda. */
export function productHasVariants(product: Pick<Product, "sizes" | "colors">): boolean {
  return (product.sizes ?? []).some((s) => s.trim()) || (product.colors ?? []).some((c) => c.trim());
}

/**
 * O que falta escolher num item de venda: "tamanho" ou "cor", quando o produto
 * tem essas opções cadastradas e o item ainda não tem a escolha. Sem isso a
 * saída de estoque não saberia de qual variante baixar.
 */
export function missingVariantChoice(
  product: Pick<Product, "sizes" | "colors"> | undefined,
  item: Pick<SaleItem, "size" | "color">
): "tamanho" | "cor" | null {
  if (!product) return null;
  const hasSizes = (product.sizes ?? []).some((s) => s.trim());
  const hasColors = (product.colors ?? []).some((c) => c.trim());
  if (hasSizes && !item.size?.trim()) return "tamanho";
  if (hasColors && !item.color?.trim()) return "cor";
  return null;
}

// ---------------------------------------------------------------------------
// Níveis de estoque
// ---------------------------------------------------------------------------

/** Estoque de cada variante = soma (com sinal) das movimentações dela. */
export function computeStockLevels(movements: StockMovement[]): Map<string, number> {
  const levels = new Map<string, number>();
  for (const movement of movements) {
    const key = variantKey(movement);
    levels.set(key, (levels.get(key) ?? 0) + movement.quantity);
  }
  return levels;
}

export function getStockLevel(levels: Map<string, number>, variant: VariantRef): number {
  return levels.get(variantKey(variant)) ?? 0;
}

/**
 * Um produto só passa a ter estoque "controlado" quando recebe a primeira
 * movimentação. Antes disso, vender nunca baixa nem bloqueia nada — é isso que
 * mantém o fluxo atual intacto até o usuário decidir começar a controlar.
 */
export function trackedProductIds(movements: StockMovement[]): Set<string> {
  return new Set(movements.map((m) => m.productId));
}

export function stockLevelStatus(level: number, lowStockThreshold: number): StockLevelStatus {
  if (level <= 0) return "esgotado";
  if (level <= lowStockThreshold) return "baixo";
  return "ok";
}

export type VariantStock = {
  variant: VariantRef;
  level: number;
  status: StockLevelStatus;
  /** true quando a variante tem movimentação mas não consta mais em tamanhos/cores do produto (ex.: foi renomeada). */
  undeclared: boolean;
};

/**
 * Estoque de cada variante dos produtos com controle ativo (produtos sem
 * nenhuma movimentação não aparecem). Inclui variantes declaradas no cadastro
 * mesmo que ainda zeradas, e variantes que já têm saldo mas não estão mais
 * declaradas — para o estoque nunca "sumir" por uma mudança de cadastro.
 */
export function listVariantStocks(
  products: Pick<Product, "id" | "sizes" | "colors">[],
  movements: StockMovement[],
  lowStockThreshold: number
): VariantStock[] {
  const levels = computeStockLevels(movements);
  const tracked = trackedProductIds(movements);
  const result: VariantStock[] = [];

  for (const product of products) {
    if (!tracked.has(product.id)) continue;

    const declared = listProductVariants(product);
    const declaredKeys = new Set(declared.map(variantKey));
    for (const variant of declared) {
      const level = getStockLevel(levels, variant);
      result.push({ variant, level, status: stockLevelStatus(level, lowStockThreshold), undeclared: false });
    }

    const seenUndeclared = new Set<string>();
    for (const movement of movements) {
      if (movement.productId !== product.id) continue;
      const key = variantKey(movement);
      if (declaredKeys.has(key) || seenUndeclared.has(key)) continue;
      seenUndeclared.add(key);
      const variant: VariantRef = { productId: product.id, size: movement.size, color: movement.color };
      const level = levels.get(key) ?? 0;
      if (level === 0) continue; // variante antiga já zerada: não polui a lista
      result.push({ variant, level, status: stockLevelStatus(level, lowStockThreshold), undeclared: true });
    }
  }
  return result;
}

/** Resumo de um produto na lista de Produtos: peças somadas e quantas variações precisam de atenção. `undefined` = produto sem controle de estoque. */
export function summarizeProductStock(
  stocks: VariantStock[],
  productId: string
): { units: number; attentionCount: number } | undefined {
  const own = stocks.filter((s) => s.variant.productId === productId);
  if (own.length === 0) return undefined;
  return {
    units: own.reduce((sum, s) => sum + Math.max(s.level, 0), 0),
    attentionCount: own.filter((s) => s.status !== "ok").length,
  };
}

export type StockTotals = {
  /** Peças em estoque (saldos negativos contam como zero). */
  units: number;
  /** Valor em estoque ao custo unitário de cada produto, em centavos. */
  value: number;
  lowCount: number;
  outCount: number;
};

export function summarizeStock(stocks: VariantStock[], getUnitCost: (productId: string) => number): StockTotals {
  let units = 0;
  let value = 0;
  let lowCount = 0;
  let outCount = 0;
  for (const { variant, level, status } of stocks) {
    const available = Math.max(level, 0);
    units += available;
    value += available * getUnitCost(variant.productId);
    if (status === "baixo") lowCount += 1;
    if (status === "esgotado") outCount += 1;
  }
  return { units, value, lowCount, outCount };
}

// ---------------------------------------------------------------------------
// Movimentações manuais
// ---------------------------------------------------------------------------

/** Entrada soma, saída subtrai; a quantidade digitada é sempre positiva. */
export function signedQuantity(kind: Exclude<StockMovementKind, "ajuste">, amount: number): number {
  return kind === "entrada" ? Math.abs(amount) : -Math.abs(amount);
}

/** Contagem real → diferença a lançar. Zero significa que a contagem já bate e nada deve ser lançado. */
export function adjustmentDelta(countedQuantity: number, currentLevel: number): number {
  return Math.round(countedQuantity) - currentLevel;
}

// ---------------------------------------------------------------------------
// Venda → saída de estoque
// ---------------------------------------------------------------------------

export type NewStockMovement = Omit<StockMovement, "id" | "createdAt" | "updatedAt">;

export type SaleMovementPlan = {
  create: NewStockMovement[];
  update: { id: string; changes: Pick<StockMovement, "productId" | "size" | "color" | "quantity" | "date"> }[];
  deleteIds: string[];
};

/**
 * Decide o que fazer com as saídas de estoque de uma venda ao criá-la ou
 * editá-la — mesma ideia de reconcileShippingExpense: nunca duplica, só cria
 * o que falta, atualiza o que mudou e remove o que sobrou.
 *
 * Regras que protegem o fluxo atual:
 *  - Só cria saída para produto com estoque controlado (já tem movimentação).
 *  - Só cria saída para item NOVO da venda. Um item que já existia antes da
 *    edição e não tem saída é de uma venda feita antes do controle de estoque
 *    — editá-la não pode baixar estoque retroativamente.
 *  - Se um item trocar para um produto sem controle, a saída antiga é
 *    removida (em vez de transformar esse produto, sem querer, em "controlado"
 *    com saldo negativo).
 */
export function planSaleMovements(params: {
  saleId: string;
  date: string;
  items: SaleItem[];
  /** Ids dos itens que a venda já tinha antes desta edição (vazio ao criar). */
  previousItemIds: ReadonlySet<string>;
  /** Movimentações que já pertencem a esta venda. */
  existing: StockMovement[];
  isTracked: (productId: string) => boolean;
}): SaleMovementPlan {
  const { saleId, date, items, previousItemIds, existing, isTracked } = params;
  const plan: SaleMovementPlan = { create: [], update: [], deleteIds: [] };

  const existingByItemId = new Map<string, StockMovement>();
  for (const movement of existing) {
    if (movement.saleItemId) existingByItemId.set(movement.saleItemId, movement);
  }
  const currentItemIds = new Set(items.map((item) => item.id));

  for (const movement of existing) {
    if (!movement.saleItemId || !currentItemIds.has(movement.saleItemId)) plan.deleteIds.push(movement.id);
  }

  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;
    const movement = existingByItemId.get(item.id);
    const desired = { productId: item.productId, size: item.size, color: item.color, quantity: -item.quantity, date };

    if (movement) {
      if (movement.productId !== item.productId && !isTracked(item.productId)) {
        plan.deleteIds.push(movement.id);
        continue;
      }
      const changed =
        movement.productId !== desired.productId ||
        movement.size !== desired.size ||
        movement.color !== desired.color ||
        movement.quantity !== desired.quantity ||
        movement.date !== desired.date;
      if (changed) plan.update.push({ id: movement.id, changes: desired });
      continue;
    }

    if (previousItemIds.has(item.id) || !isTracked(item.productId)) continue;
    plan.create.push({
      ...desired,
      kind: "saida",
      saleId,
      saleItemId: item.id,
    });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Aviso de falta de estoque (nunca bloqueia a venda)
// ---------------------------------------------------------------------------

export type StockShortage = VariantRef & {
  requested: number;
  available: number;
};

/**
 * Variantes que a venda pede em quantidade maior do que o estoque. É só um
 * aviso — o estoque pode estar desatualizado e a venda real já aconteceu.
 * Ao editar uma venda, as saídas dela são devolvidas ao saldo antes de comparar
 * (senão a própria venda contaria duas vezes contra o estoque).
 */
export function findStockShortages(params: {
  items: SaleItem[];
  movements: StockMovement[];
  editingSaleId?: string;
  previousItemIds?: ReadonlySet<string>;
}): StockShortage[] {
  const { items, movements, editingSaleId, previousItemIds = new Set<string>() } = params;
  const tracked = trackedProductIds(movements);
  const levels = computeStockLevels(editingSaleId ? movements.filter((m) => m.saleId !== editingSaleId) : movements);
  const itemIdsWithMovement = new Set(movements.map((m) => m.saleItemId).filter(Boolean));

  const requestedByKey = new Map<string, StockShortage>();
  for (const item of items) {
    if (!item.productId || !tracked.has(item.productId)) continue;
    // Item antigo de venda feita antes do controle: não gera saída, então não conta.
    if (previousItemIds.has(item.id) && !itemIdsWithMovement.has(item.id)) continue;
    const key = variantKey(item);
    const entry = requestedByKey.get(key);
    if (entry) entry.requested += item.quantity;
    else
      requestedByKey.set(key, {
        productId: item.productId,
        size: item.size,
        color: item.color,
        requested: item.quantity,
        available: getStockLevel(levels, item),
      });
  }

  return [...requestedByKey.values()].filter((entry) => entry.requested > entry.available);
}
