import type { Sale } from "@/lib/sales/types";
import type { Product } from "@/lib/catalog/types";
import { allocateItemRevenue, calculateSaleCost } from "@/lib/sales/calculations";
import { calculateCostComposition, calculateProductCost } from "@/lib/catalog/calculations";
import type { PeriodRange } from "./period-range";
import { isWithinRange } from "./period-range";

export type ProductReportRow = {
  productId: string;
  nome: string;
  quantidadeVendida: number;
  faturamento: number;
  custoTotal: number;
  lucro: number;
  margemPercent: number;
  composicaoCusto: ReturnType<typeof calculateCostComposition>;
};

/**
 * Custo e lucro usam o custo ATUAL do produto (mesma regra do módulo de
 * Vendas — ver lib/sales/calculations.ts), não um custo histórico da época
 * da venda, que o sistema não registra.
 */
export function buildProductsReport(sales: Sale[], products: Product[], range: PeriodRange): ProductReportRow[] {
  const inRange = sales.filter((s) => isWithinRange(s.date, range));

  const rows: ProductReportRow[] = [];
  for (const product of products) {
    let quantidadeVendida = 0;
    let faturamento = 0;
    let custoTotal = 0;
    for (const sale of inRange) {
      for (const item of sale.items) {
        if (item.productId !== product.id) continue;
        quantidadeVendida += item.quantity;
        faturamento += allocateItemRevenue(sale, item);
        custoTotal += calculateSaleCost(product, item.quantity);
      }
    }
    if (quantidadeVendida === 0 && faturamento === 0) continue;
    const lucro = faturamento - custoTotal;

    rows.push({
      productId: product.id,
      nome: product.name,
      quantidadeVendida,
      faturamento,
      custoTotal,
      lucro,
      margemPercent: faturamento > 0 ? (lucro / faturamento) * 100 : 0,
      composicaoCusto: calculateCostComposition(product.costComponents),
    });
  }

  return rows.sort((a, b) => b.faturamento - a.faturamento);
}

/** Products whose current margin (price vs. cost) is at or below `thresholdPercent`. */
export function productsBelowMargin(products: Product[], thresholdPercent: number) {
  return products
    .filter((p) => p.price && p.price > 0)
    .map((p) => {
      const cost = calculateProductCost(p.costComponents);
      const margemPercent = ((p.price! - cost) / p.price!) * 100;
      return { productId: p.id, nome: p.name, margemPercent };
    })
    .filter((p) => p.margemPercent <= thresholdPercent);
}
