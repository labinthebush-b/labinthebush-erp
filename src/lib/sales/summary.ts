import type { Product } from "@/lib/catalog/types";
import { isWithinRange, type PeriodRange } from "@/lib/reports/period-range";
import { calculateSaleProfit } from "./calculations";
import type { SalePaymentStatus } from "./payment";
import type { Sale } from "./types";

export type SalesSummary = {
  /** Vendas do período (exclui canceladas e sem lançamento). */
  count: number;
  /** Soma do total pago/devido pelos clientes nas vendas do período. */
  revenue: number;
  /** Receita ÷ nº de vendas; 0 quando não há vendas. */
  averageTicket: number;
  /** Soma do lucro estimado (receita − custo dos produtos) das vendas do período. */
  profit: number;
  /**
   * Total em aberto de TODAS as vendas pendentes, de qualquer data — dívida
   * de cliente não "vence" quando vira o mês, então este número deliberadamente
   * não respeita o período.
   */
  receivable: number;
  receivableCount: number;
};

/** Vendas canceladas ou sem lançamento no Financeiro não contam como venda. */
function countsAsSale(status: SalePaymentStatus): boolean {
  return status === "pago" || status === "pendente";
}

export function summarizeSales(
  sales: Sale[],
  statusOf: (sale: Sale) => SalePaymentStatus,
  getProduct: (id: string) => Product | undefined,
  range: PeriodRange
): SalesSummary {
  let count = 0;
  let revenue = 0;
  let profit = 0;
  let receivable = 0;
  let receivableCount = 0;

  for (const sale of sales) {
    const status = statusOf(sale);
    if (!countsAsSale(status)) continue;

    if (status === "pendente") {
      receivable += sale.totalAmount;
      receivableCount += 1;
    }
    if (isWithinRange(sale.date, range)) {
      count += 1;
      revenue += sale.totalAmount;
      profit += calculateSaleProfit(sale, getProduct);
    }
  }

  return {
    count,
    revenue,
    averageTicket: count > 0 ? Math.round(revenue / count) : 0,
    profit,
    receivable,
    receivableCount,
  };
}
