// Read-only tools: every one of these reuses the existing domain
// calculations/repositories exactly as the UI does — no financial rule is
// reimplemented here. `ctx.client` is the admin client resolved for this
// request (see src/lib/ai/context.ts); every fetch below is still filtered
// by `ctx.userId` explicitly, the same defense-in-depth every repository
// already applies.
import type { AiRequestContext } from "../context";
import { fetchTransactions, fetchCustomCategories } from "@/lib/finance/repository";
import { fetchSales } from "@/lib/sales/repository";
import { fetchTasks } from "@/lib/tasks/repository";
import { fetchProducts } from "@/lib/catalog/repository";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import { calculateCaixa, calculateResultado, isPending, type Period } from "@/lib/finance/calculations";
import { formatCurrencyCents } from "@/lib/currency";
import type { Task } from "@/lib/tasks/types";
import type { Product } from "@/lib/catalog/types";

export type QueryPeriodArgs = { start?: string; end?: string };

async function loadCategories(ctx: AiRequestContext) {
  const custom = await fetchCustomCategories(ctx.userId, ctx.client);
  return [...DEFAULT_CATEGORIES, ...custom];
}

export async function getCaixa(ctx: AiRequestContext, period: Period = {}) {
  const transactions = await fetchTransactions(ctx.userId, ctx.client);
  const caixa = calculateCaixa(transactions, period);
  return { caixaCentavos: caixa, caixaFormatado: formatCurrencyCents(caixa), periodo: period };
}

export async function getResultado(ctx: AiRequestContext, period: Period = {}) {
  const [transactions, categories] = await Promise.all([fetchTransactions(ctx.userId, ctx.client), loadCategories(ctx)]);
  const resultado = calculateResultado(transactions, period, categories);
  return {
    periodo: period,
    receitaCentavos: resultado.receita,
    custoProdutosCentavos: resultado.custoProdutos,
    lucroBrutoCentavos: resultado.lucroBruto,
    despesasOperacionaisCentavos: resultado.despesasOperacionais,
    lucroLiquidoCentavos: resultado.lucroLiquido,
    lucroLiquidoFormatado: formatCurrencyCents(resultado.lucroLiquido),
  };
}

export async function getReceitasDespesas(ctx: AiRequestContext, period: Period = {}) {
  const transactions = await fetchTransactions(ctx.userId, ctx.client);
  const inScope = transactions.filter(
    (t) => t.status === "concluido" && (t.type === "income" || t.type === "expense") && (!period.start || t.date >= period.start) && (!period.end || t.date <= period.end)
  );
  return {
    periodo: period,
    total: inScope.length,
    transacoes: inScope.map((t) => ({
      id: t.id,
      tipo: t.type,
      valorCentavos: t.amount,
      valorFormatado: formatCurrencyCents(t.amount),
      data: t.date,
      categoria: t.category,
      descricao: t.description,
    })),
  };
}

export async function getContasAPagarReceber(ctx: AiRequestContext) {
  const transactions = await fetchTransactions(ctx.userId, ctx.client);
  const pending = transactions.filter(isPending);
  const aPagar = pending.filter((t) => t.type === "expense" || t.type === "owner_withdrawal");
  const aReceber = pending.filter((t) => t.type === "income" || t.type === "owner_contribution");

  const mapItem = (t: (typeof pending)[number]) => ({
    id: t.id,
    valorCentavos: t.amount,
    valorFormatado: formatCurrencyCents(t.amount),
    vencimento: t.dueDate ?? t.date,
    descricao: t.description,
    categoria: t.category,
  });

  return {
    aPagar: aPagar.map(mapItem),
    aReceber: aReceber.map(mapItem),
    totalAPagarCentavos: aPagar.reduce((sum, t) => sum + t.amount, 0),
    totalAReceberCentavos: aReceber.reduce((sum, t) => sum + t.amount, 0),
  };
}

export async function getVendas(ctx: AiRequestContext, period: Period = {}) {
  const sales = await fetchSales(ctx.userId, ctx.client);
  const inScope = sales.filter((s) => (!period.start || s.date >= period.start) && (!period.end || s.date <= period.end));
  return {
    periodo: period,
    total: inScope.length,
    valorTotalCentavos: inScope.reduce((sum, s) => sum + s.totalAmount, 0),
    vendas: inScope.map((s) => ({
      id: s.id,
      data: s.date,
      itens: s.items.map((item) => ({ produtoId: item.productId, quantidade: item.quantity })),
      valorTotalCentavos: s.totalAmount,
      valorTotalFormatado: formatCurrencyCents(s.totalAmount),
      canal: s.channel,
    })),
  };
}

export async function getTarefas(ctx: AiRequestContext, args: { status?: Task["status"] } = {}) {
  const tasks = await fetchTasks(ctx.userId, ctx.client);
  const inScope = args.status ? tasks.filter((t) => t.status === args.status) : tasks;
  return {
    total: inScope.length,
    tarefas: inScope.map((t) => ({
      id: t.id,
      titulo: t.title,
      status: t.status,
      prioridade: t.priority,
      vencimento: t.dueDate,
    })),
  };
}

export async function getProdutos(ctx: AiRequestContext, args: { status?: Product["status"] } = {}) {
  const products = await fetchProducts(ctx.userId, ctx.client);
  const inScope = args.status ? products.filter((p) => p.status === args.status) : products;
  return {
    total: inScope.length,
    produtos: inScope.map((p) => ({
      id: p.id,
      nome: p.name,
      status: p.status,
      precoCentavos: p.price,
      precoFormatado: p.price != null ? formatCurrencyCents(p.price) : null,
      sku: p.sku,
    })),
  };
}
