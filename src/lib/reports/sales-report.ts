import type { Sale, SalesChannel } from "@/lib/sales/types";
import type { Product } from "@/lib/catalog/types";
import type { Contact } from "@/lib/contacts/types";
import { allocateItemRevenue } from "@/lib/sales/calculations";
import type { PeriodRange } from "./period-range";
import { isWithinRange } from "./period-range";

export type SalesReport = {
  faturamento: number;
  quantidade: number;
  ticketMedio: number;
  porCanal: { canal: SalesChannel; faturamento: number; quantidade: number }[];
  porProduto: { productId: string; nome: string; faturamento: number; quantidade: number }[];
  porContato: { contactId: string; nome: string; faturamento: number; quantidade: number }[];
  cupons: { codigo: string; usos: number; faturamento: number }[];
};

export function buildSalesReport(
  sales: Sale[],
  products: Product[],
  contacts: Contact[],
  range: PeriodRange
): SalesReport {
  const inRange = sales.filter((s) => isWithinRange(s.date, range));

  const faturamento = inRange.reduce((sum, s) => sum + s.totalAmount, 0);
  const quantidade = inRange.length;
  const ticketMedio = quantidade > 0 ? Math.round(faturamento / quantidade) : 0;

  const porCanalMap = new Map<SalesChannel, { faturamento: number; quantidade: number }>();
  for (const sale of inRange) {
    const entry = porCanalMap.get(sale.channel) ?? { faturamento: 0, quantidade: 0 };
    entry.faturamento += sale.totalAmount;
    entry.quantidade += 1;
    porCanalMap.set(sale.channel, entry);
  }
  const porCanal = [...porCanalMap.entries()]
    .map(([canal, v]) => ({ canal, ...v }))
    .sort((a, b) => b.faturamento - a.faturamento);

  const porProdutoMap = new Map<string, { faturamento: number; quantidade: number }>();
  for (const sale of inRange) {
    for (const item of sale.items) {
      const entry = porProdutoMap.get(item.productId) ?? { faturamento: 0, quantidade: 0 };
      entry.faturamento += allocateItemRevenue(sale, item);
      entry.quantidade += item.quantity;
      porProdutoMap.set(item.productId, entry);
    }
  }
  const porProduto = [...porProdutoMap.entries()]
    .map(([productId, v]) => ({ productId, nome: products.find((p) => p.id === productId)?.name ?? "Produto removido", ...v }))
    .sort((a, b) => b.faturamento - a.faturamento);

  const porContatoMap = new Map<string, { faturamento: number; quantidade: number }>();
  for (const sale of inRange) {
    if (!sale.contactId) continue;
    const entry = porContatoMap.get(sale.contactId) ?? { faturamento: 0, quantidade: 0 };
    entry.faturamento += sale.totalAmount;
    entry.quantidade += 1;
    porContatoMap.set(sale.contactId, entry);
  }
  const porContato = [...porContatoMap.entries()]
    .map(([contactId, v]) => ({ contactId, nome: contacts.find((c) => c.id === contactId)?.name ?? "Contato removido", ...v }))
    .sort((a, b) => b.faturamento - a.faturamento);

  const cuponsMap = new Map<string, { usos: number; faturamento: number }>();
  for (const sale of inRange) {
    for (const discount of sale.discounts) {
      if (!discount.code) continue;
      const entry = cuponsMap.get(discount.code) ?? { usos: 0, faturamento: 0 };
      entry.usos += 1;
      entry.faturamento += sale.totalAmount;
      cuponsMap.set(discount.code, entry);
    }
  }
  const cupons = [...cuponsMap.entries()]
    .map(([codigo, v]) => ({ codigo, ...v }))
    .sort((a, b) => b.usos - a.usos);

  return { faturamento, quantidade, ticketMedio, porCanal, porProduto, porContato, cupons };
}
