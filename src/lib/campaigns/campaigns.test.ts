import { describe, expect, it } from "vitest";
import { campaignMeasureRange, campaignStatus, costPerVisit, toUtmSlug, uniqueUtmCampaign } from "./calculations";
import { EMPTY_CAMPAIGNS_STATE, campaignsReducer } from "./campaigns-reducer";
import type { Campaign } from "./types";

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "c1",
    name: "Drop NREM",
    channel: "instagram",
    startDate: "2026-10-01",
    utmSource: "instagram",
    utmMedium: "post",
    utmCampaign: "drop-nrem",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toUtmSlug / uniqueUtmCampaign", () => {
  it("minúsculo, sem acento e sem espaço", () => {
    expect(toUtmSlug("  Coleção Verão 2026!! ")).toBe("colecao-verao-2026");
  });

  it("nome repetido ganha sufixo para a UTM continuar única", () => {
    const existing = [campaign({ id: "a", utmCampaign: "drop-nrem" }), campaign({ id: "b", utmCampaign: "drop-nrem-2" })];
    expect(uniqueUtmCampaign("Drop NREM", existing)).toBe("drop-nrem-3");
    expect(uniqueUtmCampaign("Outra", existing)).toBe("outra");
  });

  it("ao editar, a própria campanha não conta como conflito", () => {
    expect(uniqueUtmCampaign("Drop NREM", [campaign({ id: "a" })], "a")).toBe("drop-nrem");
  });

  it("nome só com símbolos vira 'campanha'", () => {
    expect(uniqueUtmCampaign("!!!", [])).toBe("campanha");
  });
});

describe("campaignStatus / campaignMeasureRange", () => {
  const c = campaign({ startDate: "2026-10-05", endDate: "2026-10-20" });

  it("agendada antes do início, ativa no período, encerrada depois do fim", () => {
    expect(campaignStatus(c, "2026-10-01")).toBe("agendada");
    expect(campaignStatus(c, "2026-10-05")).toBe("ativa");
    expect(campaignStatus(c, "2026-10-20")).toBe("ativa");
    expect(campaignStatus(c, "2026-10-21")).toBe("encerrada");
  });

  it("sem data de fim fica ativa", () => {
    expect(campaignStatus(campaign({ endDate: undefined }), "2027-01-01")).toBe("ativa");
  });

  it("mede do início até o fim, ou até hoje se ainda ativa — nunca no futuro", () => {
    expect(campaignMeasureRange(c, "2026-10-10")).toEqual({ start: "2026-10-05", end: "2026-10-10" });
    expect(campaignMeasureRange(c, "2026-11-01")).toEqual({ start: "2026-10-05", end: "2026-10-20" });
    expect(campaignMeasureRange(c, "2026-10-01")).toBeNull();
  });
});

describe("costPerVisit", () => {
  it("custo ÷ visitas; sem custo ou sem visita não calcula", () => {
    expect(costPerVisit(10000, 40)).toBe(250);
    expect(costPerVisit(undefined, 40)).toBeUndefined();
    expect(costPerVisit(10000, 0)).toBeUndefined();
  });
});

describe("campaignsReducer", () => {
  const at = "2026-10-14T00:00:00.000Z";

  it("ligar um post novo cria o vínculo com tags vazias", () => {
    const state = campaignsReducer(EMPTY_CAMPAIGNS_STATE, { type: "LINK_POST", postId: "p1", campaignId: "c1", at });
    expect(state.posts).toEqual([{ id: "p1", campaignId: "c1", tags: [], createdAt: at, updatedAt: at }]);
  });

  it("ligar a outra campanha move o post (um post pertence a uma campanha)", () => {
    let state = campaignsReducer(EMPTY_CAMPAIGNS_STATE, { type: "LINK_POST", postId: "p1", campaignId: "c1", at });
    state = campaignsReducer(state, { type: "LINK_POST", postId: "p1", campaignId: "c2", at });
    expect(state.posts).toHaveLength(1);
    expect(state.posts[0].campaignId).toBe("c2");
  });

  it("ligar de novo à mesma campanha não muda nada", () => {
    const state = campaignsReducer(EMPTY_CAMPAIGNS_STATE, { type: "LINK_POST", postId: "p1", campaignId: "c1", at });
    expect(campaignsReducer(state, { type: "LINK_POST", postId: "p1", campaignId: "c1", at })).toBe(state);
  });

  it("desligar mantém o post (e suas tags), só tira a campanha", () => {
    let state = campaignsReducer(EMPTY_CAMPAIGNS_STATE, { type: "LINK_POST", postId: "p1", campaignId: "c1", at });
    state = campaignsReducer(state, { type: "UNLINK_POST", postId: "p1", at });
    expect(state.posts[0]).toMatchObject({ id: "p1", campaignId: undefined });
  });

  it("excluir a campanha desliga os posts dela, sem apagá-los", () => {
    let state = campaignsReducer({ campaigns: [campaign()], posts: [] }, { type: "LINK_POST", postId: "p1", campaignId: "c1", at });
    state = campaignsReducer(state, { type: "LINK_POST", postId: "p2", campaignId: "outra", at });
    state = campaignsReducer(state, { type: "DELETE_CAMPAIGN", id: "c1", at });
    expect(state.campaigns).toEqual([]);
    expect(state.posts.find((p) => p.id === "p1")?.campaignId).toBeUndefined();
    expect(state.posts.find((p) => p.id === "p2")?.campaignId).toBe("outra");
  });
});
