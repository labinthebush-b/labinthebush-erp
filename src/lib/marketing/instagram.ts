// Server-only Instagram Graph API client (insights orgânicos da conta).

import type { InstagramSummary, MarketingPeriodDays } from "./types";
import { describeApiError, parseInstagram } from "./normalize";

const GRAPH_VERSION = "v23.0";
const ACCOUNT_METRICS = ["reach", "accounts_engaged", "total_interactions", "profile_links_taps", "views"];

export async function fetchInstagramSummary(days: MarketingPeriodDays): Promise<InstagramSummary> {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accountId || !token) throw new Error("Instagram não configurado neste ambiente.");

  const until = Math.floor(Date.now() / 1000);
  // A API aceita no máximo ~30 dias por consulta; 30 dias = 29 dias atrás + hoje.
  const since = until - (days - 1) * 86400;
  const params = new URLSearchParams({
    metric: ACCOUNT_METRICS.join(","),
    period: "day",
    metric_type: "total_value",
    since: String(since),
    until: String(until),
    access_token: token,
  });

  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/insights?${params}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(describeApiError("Instagram", res.status, body));
  return parseInstagram(body);
}
