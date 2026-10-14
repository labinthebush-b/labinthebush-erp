// Domain types for Marketing → Campanhas (etapa 1 de PLANO_MARKETING_ATRIBUICAO.md).

export type CampaignChannel = "instagram" | "site" | "dm" | "outro";

export type Campaign = {
  id: string;
  name: string;
  channel: CampaignChannel;
  startDate: string; // yyyy-MM-dd
  endDate?: string;
  /** Centavos; ausente = campanha orgânica, sem custo. */
  cost?: number;
  notes?: string;
  utmSource: string;
  utmMedium: string;
  /** Único por usuário — a chave que liga visitas (GA4) e, nas próximas etapas, vendas/contatos/cupons à campanha. */
  utmCampaign: string;
  createdAt: string;
  updatedAt: string;
};

/** O que o ERP sabe de um post e o Instagram não. Métricas são lidas ao vivo, nunca guardadas. */
export type InstagramPostLink = {
  /** Id do post na Instagram Graph API. */
  id: string;
  campaignId?: string;
  /** Tags livres (formato, tema, gancho, horário) — usadas na etapa 5. */
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

/** Post da conta, como a Instagram Graph API devolve (só leitura). */
export type InstagramMedia = {
  id: string;
  caption?: string;
  mediaType: string;
  permalink: string;
  thumbnailUrl?: string;
  timestamp: string;
};
