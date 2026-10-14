import { createClient } from "@/lib/supabase/server";
import { fetchInstagramMedia } from "@/lib/marketing/instagram";

// Posts recentes da conta, para ligar a campanhas. Exige sessão (ver /api/marketing).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });
  try {
    return Response.json({ media: await fetchInstagramMedia(50) }, { headers: { "cache-control": "private, max-age=300" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao ler o Instagram." }, { status: 502 });
  }
}
