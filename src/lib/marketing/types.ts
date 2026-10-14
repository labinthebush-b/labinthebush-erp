// Domain types for the Marketing module (T5.3) — see PLANO_MENSURACAO_MARKETING.md.
// Read live from GA4 (Data API) and Instagram (Graph API) on the server; no
// table, no migration: the source systems already keep the history.

export type MarketingPeriodDays = 7 | 30;

export const FUNNEL_EVENTS = ["view_item", "add_to_cart", "begin_checkout", "purchase"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export type FunnelStep = {
  event: FunnelEvent;
  label: string;
  count: number;
  /** % em relação à etapa anterior (undefined na primeira etapa ou quando a anterior é zero). */
  rateFromPrevious?: number;
};

export type Ga4Summary = {
  sessions: number;
  totalUsers: number;
  activeUsers: number;
  funnel: FunnelStep[];
};

export type InstagramSummary = {
  reach: number;
  accountsEngaged: number;
  totalInteractions: number;
  profileLinksTaps: number;
  views: number;
};

/** Cada fonte responde ou falha por conta própria — uma fora do ar não derruba a outra. */
export type SourceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type MarketingResponse = {
  days: MarketingPeriodDays;
  ga4: SourceResult<Ga4Summary>;
  instagram: SourceResult<InstagramSummary>;
};
