import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCampaignSessions } from "@/lib/marketing/ga4";
import { fetchMediaReach } from "@/lib/marketing/instagram";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UTM = /^[a-z0-9-]{1,60}$/;
const MEDIA_ID = /^\d{1,30}$/;

// Métricas ao vivo de uma campanha: visitas no site (GA4, por utm_campaign) e
// alcance dos posts ligados (Instagram). Cada fonte falha sozinha.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const utm = params.get("utm") ?? "";
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  const media = (params.get("media") ?? "").split(",").filter(Boolean);
  if (!UTM.test(utm) || !ISO_DATE.test(start) || !ISO_DATE.test(end) || media.length > 50 || !media.every((id) => MEDIA_ID.test(id))) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const [site, reach] = await Promise.all([
    fetchCampaignSessions(utm, start, end).then(
      (data) => ({ ok: true as const, data }),
      (error: Error) => ({ ok: false as const, error: error.message })
    ),
    media.length === 0
      ? Promise.resolve({ ok: true as const, data: {} as Record<string, number | undefined> })
      : fetchMediaReach(media).then(
          (data) => ({ ok: true as const, data }),
          (error: Error) => ({ ok: false as const, error: error.message })
        ),
  ]);

  return Response.json({ site, reach }, { headers: { "cache-control": "private, max-age=300" } });
}
