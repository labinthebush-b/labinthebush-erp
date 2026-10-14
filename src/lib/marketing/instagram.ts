// Server-only Instagram Graph API client (insights orgânicos da conta).

import type { InstagramSummary, MarketingPeriodDays } from "./types";
import type { InstagramMedia } from "@/lib/campaigns/types";
import { describeApiError, parseInstagram } from "./normalize";

const GRAPH_VERSION = "v23.0";
const ACCOUNT_METRICS = ["reach", "accounts_engaged", "total_interactions", "profile_links_taps", "views"];

function credentials() {
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accountId || !token) throw new Error("Instagram não configurado neste ambiente.");
  return { accountId, token };
}

type RawMedia = { id: string; caption?: string; media_type?: string; permalink?: string; thumbnail_url?: string; media_url?: string; timestamp?: string };

/** Posts recentes da conta (para ligar a campanhas). */
export async function fetchInstagramMedia(limit = 50): Promise<InstagramMedia[]> {
  const { accountId, token } = credentials();
  const params = new URLSearchParams({
    fields: "id,caption,media_type,permalink,thumbnail_url,media_url,timestamp",
    limit: String(limit),
    access_token: token,
  });
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/media?${params}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(describeApiError("Instagram", res.status, body));
  return ((body.data ?? []) as RawMedia[]).map((m) => ({
    id: m.id,
    caption: m.caption,
    mediaType: m.media_type ?? "",
    permalink: m.permalink ?? "",
    // Vídeo/reels têm thumbnail_url; foto usa a própria media_url como miniatura.
    thumbnailUrl: m.thumbnail_url ?? (m.media_type === "VIDEO" ? undefined : m.media_url),
    timestamp: m.timestamp ?? "",
  }));
}

/**
 * Alcance de cada post (lifetime). Post sem insight (álbum antigo, story
 * expirado) volta como undefined em vez de derrubar os demais.
 */
export async function fetchMediaReach(mediaIds: string[]): Promise<Record<string, number | undefined>> {
  const { token } = credentials();
  const entries = await Promise.all(
    mediaIds.map(async (id) => {
      const params = new URLSearchParams({ metric: "reach", access_token: token });
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${id}/insights?${params}`, { cache: "no-store" });
      if (!res.ok) return [id, undefined] as const;
      const body = (await res.json().catch(() => ({}))) as { data?: { name?: string; values?: { value?: number }[]; total_value?: { value?: number } }[] };
      const metric = body.data?.find((d) => d.name === "reach");
      const value = metric?.total_value?.value ?? metric?.values?.[0]?.value;
      return [id, typeof value === "number" ? value : undefined] as const;
    })
  );
  return Object.fromEntries(entries);
}

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
