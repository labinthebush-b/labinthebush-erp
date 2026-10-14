import { calculateProductCost } from "@/lib/catalog/calculations";
import type { Product } from "@/lib/catalog/types";
import type { NewTransactionInput } from "@/lib/finance/actions";
import { paymentToTransactionFields, type SalePaymentInput } from "./payment";
import type { Discount, Sale, SaleItem, SalesChannel } from "./types";

// ---------------------------------------------------------------------------
// Itens da venda (múltiplos produtos)
// ---------------------------------------------------------------------------

let itemIdCounter = 0;
function makeItemId(): string {
  itemIdCounter += 1;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `item-${Date.now()}-${itemIdCounter}`;
}

/**
 * O único jeito de criar um SaleItem — `subtotal` é sempre `quantity *
 * unitPrice`, nunca um valor digitado à parte. É assim que "não permitir
 * valores inconsistentes entre quantidade, preço e subtotal" é garantido: a
 * inconsistência simplesmente não é representável.
 */
export function buildSaleItem(input: { id?: string; productId: string; quantity: number; unitPrice: number }): SaleItem {
  return {
    id: input.id ?? makeItemId(),
    productId: input.productId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    subtotal: input.quantity * input.unitPrice,
  };
}

export function calculateItemsSubtotal(items: SaleItem[]): number {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

/** Cost of goods for one item, based on the product's current cost structure. */
export function calculateSaleCost(product: Product, quantity: number): number {
  return calculateProductCost(product.costComponents) * quantity;
}

/** Custo total (COGS) de todos os itens de uma venda cujo produto ainda existe no catálogo. */
export function calculateItemsCost(items: SaleItem[], getProduct: (id: string) => Product | undefined): number {
  return items.reduce((sum, item) => {
    const product = getProduct(item.productId);
    return sum + (product ? calculateSaleCost(product, item.quantity) : 0);
  }, 0);
}

/** Lucro da venda inteira: total pago pelo cliente menos o custo de todos os itens (frete/taxa são despesas próprias, não entram aqui — ver reconcileShippingExpense/reconcileNuvemshopFeeExpense). */
export function calculateSaleProfit(sale: Sale, getProduct: (id: string) => Product | undefined): number {
  return sale.totalAmount - calculateItemsCost(sale.items, getProduct);
}

/**
 * Resultado da venda depois de TUDO que ela custou: produtos, frete real e
 * taxa do canal. É o "lucro de verdade" — `calculateSaleProfit` (acima) mantém
 * a definição histórica (receita − produtos) usada nas listas e relatórios,
 * enquanto esta é a que o detalhe do pedido mostra ao lado dela.
 */
export function calculateSaleContribution(sale: Sale, getProduct: (id: string) => Product | undefined): number {
  return calculateSaleProfit(sale, getProduct) - (sale.shippingCost ?? 0) - (sale.nuvemshopFeeAmount ?? 0);
}

/**
 * Parte do `totalAmount` da venda atribuível a um item específico,
 * proporcional ao peso do subtotal desse item sobre o subtotal da venda toda
 * — usada pelos relatórios por produto para não estourar/faltar receita
 * quando há mais de um produto na mesma venda. Para uma venda de um item só,
 * isso sempre devolve o totalAmount inteiro (nenhuma mudança de comportamento
 * para vendas antigas).
 */
export function allocateItemRevenue(sale: Sale, item: SaleItem): number {
  const subtotalTotal = calculateItemsSubtotal(sale.items);
  if (subtotalTotal <= 0) {
    return sale.items.length > 0 ? Math.round(sale.totalAmount / sale.items.length) : 0;
  }
  return Math.round((sale.totalAmount * item.subtotal) / subtotalTotal);
}

/** Nome do produto (item único) ou "N produtos" (múltiplos) — usado em qualquer lugar que hoje mostra "o produto da venda". */
export function describeSaleItems(items: SaleItem[], getProductName: (id: string) => string | undefined): string {
  if (items.length === 0) return "Produto";
  if (items.length === 1) return getProductName(items[0].productId) ?? "Produto removido";
  return `${items.length} produtos`;
}

// ---------------------------------------------------------------------------
// Financeiro (receita da venda + despesas próprias vinculadas)
// ---------------------------------------------------------------------------

/**
 * Translates a sale into the input shape the existing Financeiro `addTransaction`
 * expects — this is the single integration point between Vendas e Financeiro,
 * so the meaning of "receita" is defined once, em lib/finance, e reutilizada aqui.
 */
export function buildIncomeTransactionInput(input: {
  date: string;
  totalAmount: number;
  description: string;
  channel: string;
  saleId?: string;
  /** "pago" (padrão) entra no caixa; "pendente" entra em "A receber" até ser marcada como paga. */
  payment?: SalePaymentInput;
}): NewTransactionInput {
  const { status, dueDate } = paymentToTransactionFields(input.payment ?? "pago", input.date);
  return {
    type: "income",
    amount: input.totalAmount,
    date: input.date,
    category: "venda", // Category["id"] from lib/finance/categories.ts (group "receita")
    description: `Venda — ${input.description} (${input.channel})`,
    paymentSource: "conta_marca",
    status,
    dueDate,
    relations: input.saleId ? { saleId: input.saleId } : undefined,
  };
}

/**
 * O cliente pagar R$0 de frete (frete grátis) não significa que a marca teve
 * custo R$0 — o custo real vira uma despesa própria (categoria "frete", já
 * tratada como custo/COGS pelo Financeiro), nunca um abatimento da receita.
 * A venda continua sendo uma única receita; isto é sempre uma segunda
 * transação, de despesa, vinculada à venda via relations.saleId.
 */
export function buildShippingExpenseTransactionInput(input: {
  saleId: string;
  date: string;
  shippingCost: number;
  description: string;
  /** Se o frete já foi pago no momento do registro. Default: pendente. */
  settled?: boolean;
}): NewTransactionInput {
  return {
    type: "expense",
    amount: input.shippingCost,
    date: input.date,
    category: "frete", // Category["id"] from lib/finance/categories.ts (group "custo")
    description: `Frete — ${input.description}`,
    paymentSource: "conta_marca",
    status: input.settled ? "concluido" : "pendente",
    dueDate: input.settled ? undefined : input.date,
    relations: { saleId: input.saleId },
  };
}

/**
 * Taxa cobrada pelo canal (hoje só Nuvemshop) sobre a venda — uma despesa
 * própria, categoria "taxas" (grupo custo), separada da receita e do custo
 * dos produtos, exatamente como o frete. Ver calculateNuvemshopFee para como
 * o valor é obtido.
 */
export function buildNuvemshopFeeExpenseTransactionInput(input: {
  saleId: string;
  date: string;
  feeAmount: number;
  settled?: boolean;
}): NewTransactionInput {
  return {
    type: "expense",
    amount: input.feeAmount,
    date: input.date,
    category: "taxas", // Category["id"] from lib/finance/categories.ts (group "custo")
    description: "Taxa Nuvemshop",
    paymentSource: "conta_marca",
    status: input.settled ? "concluido" : "pendente",
    dueDate: input.settled ? undefined : input.date,
    relations: { saleId: input.saleId },
  };
}

export type LinkedExpenseReconciliation =
  | { action: "none" }
  | { action: "create"; input: NewTransactionInput }
  | { action: "update"; transactionId: string; input: NewTransactionInput }
  | { action: "delete"; transactionId: string };

/**
 * Decide o que fazer com uma despesa própria vinculada a uma venda (frete ou
 * taxa de canal), dado o valor atual e a despesa já vinculada (se houver) —
 * nunca cria uma segunda despesa quando já existe uma (só atualiza), e
 * remove/desvincula quando o valor é zerado. Compartilhada entre
 * reconcileShippingExpense e reconcileNuvemshopFeeExpense para que "editar
 * sem duplicar" e "remover o custo" tenham uma única definição.
 */
function reconcileLinkedExpense(params: {
  amount: number;
  existingTransactionId?: string;
  buildInput: () => NewTransactionInput;
}): LinkedExpenseReconciliation {
  const { amount, existingTransactionId, buildInput } = params;
  if (amount > 0 && existingTransactionId) {
    return { action: "update", transactionId: existingTransactionId, input: buildInput() };
  }
  if (amount > 0 && !existingTransactionId) {
    return { action: "create", input: buildInput() };
  }
  if (amount <= 0 && existingTransactionId) {
    return { action: "delete", transactionId: existingTransactionId };
  }
  return { action: "none" };
}

export function reconcileShippingExpense(params: {
  saleId: string;
  date: string;
  shippingCost: number;
  description: string;
  existingShippingTransactionId?: string;
}): LinkedExpenseReconciliation {
  return reconcileLinkedExpense({
    amount: params.shippingCost,
    existingTransactionId: params.existingShippingTransactionId,
    buildInput: () =>
      buildShippingExpenseTransactionInput({
        saleId: params.saleId,
        date: params.date,
        shippingCost: params.shippingCost,
        description: params.description,
      }),
  });
}

export function reconcileNuvemshopFeeExpense(params: {
  saleId: string;
  date: string;
  feeAmount: number;
  existingFeeTransactionId?: string;
}): LinkedExpenseReconciliation {
  return reconcileLinkedExpense({
    amount: params.feeAmount,
    existingTransactionId: params.existingFeeTransactionId,
    buildInput: () =>
      buildNuvemshopFeeExpenseTransactionInput({ saleId: params.saleId, date: params.date, feeAmount: params.feeAmount }),
  });
}

// ---------------------------------------------------------------------------
// Descontos acumulativos
// ---------------------------------------------------------------------------

/**
 * Desconto efetivamente concedido sobre o subtotal, a partir da estrutura do
 * cupom. Frete grátis não desconta o preço do produto — ele zera o frete
 * cobrado (ver calculateShippingCharged), então aqui não gera desconto.
 */
export function calculateDiscountAmount(subtotal: number, discount?: Discount): number {
  if (!discount) return 0;
  if (discount.kind === "percentual") {
    return Math.round((subtotal * (discount.percent ?? 0)) / 100);
  }
  if (discount.kind === "valor_fixo") {
    return Math.min(discount.amount ?? 0, subtotal);
  }
  return 0; // frete_gratis
}

/**
 * Descontos acumulativos: cada um é calculado independentemente sobre o
 * subtotal original (não em cascata sobre o valor já descontado) e depois
 * somados — é o que faz "10% + R$20 sobre R$348" resultar em R$34,80 + R$20 =
 * R$54,80 de desconto total, e não 10% de (348-20).
 */
export function calculateDiscountsTotal(subtotal: number, discounts: Discount[]): number {
  return discounts.reduce((sum, discount) => sum + calculateDiscountAmount(subtotal, discount), 0);
}

export function hasFreeShippingDiscount(discounts: Discount[]): boolean {
  return discounts.some((d) => d.kind === "frete_gratis");
}

/** Frete efetivamente cobrado do cliente — zero quando algum desconto é frete grátis, senão igual ao custo real. */
export function calculateShippingCharged(shippingCost: number, discounts: Discount[]): number {
  return hasFreeShippingDiscount(discounts) ? 0 : shippingCost;
}

/** Só pode haver um desconto de frete grátis por venda — outros descontos (percentual, valor fixo) continuam livres para acumular. */
export function validateDiscounts(discounts: Discount[]): string | null {
  const freeShippingCount = discounts.filter((d) => d.kind === "frete_gratis").length;
  if (freeShippingCount > 1) return "Só é possível ter um desconto de frete grátis por venda.";
  return null;
}

// ---------------------------------------------------------------------------
// Taxa do canal (Nuvemshop)
// ---------------------------------------------------------------------------

/**
 * Taxa do canal sobre o valor pago pelo cliente — só se aplica ao canal
 * Nuvemshop, e só quando a taxa está configurada (feePercent > 0) em
 * Configurações. `feePercent` já vem de lib/settings (nunca inventado aqui).
 */
export function calculateNuvemshopFee(totalAmount: number, channel: SalesChannel, feePercent: number): number {
  if (channel !== "nuvemshop" || feePercent <= 0) return 0;
  return Math.round((totalAmount * feePercent) / 100);
}

// ---------------------------------------------------------------------------
// Breakdown da venda
// ---------------------------------------------------------------------------

export type SaleBreakdown = {
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  shippingCost: number;
  totalAmount: number;
  nuvemshopFeeAmount: number;
};

/**
 * Separa com clareza os valores de uma venda: PRODUTOS (subtotal dos itens),
 * DESCONTOS (acumulados), FRETE (cobrado do cliente) e VENDA (total pago) —
 * e, à parte, o CUSTO DO CANAL (taxa Nuvemshop). `totalAmount` é o único
 * número que vira receita no Financeiro (buildIncomeTransactionInput); a
 * taxa do canal e o custo real de frete são despesas próprias separadas
 * (ver reconcileShippingExpense/reconcileNuvemshopFeeExpense), nunca um
 * abatimento da receita.
 */
export function calculateSaleBreakdown(params: {
  items: SaleItem[];
  discounts: Discount[];
  shippingCost: number;
  channel: SalesChannel;
  nuvemshopFeePercent: number;
}): SaleBreakdown {
  const subtotal = calculateItemsSubtotal(params.items);
  const discountAmount = calculateDiscountsTotal(subtotal, params.discounts);
  const shippingAmount = calculateShippingCharged(params.shippingCost, params.discounts);
  const totalAmount = Math.max(0, subtotal - discountAmount) + shippingAmount;
  const nuvemshopFeeAmount = calculateNuvemshopFee(totalAmount, params.channel, params.nuvemshopFeePercent);
  return { subtotal, discountAmount, shippingAmount, shippingCost: params.shippingCost, totalAmount, nuvemshopFeeAmount };
}

// ---------------------------------------------------------------------------
// Histórico do contato
// ---------------------------------------------------------------------------

export type ContactHistory = {
  totalPurchased: number;
  purchaseCount: number;
  lastPurchaseDate?: string;
};

export function aggregateContactHistory(sales: Sale[], contactId: string): ContactHistory {
  const contactSales = sales.filter((s) => s.contactId === contactId);
  const totalPurchased = contactSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const lastPurchaseDate = contactSales
    .map((s) => s.date)
    .sort()
    .at(-1);

  return { totalPurchased, purchaseCount: contactSales.length, lastPurchaseDate };
}
