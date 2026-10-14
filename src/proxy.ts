import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

// Redirects an unauthenticated visitor to /login on every route except /login
// itself, and keeps the Supabase auth cookie fresh on every request — the
// standard @supabase/ssr proxy (formerly "middleware", renamed in Next.js 16)
// pattern for the Next.js App Router.
export async function proxy(request: NextRequest) {
  // /api/mcp authenticates itself ("Authorization: Bearer <api key>" — see
  // src/lib/ai/context.ts) and is called by external clients that never hold
  // a Supabase session cookie: it skips the proxy entirely. No /api route is
  // ever redirected to /login.
  if (request.nextUrl.pathname.startsWith("/api/mcp")) {
    return NextResponse.next();
  }
  // Rotas internas do próprio app (ex.: /api/marketing) checam a sessão elas
  // mesmas e respondem 401 — mas precisam que o cookie de auth seja renovado
  // aqui, como em qualquer página; sem isso, um token expirado fazia a
  // primeira chamada falhar com 401 mesmo com o usuário logado.
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  let response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isApiRoute) return response;

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Every route except static assets, the Next.js image optimizer and the PWA
    // manifest — browsers fetch the manifest without the auth cookie, so
    // redirecting it to /login would make the app impossible to install.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
