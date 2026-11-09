import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyOtp = vi.fn();
const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { verifyOtp, exchangeCodeForSession } })),
}));

import { GET } from "./route";

function get(query: string) {
  return GET(new NextRequest(new URL(`/auth/confirm${query}`, "http://localhost:3000")));
}

function location(response: Response) {
  return new URL(response.headers.get("location") ?? "");
}

describe("GET /auth/confirm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("valida o token de recuperação e leva para /redefinir-senha", async () => {
    verifyOtp.mockResolvedValue({ data: {}, error: null });
    const url = location(await get("?token_hash=abc123&type=recovery"));
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc123" });
    expect(url.pathname).toBe("/redefinir-senha");
    // O token não segue adiante na URL.
    expect(url.search).toBe("");
  });

  it("link expirado ou já usado volta para pedir um novo, com aviso", async () => {
    verifyOtp.mockResolvedValue({ data: null, error: { code: "otp_expired" } });
    const url = location(await get("?token_hash=abc123&type=recovery"));
    expect(url.pathname).toBe("/esqueci-senha");
    expect(url.searchParams.get("erro")).toBe("link-invalido");
    expect(url.searchParams.has("token_hash")).toBe(false);
  });

  it("sem token_hash não chama o Supabase", async () => {
    const url = location(await get("?type=recovery"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(url.pathname).toBe("/esqueci-senha");
  });

  it("recusa tipos que não são recuperação de senha", async () => {
    const url = location(await get("?token_hash=abc123&type=signup"));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(url.pathname).toBe("/esqueci-senha");
    expect(url.searchParams.get("erro")).toBe("link-invalido");
  });

  describe("e-mail padrão do Supabase (?code=)", () => {
    it("troca o código pela sessão e leva para /redefinir-senha", async () => {
      exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
      const url = location(await get("?code=codigo-123"));
      expect(exchangeCodeForSession).toHaveBeenCalledWith("codigo-123");
      expect(url.pathname).toBe("/redefinir-senha");
      expect(url.search).toBe("");
    });

    it("código inválido ou de outro navegador volta para pedir um novo", async () => {
      exchangeCodeForSession.mockResolvedValue({ data: null, error: { code: "bad_code_verifier" } });
      const url = location(await get("?code=codigo-123"));
      expect(url.pathname).toBe("/esqueci-senha");
      expect(url.searchParams.get("erro")).toBe("link-invalido");
      expect(url.searchParams.has("code")).toBe(false);
    });

    it("erro devolvido pelo Supabase (link expirado) volta para pedir um novo", async () => {
      const url = location(
        await get("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid")
      );
      expect(exchangeCodeForSession).not.toHaveBeenCalled();
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(url.pathname).toBe("/esqueci-senha");
      expect(url.searchParams.get("erro")).toBe("link-invalido");
    });
  });
});
