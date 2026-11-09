// Páginas que o proxy (src/proxy.ts) deixa abrir sem sessão. /redefinir-senha
// NÃO está aqui de propósito: ela só funciona com a sessão que /auth/confirm
// cria a partir do link do e-mail de recuperação.
const PUBLIC_ROUTES = ["/login", "/esqueci-senha", "/auth/confirm"];

function matches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => matches(pathname, route));
}

/** Só /login manda quem já está logado de volta para o início. */
export function isLoginRoute(pathname: string): boolean {
  return matches(pathname, "/login");
}
