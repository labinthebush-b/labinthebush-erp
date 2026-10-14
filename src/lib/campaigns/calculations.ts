import type { Campaign, CampaignChannel } from "./types";

export const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  instagram: "Instagram",
  site: "Site",
  dm: "DM",
  outro: "Outro",
};

/** UTM padrão de cada canal (plano de mensuração 1.3) — editável no formulário. */
export const CHANNEL_UTM_DEFAULTS: Record<CampaignChannel, { source: string; medium: string }> = {
  instagram: { source: "instagram", medium: "post" },
  site: { source: "site", medium: "banner" },
  dm: { source: "instagram", medium: "direct" },
  outro: { source: "outro", medium: "organic" },
};

/** Minúsculo, sem acento, sem espaço: "Drop NREM Outubro" → "drop-nrem-outubro". */
export function toUtmSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * utm_campaign único entre as campanhas do usuário: se o slug do nome já
 * existir, acrescenta -2, -3… Ignora a própria campanha ao editar.
 */
export function uniqueUtmCampaign(name: string, campaigns: Pick<Campaign, "id" | "utmCampaign">[], selfId?: string): string {
  const base = toUtmSlug(name) || "campanha";
  const taken = new Set(campaigns.filter((c) => c.id !== selfId).map((c) => c.utmCampaign));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export type CampaignStatus = "agendada" | "ativa" | "encerrada";

export function campaignStatus(campaign: Pick<Campaign, "startDate" | "endDate">, todayISO: string): CampaignStatus {
  if (todayISO < campaign.startDate) return "agendada";
  if (campaign.endDate && todayISO > campaign.endDate) return "encerrada";
  return "ativa";
}

/** Período para medir a campanha: do início até o fim (ou até hoje, se ainda ativa), nunca no futuro. */
export function campaignMeasureRange(campaign: Pick<Campaign, "startDate" | "endDate">, todayISO: string): { start: string; end: string } | null {
  if (todayISO < campaign.startDate) return null;
  const end = campaign.endDate && campaign.endDate < todayISO ? campaign.endDate : todayISO;
  return { start: campaign.startDate, end };
}

/** Custo por visita, em centavos; undefined quando não há custo ou visita. */
export function costPerVisit(cost: number | undefined, visits: number | undefined): number | undefined {
  if (!cost || !visits) return undefined;
  return Math.round(cost / visits);
}

/** Volume abaixo do qual a tela avisa que não dá para concluir nada (regra do plano). */
export const SMALL_SAMPLE_VISITS = 30;
