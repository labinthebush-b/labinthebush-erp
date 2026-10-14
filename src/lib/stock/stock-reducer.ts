import type { StockMovement } from "./types";

export type StockState = {
  movements: StockMovement[];
};

export const EMPTY_STOCK_STATE: StockState = { movements: [] };

export type StockAction =
  | { type: "HYDRATE"; state: StockState }
  | { type: "ADD_MOVEMENT"; movement: StockMovement }
  | { type: "ADD_MOVEMENTS"; movements: StockMovement[] }
  | { type: "UPDATE_MOVEMENT"; id: string; changes: Partial<StockMovement>; at: string }
  | { type: "DELETE_MOVEMENTS"; ids: string[] }
  | { type: "DELETE_SALE_MOVEMENTS"; saleId: string };

export function stockReducer(state: StockState, action: StockAction): StockState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;

    case "ADD_MOVEMENT":
      return { ...state, movements: [...state.movements, action.movement] };

    case "ADD_MOVEMENTS":
      if (action.movements.length === 0) return state;
      return { ...state, movements: [...state.movements, ...action.movements] };

    case "UPDATE_MOVEMENT":
      return {
        ...state,
        movements: state.movements.map((m) =>
          m.id === action.id ? { ...m, ...action.changes, updatedAt: action.at } : m
        ),
      };

    case "DELETE_MOVEMENTS": {
      if (action.ids.length === 0) return state;
      const ids = new Set(action.ids);
      return { ...state, movements: state.movements.filter((m) => !ids.has(m.id)) };
    }

    case "DELETE_SALE_MOVEMENTS": {
      if (!state.movements.some((m) => m.saleId === action.saleId)) return state;
      return { ...state, movements: state.movements.filter((m) => m.saleId !== action.saleId) };
    }

    default:
      return state;
  }
}
