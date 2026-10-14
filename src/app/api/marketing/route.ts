import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchGa4Summary } from "@/lib/marketing/ga4";
import { fetchInstagramSummary } from "@/lib/marketing/instagram";
import { parseDays } from "@/lib/marketing/normalize";
import type { MarketingResponse, SourceResult } from "@/lib/marketing/types";

// O proxy deixa /api/* passar sem checar login (ver src/proxy.ts), então esta
// rota confere a sessão ela mesma: os números da marca não são públicos.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const days = parseDays(request.nextUrl.searchParams.get("days"));

  async function settle<T>(promise: Promise<T>): Promise<SourceResult<T>> {
    try {
      return { ok: true, data: await promise };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido." };
    }
  }

  const [ga4, instagram] = await Promise.all([settle(fetchGa4Summary(days)), settle(fetchInstagramSummary(days))]);
  const body: MarketingResponse = { days, ga4, instagram };
  return Response.json(body, { headers: { "cache-control": "private, max-age=300" } });
}
