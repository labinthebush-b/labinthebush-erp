// Funil de venda completo (topo → meio → fundo) juntando Instagram, site
// (GA4) e o próprio ERP (contatos e vendas). Puro: recebe números, devolve a
// estrutura que a tela desenha e os diagnósticos que viram ações.

import type { Ga4Summary, InstagramSummary } from "./types";

export type FunnelStageId = "topo" | "meio" | "fundo";
export type FunnelSource = "instagram" | "site" | "erp";

export type FunnelMetric = {
  id: string;
  label: string;
  hint: string;
  source: FunnelSource;
  /** undefined = a fonte não respondeu (mostra "—", nunca um zero falso). */
  value?: number;
  /** % em relação à métrica anterior do CAMINHO PRINCIPAL (atravessa as etapas). */
  rateFromPrevious?: number;
  /**
   * false = indicador paralelo (engajamento, leads): aparece na etapa, mas não
   * é um degrau do caminho até a compra — não tem taxa e não entra no cálculo
   * da taxa do próximo número.
   */
  inPath: boolean;
};

export type FunnelStage = {
  id: FunnelStageId;
  title: string;
  question: string;
  metrics: FunnelMetric[];
};

export type ErpFunnelInput = {
  /** Contatos em estágios abertos do CRM (nem cliente, nem perdido). */
  openLeads: number;
  salesCount: number;
  paidCount: number;
  receivableCount: number;
  receivableAmount: number;
};

type MetricInput = Omit<FunnelMetric, "rateFromPrevious">;
type StageInput = Omit<FunnelStage, "metrics"> & { metrics: MetricInput[] };

function withRates(stages: StageInput[]): FunnelStage[] {
  let previous: number | undefined;
  return stages.map((stage) => ({
    ...stage,
    metrics: stage.metrics.map((metric) => {
      if (!metric.inPath) return { ...metric, rateFromPrevious: undefined };
      const rate = metric.value !== undefined && previous !== undefined && previous > 0 ? (metric.value / previous) * 100 : undefined;
      if (metric.value !== undefined) previous = metric.value;
      else previous = undefined; // uma fonte faltando quebra a cadeia: não inventa taxa
      return { ...metric, rateFromPrevious: rate };
    }),
  }));
}

export function buildSalesFunnel(params: {
  instagram?: InstagramSummary;
  ga4?: Ga4Summary;
  erp: ErpFunnelInput;
}): FunnelStage[] {
  const { instagram, ga4, erp } = params;
  const event = (name: string) => ga4?.funnel.find((s) => s.event === name)?.count;

  return withRates([
    {
      id: "topo",
      title: "Topo — Atração",
      question: "Quantas pessoas a marca alcançou?",
      metrics: [
        { id: "reach", label: "Alcance no Instagram", hint: "contas únicas que viram a marca", source: "instagram", value: instagram?.reach, inPath: true },
        { id: "engaged", label: "Engajaram", hint: "indicador paralelo — curtiram, comentaram, salvaram", source: "instagram", value: instagram?.accountsEngaged, inPath: false },
      ],
    },
    {
      id: "meio",
      title: "Meio — Consideração",
      question: "Quantas se interessaram de verdade?",
      metrics: [
        { id: "sessions", label: "Visitas à loja", hint: "sessões no site", source: "site", value: ga4?.sessions, inPath: true },
        { id: "view_item", label: "Viram um produto", hint: "abriram a página de uma peça", source: "site", value: event("view_item"), inPath: true },
        { id: "add_to_cart", label: "Colocaram no carrinho", hint: "", source: "site", value: event("add_to_cart"), inPath: true },
        { id: "leads", label: "Leads em conversa", hint: "indicador paralelo — contatos abertos no CRM", source: "erp", value: erp.openLeads, inPath: false },
      ],
    },
    {
      id: "fundo",
      title: "Fundo — Conversão",
      question: "Quantas compraram e pagaram?",
      metrics: [
        { id: "checkout", label: "Iniciaram o checkout", hint: "no site", source: "site", value: event("begin_checkout"), inPath: true },
        { id: "sales", label: "Vendas", hint: "registradas no ERP, todos os canais", source: "erp", value: erp.salesCount, inPath: true },
        { id: "paid", label: "Pagas", hint: "já viraram caixa", source: "erp", value: erp.paidCount, inPath: true },
      ],
    },
  ]);
}

export type FunnelActionKind = "task" | "link" | "external";

export type FunnelInsight = {
  id: string;
  stage: FunnelStageId;
  severity: "atencao" | "oportunidade";
  title: string;
  description: string;
  action: { label: string; kind: FunnelActionKind; href?: string; taskTitle?: string };
};

/**
 * Regras simples e explicáveis — cada uma aponta um gargalo concreto do funil
 * e já sugere a ação. Nada de "score" opaco.
 */
export function deriveFunnelInsights(params: {
  instagram?: InstagramSummary;
  ga4?: Ga4Summary;
  erp: ErpFunnelInput;
  instagramUsername?: string;
}): FunnelInsight[] {
  const { instagram, ga4, erp } = params;
  const insights: FunnelInsight[] = [];
  const event = (name: string) => ga4?.funnel.find((s) => s.event === name)?.count ?? 0;

  if (instagram && instagram.reach > 0 && instagram.profileLinksTaps === 0) {
    insights.push({
      id: "bio-link",
      stage: "topo",
      severity: "atencao",
      title: "Ninguém tocou no link da bio",
      description: `${instagram.reach.toLocaleString("pt-BR")} pessoas viram a marca, mas nenhuma foi do perfil para a loja. Confira se a bio tem o link e um convite claro.`,
      action: { label: "Abrir o Instagram", kind: "external", href: `https://www.instagram.com/${params.instagramUsername ?? "labinthebush"}/` },
    });
  }

  if (instagram && instagram.reach > 0) {
    const engagement = (instagram.accountsEngaged / instagram.reach) * 100;
    if (engagement < 2) {
      insights.push({
        id: "engagement",
        stage: "topo",
        severity: "oportunidade",
        title: `Engajamento baixo (${engagement.toFixed(1)}% do alcance)`,
        description: "Muita gente vê, pouca gente interage. Conteúdos com pergunta, bastidor ou enquete costumam puxar conversa.",
        action: { label: "Planejar um post", kind: "task", taskTitle: "Post Instagram: conteúdo de engajamento (enquete/bastidor)" },
      });
    }
  }

  const addToCart = event("add_to_cart");
  const checkout = event("begin_checkout");
  if (addToCart >= 3 && checkout / addToCart < 0.5) {
    insights.push({
      id: "cart-drop",
      stage: "meio",
      severity: "atencao",
      title: "Muita gente desiste no carrinho",
      description: `${addToCart} colocaram no carrinho e só ${checkout} foram para o checkout. Frete e prazo costumam ser o motivo — vale testar cupom de frete grátis.`,
      action: { label: "Criar tarefa", kind: "task", taskTitle: "Revisar frete/cupom para reduzir abandono de carrinho" },
    });
  }

  if (ga4 && event("purchase") === 0 && erp.salesCount > 0) {
    insights.push({
      id: "purchase-tracking",
      stage: "fundo",
      severity: "atencao",
      title: "O site não registra compras",
      description: `O ERP tem ${erp.salesCount} ${erp.salesCount === 1 ? "venda" : "vendas"} no período, mas o Google Analytics não viu nenhuma compra. Sem isso, não dá para saber quais visitas viram venda.`,
      action: { label: "Criar tarefa", kind: "task", taskTitle: "Ativar o evento de compra (purchase) do Google Analytics na Nuvemshop" },
    });
  }

  if (erp.receivableCount > 0) {
    insights.push({
      id: "receivable",
      stage: "fundo",
      severity: "oportunidade",
      title: `${erp.receivableCount} ${erp.receivableCount === 1 ? "venda espera" : "vendas esperam"} pagamento`,
      description: "Dinheiro já vendido que ainda não entrou no caixa.",
      action: { label: "Ver a receber", kind: "link", href: "/vendas" },
    });
  }

  if (erp.openLeads > 0) {
    insights.push({
      id: "leads",
      stage: "meio",
      severity: "oportunidade",
      title: `${erp.openLeads} ${erp.openLeads === 1 ? "lead em conversa" : "leads em conversa"}`,
      description: "Pessoas que já demonstraram interesse. Um retorno rápido é a venda mais barata do funil.",
      action: { label: "Abrir funil de contatos", kind: "link", href: "/contatos" },
    });
  }

  return insights;
}

/** Link com UTM no padrão do plano de mensuração: tudo minúsculo, sem espaço. */
export function buildUtmUrl(base: string, utm: { source: string; medium: string; campaign: string; content?: string }): string | null {
  const slug = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(base.trim()) ? base.trim() : `https://${base.trim()}`);
  } catch {
    return null;
  }
  if (!url.hostname.includes(".")) return null;
  const params: [string, string][] = [
    ["utm_source", slug(utm.source)],
    ["utm_medium", slug(utm.medium)],
    ["utm_campaign", slug(utm.campaign)],
  ];
  if (utm.content?.trim()) params.push(["utm_content", slug(utm.content)]);
  for (const [key, value] of params) if (value) url.searchParams.set(key, value);
  return url.toString();
}
