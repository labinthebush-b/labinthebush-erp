// Domain types for the Produtos module (Phase 3).
// Monetary values are integers in cents, same convention as lib/finance.

export type ProductStatus = "rascunho" | "ativo" | "arquivado";

export type CostComponent = {
  id: string;
  /** References a Category id from the finance "custo" group (see lib/finance/categories.ts),
   *  reusing the existing vocabulary instead of inventing a parallel one. */
  category: string;
  amount: number;
};

export type Product = {
  id: string;
  name: string;
  status: ProductStatus;
  price?: number;
  costComponents: CostComponent[];
  createdAt: string;
  updatedAt: string;

  // Optional fields, revealed progressively in the UI.
  image?: string;
  /** Página do produto na loja (Nuvemshop) — de onde vêm foto, preço e descrição. */
  storeUrl?: string;
  category?: string;
  collection?: string;
  sku?: string;
  sizes?: string[];
  colors?: string[];
  supplier?: string;
  description?: string;
  notes?: string;
};

export type ProductAdjustment =
  | { kind: "add_component"; component: CostComponent }
  | { kind: "remove_component"; componentId: string }
  | { kind: "price_override"; price: number }
  | { kind: "discount"; amount: number };

export type SimulationResult = {
  baseCost: number;
  simulatedCost: number;
  price: number;
  profit: number;
  marginPercent: number;
  composition: { componentId: string; category: string; amount: number; percent: number }[];
};
