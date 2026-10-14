// Monta TODOS os registros de uma venda nova — a venda, a receita no
// Financeiro, as despesas de frete/taxa e as saídas de estoque — a partir das
// mesmas funções que o SalesProvider usa na tela. É o caminho usado fora do
// navegador (integração com IA), para uma venda registrada por lá ficar
// idêntica a uma feita pelo formulário.

import { buildTransaction } from "@/lib/finance/actions";
import type { Transaction } from "@/lib/finance/types";
import { planSaleMovements } from "@/lib/stock/calculations";
import type { StockMovement } from "@/lib/stock/types";
import {
  buildIncomeTransactionInput,
  calculateSaleBreakdown,
  describeSaleItems,
  reconcileNuvemshopFeeExpense,
  reconcileShippingExpense,
} from "./calculations";
import type { SalePaymentInput } from "./payment";
import type { Discount, Sale, SaleItem, SalesChannel } from "./types";

export type SaleRecordsInput = {
  date: string;
  contactId?: string;
  items: SaleItem[];
  discounts: Discount[];
  shippingCost: number;
  channel: SalesChannel;
  notes?: string;
  payment: SalePaymentInput;
};

export function buildSaleRecords(params: {
  input: SaleRecordsInput;
  saleId: string;
  now: string;
  nuvemshopFeePercent: number;
  productName: (id: string) => string | undefined;
  isTracked: (productId: string) => boolean;
  makeId: () => string;
}): { sale: Sale; transactions: Transaction[]; movements: StockMovement[] } {
  const { input, saleId, now } = params;
  const breakdown = calculateSaleBreakdown({
    items: input.items,
    discounts: input.discounts,
    shippingCost: input.shippingCost,
    channel: input.channel,
    nuvemshopFeePercent: params.nuvemshopFeePercent,
  });
  const description = describeSaleItems(input.items, params.productName);

  const income = buildTransaction(
    buildIncomeTransactionInput({ date: input.date, totalAmount: breakdown.totalAmount, description, channel: input.channel, saleId, payment: input.payment })
  );
  const transactions: Transaction[] = [income];

  const shipping = reconcileShippingExpense({ saleId, date: input.date, shippingCost: input.shippingCost, description });
  const shippingTx = shipping.action === "create" ? buildTransaction(shipping.input) : undefined;
  if (shippingTx) transactions.push(shippingTx);

  const fee = reconcileNuvemshopFeeExpense({ saleId, date: input.date, feeAmount: breakdown.nuvemshopFeeAmount });
  const feeTx = fee.action === "create" ? buildTransaction(fee.input) : undefined;
  if (feeTx) transactions.push(feeTx);

  const sale: Sale = {
    id: saleId,
    date: input.date,
    contactId: input.contactId,
    items: input.items,
    discounts: input.discounts,
    shippingAmount: breakdown.shippingAmount,
    shippingCost: input.shippingCost || undefined,
    nuvemshopFeeAmount: breakdown.nuvemshopFeeAmount || undefined,
    totalAmount: breakdown.totalAmount,
    channel: input.channel,
    notes: input.notes,
    transactionId: income.id,
    shippingTransactionId: shippingTx?.id,
    nuvemshopFeeTransactionId: feeTx?.id,
    createdAt: now,
    updatedAt: now,
  };

  const plan = planSaleMovements({ saleId, date: input.date, items: input.items, previousItemIds: new Set(), existing: [], isTracked: params.isTracked });
  const movements: StockMovement[] = plan.create.map((m) => ({ id: params.makeId(), ...m, createdAt: now, updatedAt: now }));

  return { sale, transactions, movements };
}
