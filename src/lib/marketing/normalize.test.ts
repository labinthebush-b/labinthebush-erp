import { describe, expect, it } from "vitest";
import { buildFunnel, describeApiError, parseDays, parseGa4, parseInstagram } from "./normalize";

describe("parseDays", () => {
  it("aceita 7; qualquer outra coisa vira 30", () => {
    expect(parseDays("7")).toBe(7);
    expect(parseDays("30")).toBe(30);
    expect(parseDays(null)).toBe(30);
    expect(parseDays("365")).toBe(30);
    expect(parseDays("abc")).toBe(30);
  });
});

describe("buildFunnel", () => {
  it("sempre nas 4 etapas e na ordem certa, mesmo sem evento", () => {
    expect(buildFunnel({}).map((s) => [s.event, s.count])).toEqual([
      ["view_item", 0],
      ["add_to_cart", 0],
      ["begin_checkout", 0],
      ["purchase", 0],
    ]);
  });

  it("taxa de cada etapa é relativa à anterior; a primeira não tem taxa", () => {
    const funnel = buildFunnel({ view_item: 20, add_to_cart: 5, begin_checkout: 2, purchase: 1 });
    expect(funnel[0].rateFromPrevious).toBeUndefined();
    expect(funnel[1].rateFromPrevious).toBe(25);
    expect(funnel[2].rateFromPrevious).toBe(40);
    expect(funnel[3].rateFromPrevious).toBe(50);
  });

  it("etapa anterior zerada: sem taxa (nunca divide por zero)", () => {
    const funnel = buildFunnel({ view_item: 0, add_to_cart: 3 });
    expect(funnel[1].rateFromPrevious).toBeUndefined();
  });

  it("rótulos em português", () => {
    expect(buildFunnel({}).map((s) => s.label)).toEqual(["Viu um produto", "Colocou no carrinho", "Iniciou o checkout", "Comprou"]);
  });
});

describe("parseGa4", () => {
  it("lê os totais e o funil do formato real do runReport (valores vêm como texto)", () => {
    const totals = { rows: [{ metricValues: [{ value: "58" }, { value: "37" }, { value: "36" }] }] };
    const events = {
      rows: [
        { dimensionValues: [{ value: "add_to_cart" }], metricValues: [{ value: "3" }] },
        { dimensionValues: [{ value: "view_item" }], metricValues: [{ value: "17" }] },
        { dimensionValues: [{ value: "begin_checkout" }], metricValues: [{ value: "2" }] },
      ],
    };
    const summary = parseGa4(totals, events);
    expect(summary).toMatchObject({ sessions: 58, totalUsers: 37, activeUsers: 36 });
    expect(summary.funnel.map((s) => s.count)).toEqual([17, 3, 2, 0]);
  });

  it("relatório vazio (sem nenhuma visita no período) vira zeros, não erro", () => {
    const summary = parseGa4({}, {});
    expect(summary.sessions).toBe(0);
    expect(summary.funnel.every((s) => s.count === 0)).toBe(true);
  });

  it("ignora eventos fora do funil", () => {
    const summary = parseGa4({}, { rows: [{ dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "999" }] }] });
    expect(summary.funnel.every((s) => s.count === 0)).toBe(true);
  });
});

describe("parseInstagram", () => {
  it("lê o formato real de insights com total_value", () => {
    const summary = parseInstagram({
      data: [
        { name: "reach", total_value: { value: 4315 } },
        { name: "accounts_engaged", total_value: { value: 82 } },
        { name: "total_interactions", total_value: { value: 285 } },
        { name: "profile_links_taps", total_value: { value: 0 } },
        { name: "views", total_value: { value: 12051 } },
      ],
    });
    expect(summary).toEqual({ reach: 4315, accountsEngaged: 82, totalInteractions: 285, profileLinksTaps: 0, views: 12051 });
  });

  it("métrica ausente vale 0", () => {
    expect(parseInstagram({ data: [{ name: "reach", total_value: { value: 10 } }] })).toEqual({
      reach: 10,
      accountsEngaged: 0,
      totalInteractions: 0,
      profileLinksTaps: 0,
      views: 0,
    });
    expect(parseInstagram({}).reach).toBe(0);
  });
});

describe("describeApiError", () => {
  it("401/403 vira mensagem de credencial expirada", () => {
    expect(describeApiError("Instagram", 401, {})).toContain("credencial pode ter expirado");
    expect(describeApiError("GA4", 403, {})).toContain("acesso negado");
  });

  it("outros erros mostram status e um trecho curto da mensagem da API", () => {
    const message = describeApiError("GA4", 400, { error: { message: "x".repeat(500) } });
    expect(message.startsWith("GA4: erro 400")).toBe(true);
    expect(message.length).toBeLessThan(170);
  });
});
