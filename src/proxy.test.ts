import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type CookieOptions = { cookies: { setAll: (c: { name: string; value: string; options: object }[]) => void } };

const getUser = vi.fn();
const createServerClient = vi.fn<(url: string, key: string, options: CookieOptions) => unknown>(() => ({
  auth: { getUser },
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (url: string, key: string, options: CookieOptions) => createServerClient(url, key, options),
}));

import { proxy } from "./proxy";

function request(path: string) {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

function loggedIn(yes: boolean) {
  getUser.mockResolvedValue({ data: { user: yes ? { id: "u1" } : null } });
}

function redirectPath(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });

  describe("sem sessão", () => {
    beforeEach(() => loggedIn(false));

    it.each(["/login", "/esqueci-senha", "/auth/confirm?token_hash=abc&type=recovery"])("libera %s", async (path) => {
      expect(redirectPath(await proxy(request(path)))).toBeNull();
    });

    it.each(["/", "/financeiro", "/redefinir-senha", "/esqueci-senha-falsa", "/loginx", "/auth/outra"])(
      "manda %s para /login",
      async (path) => {
        expect(redirectPath(await proxy(request(path)))).toBe("/login");
      }
    );

    it("não redireciona rotas de API", async () => {
      expect(redirectPath(await proxy(request("/api/marketing")))).toBeNull();
    });
  });

  it("/api/mcp passa direto, sem consultar a sessão", async () => {
    const response = await proxy(request("/api/mcp"));
    expect(redirectPath(response)).toBeNull();
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  // Motivo de o proxy existir: o token renovado pelo Supabase durante o
  // getUser precisa voltar para o navegador na resposta.
  it.each(["/financeiro", "/api/marketing", "/redefinir-senha"])(
    "devolve o cookie de sessão renovado em %s",
    async (path) => {
      getUser.mockImplementation(async () => {
        const options = createServerClient.mock.calls[0][2];
        options.cookies.setAll([{ name: "sb-token", value: "renovado", options: { path: "/" } }]);
        return { data: { user: { id: "u1" } } };
      });
      const response = await proxy(request(path));
      expect(redirectPath(response)).toBeNull();
      expect(response.headers.get("set-cookie")).toContain("sb-token=renovado");
    }
  );

  describe("com sessão", () => {
    beforeEach(() => loggedIn(true));

    it("manda /login para o início", async () => {
      expect(redirectPath(await proxy(request("/login")))).toBe("/");
    });

    it.each(["/redefinir-senha", "/auth/confirm?token_hash=abc&type=recovery", "/esqueci-senha", "/financeiro"])(
      "libera %s",
      async (path) => {
        expect(redirectPath(await proxy(request(path)))).toBeNull();
      }
    );
  });
});
