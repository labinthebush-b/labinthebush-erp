import { beforeEach, describe, expect, it, vi } from "vitest";

const resetPasswordForEmail = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { resetPasswordForEmail } })),
}));

let origin: string | null = "http://localhost:3000";
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers(origin ? { origin } : {})),
}));

import { requestPasswordResetAction } from "./actions";

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

describe("requestPasswordResetAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    origin = "http://localhost:3000";
  });

  it("pede o link ao Supabase com o e-mail sem espaços", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    expect(await requestPasswordResetAction({}, form("  eu@exemplo.com "))).toEqual({ sent: true });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("eu@exemplo.com", {
      redirectTo: "http://localhost:3000/auth/confirm",
    });
  });

  it("sem cabeçalho Origin deixa o Supabase usar a Site URL", async () => {
    origin = null;
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await requestPasswordResetAction({}, form("eu@exemplo.com"));
    expect(resetPasswordForEmail).toHaveBeenCalledWith("eu@exemplo.com", undefined);
  });

  it("dá a mesma resposta quando o Supabase devolve erro (não revela se o e-mail existe)", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: null, error: { message: "User not found", status: 400 } });
    expect(await requestPasswordResetAction({}, form("ninguem@exemplo.com"))).toEqual({ sent: true });
  });

  it("dá a mesma resposta no limite de envio", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: null, error: { message: "rate limit", status: 429 } });
    expect(await requestPasswordResetAction({}, form("eu@exemplo.com"))).toEqual({ sent: true });
  });

  it("dá a mesma resposta quando a chamada falha", async () => {
    resetPasswordForEmail.mockRejectedValue(new Error("fetch failed"));
    expect(await requestPasswordResetAction({}, form("eu@exemplo.com"))).toEqual({ sent: true });
  });

  it("pede o e-mail quando vazio, sem chamar o Supabase", async () => {
    expect(await requestPasswordResetAction({}, form("   "))).toEqual({ error: "Informe o e-mail." });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
