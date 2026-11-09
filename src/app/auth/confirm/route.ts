import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Destino do link do e-mail de recuperação de senha. Aceita os dois formatos:
//
// 1. ?code=... — o e-mail PADRÃO do Supabase. No plano gratuito sem SMTP
//    próprio o template não pode ser editado; o link passa por
//    supabase.co/auth/v1/verify e volta para cá (redirectTo de
//    esqueci-senha/actions.ts) com um código PKCE. A troca do código precisa
//    do cookie "code verifier" gravado quando o link foi pedido, então só
//    funciona no MESMO navegador em que se pediu a recuperação.
// 2. ?token_hash=...&type=recovery — template personalizado
//    ({{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery),
//    possível com SMTP próprio. Não depende de cookie: funciona em qualquer
//    navegador ou aparelho.
//
// Os dois gravam a sessão no cookie (via next/headers) e a tela
// /redefinir-senha usa essa sessão.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(request, "/redefinir-senha");
  }

  // Só recuperação de senha passa por aqui: sem cadastro público nem troca
  // de e-mail neste app.
  if (tokenHash && type === "recovery") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    if (!error) return redirectTo(request, "/redefinir-senha");
  }

  // Link expirado, já usado, adulterado ou incompleto: volta para pedir um
  // novo. /esqueci-senha abre com ou sem sessão, então o aviso não se perde.
  return redirectTo(request, "/esqueci-senha", { erro: "link-invalido" });
}

function redirectTo(request: NextRequest, pathname: string, params: Record<string, string> = {}) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(params).toString();
  return NextResponse.redirect(url);
}
