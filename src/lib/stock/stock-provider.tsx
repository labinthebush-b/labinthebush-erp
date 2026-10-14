"use client";

import * as React from "react";
import type { SaleItem } from "@/lib/sales/types";
import type { StockMovement, StockMovementKind, VariantRef } from "./types";
import { EMPTY_STOCK_STATE, stockReducer, type StockAction, type StockState } from "./stock-reducer";
import { computeStockLevels, getStockLevel, planSaleMovements, trackedProductIds } from "./calculations";
import { useSupabaseReducer } from "@/lib/supabase/use-supabase-reducer";
import { diffById } from "@/lib/supabase/diff-collection";
import { deleteStockMovements, fetchStockMovements, upsertStockMovements } from "./repository";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function fetchInitial(userId: string): Promise<StockState> {
  return { movements: await fetchStockMovements(userId) };
}

async function sync(userId: string, previous: StockState, next: StockState): Promise<void> {
  const { inserted, updated, deletedIds } = diffById(previous.movements, next.movements);
  await Promise.all([upsertStockMovements(userId, [...inserted, ...updated]), deleteStockMovements(userId, deletedIds)]);
}

export type NewStockMovementInput = {
  productId: string;
  size?: string;
  color?: string;
  kind: StockMovementKind;
  /** Já com sinal e nunca zero: positivo entra, negativo sai. */
  quantity: number;
  date: string;
  note?: string;
};

type StockContextValue = {
  movements: StockMovement[];
  /** Saldo atual de uma variante (soma das movimentações). 0 quando nunca foi movimentada. */
  getLevel: (variant: VariantRef) => number;
  /** O produto já recebeu alguma movimentação, ou seja, o estoque dele é controlado. */
  isTracked: (productId: string) => boolean;
  addMovement: (input: NewStockMovementInput) => StockMovement;
  deleteMovement: (id: string) => void;
  /** Usado pelas vendas: cria/atualiza/remove as saídas de estoque dos itens (ver planSaleMovements). */
  syncSaleMovements: (params: { saleId: string; date: string; items: SaleItem[]; previousItemIds: ReadonlySet<string> }) => void;
  /** Usado ao excluir uma venda: devolve ao estoque tudo que ela tinha baixado. */
  removeSaleMovements: (saleId: string) => void;
};

const StockContext = React.createContext<StockContextValue | null>(null);

export function StockProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useSupabaseReducer<StockState, StockAction>(
    stockReducer,
    EMPTY_STOCK_STATE,
    (hydratedState) => ({ type: "HYDRATE" as const, state: hydratedState }),
    fetchInitial,
    sync
  );

  const value = React.useMemo<StockContextValue>(() => {
    const levels = computeStockLevels(state.movements);
    const tracked = trackedProductIds(state.movements);

    return {
      movements: state.movements,

      getLevel: (variant) => getStockLevel(levels, variant),
      isTracked: (productId) => tracked.has(productId),

      addMovement(input) {
        const timestamp = nowISO();
        const movement: StockMovement = { id: makeId(), ...input, createdAt: timestamp, updatedAt: timestamp };
        dispatch({ type: "ADD_MOVEMENT", movement });
        return movement;
      },

      deleteMovement(id) {
        dispatch({ type: "DELETE_MOVEMENTS", ids: [id] });
      },

      syncSaleMovements({ saleId, date, items, previousItemIds }) {
        const plan = planSaleMovements({
          saleId,
          date,
          items,
          previousItemIds,
          existing: state.movements.filter((m) => m.saleId === saleId),
          isTracked: (productId) => tracked.has(productId),
        });
        const timestamp = nowISO();
        if (plan.deleteIds.length > 0) dispatch({ type: "DELETE_MOVEMENTS", ids: plan.deleteIds });
        for (const { id, changes } of plan.update) dispatch({ type: "UPDATE_MOVEMENT", id, changes, at: timestamp });
        if (plan.create.length > 0) {
          dispatch({
            type: "ADD_MOVEMENTS",
            movements: plan.create.map((m) => ({ id: makeId(), ...m, createdAt: timestamp, updatedAt: timestamp })),
          });
        }
      },

      removeSaleMovements(saleId) {
        dispatch({ type: "DELETE_SALE_MOVEMENTS", saleId });
      },
    };
  }, [state, dispatch]);

  return <StockContext.Provider value={value}>{children}</StockContext.Provider>;
}

export function useStock() {
  const ctx = React.useContext(StockContext);
  if (!ctx) throw new Error("useStock must be used within a StockProvider");
  return ctx;
}
