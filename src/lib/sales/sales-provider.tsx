"use client";

import * as React from "react";
import type { Discount, Sale, SaleItem, SalesChannel } from "./types";
import { salesReducer, EMPTY_SALES_STATE, type SalesAction, type SalesState } from "./sales-reducer";
import {
  buildIncomeTransactionInput,
  calculateSaleBreakdown,
  describeSaleItems,
  reconcileNuvemshopFeeExpense,
  reconcileShippingExpense,
} from "./calculations";
import { useFinance } from "@/lib/finance/finance-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { useSupabaseReducer } from "@/lib/supabase/use-supabase-reducer";
import { diffById } from "@/lib/supabase/diff-collection";
import { deleteSales, fetchSales, upsertSales } from "./repository";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function fetchInitial(userId: string): Promise<SalesState> {
  return { sales: await fetchSales(userId) };
}

async function sync(userId: string, previous: SalesState, next: SalesState): Promise<void> {
  const { inserted, updated, deletedIds } = diffById(previous.sales, next.sales);
  await Promise.all([upsertSales(userId, [...inserted, ...updated]), deleteSales(userId, deletedIds)]);
}

export type NewSaleInput = {
  date: string;
  contactId?: string;
  items: SaleItem[];
  discounts: Discount[];
  shippingCost?: number;
  channel: SalesChannel;
  notes?: string;
};

type SalesContextValue = {
  sales: Sale[];
  addSale: (input: NewSaleInput) => Sale;
  updateSale: (id: string, input: NewSaleInput) => void;
  deleteSale: (id: string) => void;
};

const SalesContext = React.createContext<SalesContextValue | null>(null);

export function SalesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useSupabaseReducer<SalesState, SalesAction>(
    salesReducer,
    EMPTY_SALES_STATE,
    (hydratedState) => ({ type: "HYDRATE" as const, state: hydratedState }),
    fetchInitial,
    sync
  );
  const { addTransaction, updateTransaction, deleteTransaction } = useFinance();
  const { getProduct } = useCatalog();
  const { settings } = useSettings();

  const value = React.useMemo<SalesContextValue>(
    () => ({
      sales: state.sales,

      addSale(input: NewSaleInput): Sale {
        const timestamp = nowISO();
        const saleId = makeId();
        const breakdown = calculateSaleBreakdown({
          items: input.items,
          discounts: input.discounts,
          shippingCost: input.shippingCost ?? 0,
          channel: input.channel,
          nuvemshopFeePercent: settings.nuvemshopFeePercent,
        });
        const description = describeSaleItems(input.items, (id) => getProduct(id)?.name);

        // A venda nunca registra a receita ela mesma — reaproveita o
        // `addTransaction` já existente do Financeiro, então "receita"
        // continua tendo uma única definição.
        const transaction = addTransaction(
          buildIncomeTransactionInput({ date: input.date, totalAmount: breakdown.totalAmount, description, channel: input.channel, saleId })
        );

        // Custo real de frete e taxa do canal nunca reduzem a receita — cada
        // um vira sua própria despesa, só quando de fato há valor.
        const shippingReconciliation = reconcileShippingExpense({
          saleId,
          date: input.date,
          shippingCost: input.shippingCost ?? 0,
          description,
        });
        const shippingTransactionId =
          shippingReconciliation.action === "create" ? addTransaction(shippingReconciliation.input).id : undefined;

        const feeReconciliation = reconcileNuvemshopFeeExpense({ saleId, date: input.date, feeAmount: breakdown.nuvemshopFeeAmount });
        const nuvemshopFeeTransactionId =
          feeReconciliation.action === "create" ? addTransaction(feeReconciliation.input).id : undefined;

        const sale: Sale = {
          id: saleId,
          date: input.date,
          contactId: input.contactId,
          items: input.items,
          discounts: input.discounts,
          shippingAmount: breakdown.shippingAmount,
          shippingCost: input.shippingCost,
          nuvemshopFeeAmount: breakdown.nuvemshopFeeAmount || undefined,
          totalAmount: breakdown.totalAmount,
          channel: input.channel,
          notes: input.notes,
          transactionId: transaction.id,
          shippingTransactionId,
          nuvemshopFeeTransactionId,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        dispatch({ type: "ADD_SALE", sale });
        return sale;
      },

      updateSale(id: string, input: NewSaleInput) {
        const existing = state.sales.find((s) => s.id === id);
        if (!existing) return;
        const timestamp = nowISO();
        const breakdown = calculateSaleBreakdown({
          items: input.items,
          discounts: input.discounts,
          shippingCost: input.shippingCost ?? 0,
          channel: input.channel,
          nuvemshopFeePercent: settings.nuvemshopFeePercent,
        });
        const description = describeSaleItems(input.items, (pid) => getProduct(pid)?.name);

        // Sempre atualiza a mesma transação de receita — nunca cria uma segunda.
        updateTransaction(
          existing.transactionId,
          buildIncomeTransactionInput({ date: input.date, totalAmount: breakdown.totalAmount, description, channel: input.channel, saleId: id })
        );

        // Mesma decisão usada na criação — nunca duplica frete/taxa ao
        // editar, e desvincula/remove quando o valor é zerado.
        const shippingReconciliation = reconcileShippingExpense({
          saleId: id,
          date: input.date,
          shippingCost: input.shippingCost ?? 0,
          description,
          existingShippingTransactionId: existing.shippingTransactionId,
        });
        let shippingTransactionId = existing.shippingTransactionId;
        if (shippingReconciliation.action === "update") {
          updateTransaction(shippingReconciliation.transactionId, shippingReconciliation.input);
        } else if (shippingReconciliation.action === "create") {
          shippingTransactionId = addTransaction(shippingReconciliation.input).id;
        } else if (shippingReconciliation.action === "delete") {
          deleteTransaction(shippingReconciliation.transactionId);
          shippingTransactionId = undefined;
        }

        const feeReconciliation = reconcileNuvemshopFeeExpense({
          saleId: id,
          date: input.date,
          feeAmount: breakdown.nuvemshopFeeAmount,
          existingFeeTransactionId: existing.nuvemshopFeeTransactionId,
        });
        let nuvemshopFeeTransactionId = existing.nuvemshopFeeTransactionId;
        if (feeReconciliation.action === "update") {
          updateTransaction(feeReconciliation.transactionId, feeReconciliation.input);
        } else if (feeReconciliation.action === "create") {
          nuvemshopFeeTransactionId = addTransaction(feeReconciliation.input).id;
        } else if (feeReconciliation.action === "delete") {
          deleteTransaction(feeReconciliation.transactionId);
          nuvemshopFeeTransactionId = undefined;
        }

        dispatch({
          type: "UPDATE_SALE",
          id,
          changes: {
            date: input.date,
            contactId: input.contactId,
            items: input.items,
            discounts: input.discounts,
            shippingAmount: breakdown.shippingAmount,
            shippingCost: input.shippingCost,
            nuvemshopFeeAmount: breakdown.nuvemshopFeeAmount || undefined,
            totalAmount: breakdown.totalAmount,
            channel: input.channel,
            notes: input.notes,
            shippingTransactionId,
            nuvemshopFeeTransactionId,
          },
          at: timestamp,
        });
      },

      deleteSale(id: string) {
        const sale = state.sales.find((s) => s.id === id);
        if (sale) {
          deleteTransaction(sale.transactionId);
          if (sale.shippingTransactionId) deleteTransaction(sale.shippingTransactionId);
          if (sale.nuvemshopFeeTransactionId) deleteTransaction(sale.nuvemshopFeeTransactionId);
        }
        dispatch({ type: "DELETE_SALE", id });
      },
    }),
    [state, dispatch, addTransaction, updateTransaction, deleteTransaction, getProduct, settings.nuvemshopFeePercent]
  );

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales() {
  const ctx = React.useContext(SalesContext);
  if (!ctx) throw new Error("useSales must be used within a SalesProvider");
  return ctx;
}
