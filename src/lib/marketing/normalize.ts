// Pure parsing of the raw API responses — no network, so it is unit-tested.

import { FUNNEL_EVENTS, type FunnelEvent, type FunnelStep, type Ga4Summary, type InstagramSummary, type MarketingPeriodDays } from "./types";

export const FUNNEL_LABELS: Record<FunnelEvent, string> = {
  view_item: "Viu um produto",
  add_to_cart: "Colocou no carrinho",
  begin_checkout: "Iniciou o checkout",
  purchase: "Comprou",
};

/** Só aceita os períodos suportados; qualquer outra coisa vira 30 dias. */
export function parseDays(value: string | null): MarketingPeriodDays {
  return value === "7" ? 7 : 30;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

type Ga4Row = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
type Ga4Report = { rows?: Ga4Row[] };

/** Monta o funil na ordem fixa; etapa sem evento no período vale 0 (nunca some da tela). */
export function buildFunnel(counts: Partial<Record<FunnelEvent, number>>): FunnelStep[] {
  return FUNNEL_EVENTS.map((event, index) => {
    const count = counts[event] ?? 0;
    const previous = index > 0 ? counts[FUNNEL_EVENTS[index - 1]] ?? 0 : undefined;
    return {
      event,
      label: FUNNEL_LABELS[event],
      count,
      rateFromPrevious: previous !== undefined && previous > 0 ? (count / previous) * 100 : undefined,
    };
  });
}

/** `totals` = runReport com sessions/totalUsers/activeUsers; `events` = runReport por eventName. */
export function parseGa4(totals: Ga4Report, events: Ga4Report): Ga4Summary {
  const values = totals.rows?.[0]?.metricValues ?? [];
  const counts: Partial<Record<FunnelEvent, number>> = {};
  for (const row of events.rows ?? []) {
    const name = row.dimensionValues?.[0]?.value;
    if (name && (FUNNEL_EVENTS as readonly string[]).includes(name)) {
      counts[name as FunnelEvent] = toNumber(row.metricValues?.[0]?.value);
    }
  }
  return {
    sessions: toNumber(values[0]?.value),
    totalUsers: toNumber(values[1]?.value),
    activeUsers: toNumber(values[2]?.value),
    funnel: buildFunnel(counts),
  };
}

type InstagramInsights = { data?: { name?: string; total_value?: { value?: number } }[] };

export function parseInstagram(insights: InstagramInsights): InstagramSummary {
  const byName = new Map((insights.data ?? []).map((d) => [d.name, toNumber(d.total_value?.value)]));
  return {
    reach: byName.get("reach") ?? 0,
    accountsEngaged: byName.get("accounts_engaged") ?? 0,
    totalInteractions: byName.get("total_interactions") ?? 0,
    profileLinksTaps: byName.get("profile_links_taps") ?? 0,
    views: byName.get("views") ?? 0,
  };
}

/** Mensagem curta e sem dados sensíveis (tokens nunca aparecem em erro da API, mas a URL sim — por isso não repassamos a URL). */
export function describeApiError(source: string, status: number, body: unknown): string {
  const message =
    (body as { error?: { message?: string } })?.error?.message ??
    (typeof body === "string" ? body : undefined);
  if (status === 401 || status === 403) return `${source}: acesso negado — a credencial pode ter expirado.`;
  return `${source}: erro ${status}${message ? ` — ${message.slice(0, 140)}` : ""}`;
}
