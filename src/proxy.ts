import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

// Redirects an unauthenticated visitor to /login on every route except /login
// itself, and keeps the Supabase auth cookie fresh on every request — the
// standard @supabase/ssr proxy (formerly "middleware", renamed in Next.js 16)
// pattern for the Next.js App Router.
export async function proxy(request: NextRequest) {
  // API routes authenticate themselves (e.g. /api/mcp checks its own
  // "Authorization: Bearer <api key>" header — see src/lib/ai/context.ts)
  // and are called by external clients that never hold a Supabase session
  // cookie. Redirecting them to /login here would break every such call.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

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
