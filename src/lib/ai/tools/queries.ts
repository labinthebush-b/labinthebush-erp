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
import { fetchContacts } from "@/lib/contacts/repository";
import { fetchStockMovements } from "@/lib/stock/repository";
import { fetchCampaigns, fetchPostLinks } from "@/lib/campaigns/repository";
import { listVariantStocks, summarizeStock, variantLabel } from "@/lib/stock/calculations";
import { calculateProductCost } from "@/lib/catalog/calculations";
import { aggregateContactHistory, calculateSaleProfit } from "@/lib/sales/calculations";
import { PAYMENT_LABELS, getSalePaymentStatus, indexTransactionsById } from "@/lib/sales/payment";
import { resolveStageId, type PipelineStage } from "@/lib/contacts/pipeline";
import { campaignStatus } from "@/lib/campaigns/calculations";
import { DEFAULT_SETTINGS } from "@/lib/settings/types";
import { fetchGa4Summary } from "@/lib/marketing/ga4";
import { fetchInstagramSummary } from "@/lib/marketing/instagram";

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

/** Configurações usadas pelas ferramentas (lidas direto da linha, com o cliente da requisição). */
export async function loadAiSettings(ctx: AiRequestContext) {
  const { data, error } = await ctx.client
    .from("settings")
    .select("nuvemshop_fee_bps, low_stock_threshold, pipeline_stages")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as { nuvemshop_fee_bps?: number; low_stock_threshold?: number; pipeline_stages?: PipelineStage[] };
  return {
    nuvemshopFeePercent: (row.nuvemshop_fee_bps ?? 0) / 100,
    lowStockThreshold: row.low_stock_threshold ?? DEFAULT_SETTINGS.lowStockThreshold,
    pipelineStages: row.pipeline_stages?.length ? row.pipeline_stages : DEFAULT_SETTINGS.pipelineStages,
  };
}

export async function getVendas(ctx: AiRequestContext, period: Period = {}) {
  const [sales, transactions, products, contacts] = await Promise.all([
    fetchSales(ctx.userId, ctx.client),
    fetchTransactions(ctx.userId, ctx.client),
    fetchProducts(ctx.userId, ctx.client),
    fetchContacts(ctx.userId, ctx.client),
  ]);
  const byTx = indexTransactionsById(transactions);
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Produto removido";
  const inScope = sales.filter((s) => (!period.start || s.date >= period.start) && (!period.end || s.date <= period.end));
  return {
    periodo: period,
    total: inScope.length,
    valorTotalCentavos: inScope.reduce((sum, s) => sum + s.totalAmount, 0),
    vendas: inScope.map((s) => ({
      id: s.id,
      data: s.date,
      cliente: s.contactId ? contacts.find((c) => c.id === s.contactId)?.name ?? null : null,
      itens: s.items.map((item) => ({
        produtoId: item.productId,
        produto: productName(item.productId),
        tamanho: item.size ?? null,
        cor: item.color ?? null,
        quantidade: item.quantity,
        precoUnitarioCentavos: item.unitPrice,
      })),
      valorTotalCentavos: s.totalAmount,
      valorTotalFormatado: formatCurrencyCents(s.totalAmount),
      lucroEstimadoCentavos: calculateSaleProfit(s, (id) => products.find((p) => p.id === id)),
      canal: s.channel,
      pagamento: PAYMENT_LABELS[getSalePaymentStatus(s, byTx)],
    })),
  };
}

export async function getEstoque(ctx: AiRequestContext) {
  const [products, movements, settings] = await Promise.all([
    fetchProducts(ctx.userId, ctx.client),
    fetchStockMovements(ctx.userId, ctx.client),
    loadAiSettings(ctx),
  ]);
  const active = products.filter((p) => p.status !== "arquivado");
  const stocks = listVariantStocks(active, movements, settings.lowStockThreshold);
  const totals = summarizeStock(stocks, (id) => calculateProductCost(products.find((p) => p.id === id)?.costComponents ?? []));
  const tracked = new Set(stocks.map((s) => s.variant.productId));
  return {
    limiteEstoqueBaixo: settings.lowStockThreshold,
    pecasEmEstoque: totals.units,
    valorEmEstoqueCentavos: totals.value,
    variacoesComEstoqueBaixo: totals.lowCount,
    variacoesEsgotadas: totals.outCount,
    variacoes: stocks.map((s) => ({
      produtoId: s.variant.productId,
      produto: products.find((p) => p.id === s.variant.productId)?.name,
      tamanho: s.variant.size ?? null,
      cor: s.variant.color ?? null,
      variacao: variantLabel(s.variant),
      estoque: s.level,
      situacao: s.status,
    })),
    produtosSemControleDeEstoque: active.filter((p) => !tracked.has(p.id)).map((p) => p.name),
  };
}

export async function getContatos(ctx: AiRequestContext, args: { busca?: string } = {}) {
  const [contacts, sales, settings] = await Promise.all([fetchContacts(ctx.userId, ctx.client), fetchSales(ctx.userId, ctx.client), loadAiSettings(ctx)]);
  const term = args.busca?.trim().toLowerCase();
  const inScope = term
    ? contacts.filter((c) => [c.name, c.whatsapp, c.instagram, c.email].some((v) => v?.toLowerCase().includes(term)))
    : contacts;
  return {
    total: inScope.length,
    contatos: inScope.map((c) => {
      const stageId = resolveStageId(c, settings.pipelineStages);
      const history = aggregateContactHistory(sales, c.id);
      return {
        id: c.id,
        nome: c.name,
        estagio: settings.pipelineStages.find((s) => s.id === stageId)?.label ?? stageId,
        whatsapp: c.whatsapp ?? null,
        instagram: c.instagram ?? null,
        email: c.email ?? null,
        tags: (c.tags ?? []).map((t) => t.label),
        totalCompradoCentavos: history.totalPurchased,
        numeroDeCompras: history.purchaseCount,
        ultimaCompra: history.lastPurchaseDate ?? null,
      };
    }),
  };
}

export async function getCampanhas(ctx: AiRequestContext) {
  const [campaigns, posts] = await Promise.all([fetchCampaigns(ctx.userId, ctx.client), fetchPostLinks(ctx.userId, ctx.client)]);
  const today = new Date().toISOString().slice(0, 10);
  return {
    total: campaigns.length,
    campanhas: campaigns.map((c) => ({
      id: c.id,
      nome: c.name,
      canal: c.channel,
      situacao: campaignStatus(c, today),
      inicio: c.startDate,
      fim: c.endDate ?? null,
      custoCentavos: c.cost ?? null,
      utm: { source: c.utmSource, medium: c.utmMedium, campaign: c.utmCampaign },
      postsLigados: posts.filter((p) => p.campaignId === c.id).map((p) => p.id),
      observacao: c.notes ?? null,
    })),
  };
}

/** Site (GA4) e Instagram ao vivo — cada fonte responde ou falha sozinha. */
export async function getMarketing(_ctx: AiRequestContext, args: { dias?: number } = {}) {
  const days = args.dias === 7 ? 7 : 30;
  const [site, instagram] = await Promise.allSettled([fetchGa4Summary(days), fetchInstagramSummary(days)]);
  return {
    periodoDias: days,
    site: site.status === "fulfilled" ? site.value : { erro: (site.reason as Error).message },
    instagram: instagram.status === "fulfilled" ? instagram.value : { erro: (instagram.reason as Error).message },
    observacao: "O GA4 só registra compras se o evento 'purchase' estiver ativo na loja; vendas por Instagram/WhatsApp aparecem só no ERP.",
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
      custoUnitarioCentavos: calculateProductCost(p.costComponents),
      tamanhos: p.sizes ?? [],
      cores: p.colors ?? [],
      sku: p.sku,
    })),
  };
}
