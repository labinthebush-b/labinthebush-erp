import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

// Chamada uma vez por dia pelo cron da Vercel (vercel.json): uma consulta real
// no banco para o plano gratuito do Supabase não pausar o projeto por falta de
// uso. Usa a chave anônima, então o RLS devolve 0 linhas e nenhum dado sai
// daqui; por isso a rota não precisa de login nem de segredo.
export async function GET() {
  try {
    const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.from("products").select("id").limit(1);
    if (error) return Response.json({ ok: false }, { status: 503 });
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
