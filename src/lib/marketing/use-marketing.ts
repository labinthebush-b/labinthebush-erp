"use client";

import * as React from "react";
import type { MarketingPeriodDays, MarketingResponse } from "./types";

/**
 * Lê /api/marketing (GA4 + Instagram ao vivo) para um período. Usado pelo
 * Dashboard; cada fonte pode falhar sozinha (ver SourceResult), então quem usa
 * mostra "—" quando a fonte não respondeu.
 */
export function useMarketing(days: MarketingPeriodDays) {
  const [data, setData] = React.useState<MarketingResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/marketing?days=${days}`)
      .then((res) => (res.ok ? (res.json() as Promise<MarketingResponse>) : null))
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  return {
    loading,
    ga4: data?.ga4.ok ? data.ga4.data : undefined,
    instagram: data?.instagram.ok ? data.instagram.data : undefined,
  };
}
