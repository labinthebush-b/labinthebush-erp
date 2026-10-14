import { describe, expect, it } from "vitest";
import { buildSalesFunnel, buildUtmUrl, deriveFunnelInsights, type ErpFunnelInput } from "./funnel";
import { buildFunnel } from "./normalize";
import type { Ga4Summary, InstagramSummary } from "./types";

const instagram: InstagramSummary = { reach: 5000, accountsEngaged: 80, totalInteractions: 285, profileLinksTaps: 0, views: 15000 };
const ga4: Ga4Summary = {
  sessions: 58,
  totalUsers: 37,
  activeUsers: 37,
  funnel: buildFunnel({ view_item: 17, add_to_cart: 4, begin_checkout: 1, purchase: 0 }),
};
const erp: ErpFunnelInput = { openLeads: 5, salesCount: 3, paidCount: 2, receivableCount: 1, receivableAmount: 14200 };

describe("buildSalesFunnel", () => {
  it("organiza em topo, meio e fundo, nessa ordem", () => {
    expect(buildSalesFunnel({ instagram, ga4, erp }).map((s) => s.id)).toEqual(["topo", "meio", "fundo"]);
  });

  it("cada métrica traz o valor da fonte certa", () => {
    const funnel = buildSalesFunnel({ instagram, ga4, erp });
    const all = Object.fromEntries(funnel.flatMap((s) => s.metrics).map((m) => [m.id, m.value]));
    expect(all).toEqual({ reach: 5000, engaged: 80, sessions: 58, view_item: 17, add_to_cart: 4, leads: 5, checkout: 1, sales: 3, paid: 2 });
  });

  it("taxa é relativa à métrica anterior do funil inteiro, atravessando as etapas", () => {
    const metrics = buildSalesFunnel({ instagram, ga4, erp }).flatMap((s) => s.metrics);
    expect(metrics[0].rateFromPrevious).toBeUndefined();
    expect(metrics[1].rateFromPrevious).toBeCloseTo(1.6); // 80 / 5000
    expect(metrics[2].rateFromPrevious).toBeCloseTo(72.5); // 58 / 80 (cruza de topo para meio)
    expect(metrics.find((m) => m.id === "paid")?.rateFromPrevious).toBeCloseTo(66.67, 1); // 2 / 3
  });

  it("fonte fora do ar: métrica sem valor (nunca zero falso) e sem taxa inventada na seguinte", () => {
    const metrics = buildSalesFunnel({ ga4, erp }).flatMap((s) => s.metrics);
    expect(metrics.find((m) => m.id === "reach")?.value).toBeUndefined();
    expect(metrics.find((m) => m.id === "sessions")?.rateFromPrevious).toBeUndefined();
  });

  it("etapa anterior zerada não gera taxa (sem divisão por zero)", () => {
    const metrics = buildSalesFunnel({ instagram: { ...instagram, accountsEngaged: 0 }, ga4, erp }).flatMap((s) => s.metrics);
    expect(metrics.find((m) => m.id === "sessions")?.rateFromPrevious).toBeUndefined();
  });
});

describe("deriveFunnelInsights", () => {
  const ids = (list: { id: string }[]) => list.map((i) => i.id);

  it("bio sem toques, engajamento baixo, carrinho abandonado, compra não rastreada, a receber e leads", () => {
    const insights = deriveFunnelInsights({ instagram, ga4, erp });
    expect(ids(insights)).toEqual(["bio-link", "engagement", "cart-drop", "purchase-tracking", "receivable", "leads"]);
  });

  it("cada diagnóstico traz uma ação executável", () => {
    for (const insight of deriveFunnelInsights({ instagram, ga4, erp })) {
      expect(insight.action.label).toBeTruthy();
      if (insight.action.kind === "task") expect(insight.action.taskTitle).toBeTruthy();
      else expect(insight.action.href).toBeTruthy();
    }
  });

  it("funil saudável não gera alerta", () => {
    const healthy = deriveFunnelInsights({
      instagram: { ...instagram, accountsEngaged: 400, profileLinksTaps: 30 },
      ga4: { ...ga4, funnel: buildFunnel({ view_item: 20, add_to_cart: 4, begin_checkout: 3, purchase: 2 }) },
      erp: { openLeads: 0, salesCount: 2, paidCount: 2, receivableCount: 0, receivableAmount: 0 },
    });
    expect(healthy).toEqual([]);
  });

  it("poucos carrinhos (menos de 3) não bastam para acusar abandono", () => {
    const insights = deriveFunnelInsights({ ga4: { ...ga4, funnel: buildFunnel({ add_to_cart: 2, begin_checkout: 0 }) }, erp });
    expect(ids(insights)).not.toContain("cart-drop");
  });

  it("sem vendas no ERP, não acusa falta de rastreio de compra", () => {
    const insights = deriveFunnelInsights({ ga4, erp: { ...erp, salesCount: 0 } });
    expect(ids(insights)).not.toContain("purchase-tracking");
  });

  it("fontes fora do ar não geram diagnósticos delas", () => {
    expect(ids(deriveFunnelInsights({ erp: { ...erp, receivableCount: 0, openLeads: 0 } }))).toEqual([]);
  });
});

describe("buildUtmUrl", () => {
  it("monta o link no padrão: minúsculo, sem acento e sem espaço", () => {
    expect(buildUtmUrl("https://loja.com.br/produtos/nrem", { source: "Instagram", medium: "Stories", campaign: "Coleção Verão 2026" })).toBe(
      "https://loja.com.br/produtos/nrem?utm_source=instagram&utm_medium=stories&utm_campaign=colecao-verao-2026"
    );
  });

  it("aceita endereço sem https e inclui utm_content quando informado", () => {
    expect(buildUtmUrl("loja.com.br", { source: "whatsapp", medium: "lista", campaign: "drop", content: "Link 2" })).toBe(
      "https://loja.com.br/?utm_source=whatsapp&utm_medium=lista&utm_campaign=drop&utm_content=link-2"
    );
  });

  it("preserva parâmetros que o link já tinha", () => {
    expect(buildUtmUrl("https://loja.com.br/?variant=1", { source: "ig", medium: "bio", campaign: "x" })).toContain("variant=1");
  });

  it("endereço inválido devolve null", () => {
    expect(buildUtmUrl("", { source: "a", medium: "b", campaign: "c" })).toBeNull();
    expect(buildUtmUrl("isso não é link", { source: "a", medium: "b", campaign: "c" })).toBeNull();
  });
});
