import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const updateUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser, updateUser } })),
}));

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import { updatePasswordAction } from "./actions";

function form(password: string, confirmation = password) {
  const data = new FormData();
  data.set("password", password);
  data.set("confirmation", confirmation);
  return data;
}

describe("updatePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("troca a senha e leva para o início", async () => {
    updateUser.mockResolvedValue({ data: {}, error: null });
    await expect(updatePasswordAction({}, form("nova-senha-123"))).rejects.toThrow("REDIRECT /");
    expect(updateUser).toHaveBeenCalledWith({ password: "nova-senha-123" });
  });

  it("não chama o Supabase quando a confirmação não confere", async () => {
    expect(await updatePasswordAction({}, form("nova-senha-123", "outra-senha-123"))).toEqual({
      error: "As senhas não conferem.",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("não chama o Supabase com senha curta", async () => {
    const result = await updatePasswordAction({}, form("curta"));
    expect(result.error).toMatch(/pelo menos 8/);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("sem sessão volta para pedir um novo link sem trocar a senha", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(updatePasswordAction({}, form("nova-senha-123"))).rejects.toThrow(
      "REDIRECT /esqueci-senha?erro=link-invalido"
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("avisa quando a nova senha é igual à atual", async () => {
    updateUser.mockResolvedValue({ data: null, error: { code: "same_password", message: "x" } });
    expect(await updatePasswordAction({}, form("nova-senha-123"))).toEqual({
      error: "A nova senha precisa ser diferente da atual.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("avisa quando o Supabase considera a senha fraca", async () => {
    updateUser.mockResolvedValue({ data: null, error: { code: "weak_password", message: "x" } });
    expect(await updatePasswordAction({}, form("nova-senha-123"))).toEqual({
      error: "Senha fraca. Use uma senha mais longa ou variada.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("erro desconhecido não expõe a mensagem crua do Supabase", async () => {
    updateUser.mockResolvedValue({ data: null, error: { code: "unexpected", message: "detalhe interno" } });
    const result = await updatePasswordAction({}, form("nova-senha-123"));
    expect(result.error).not.toContain("detalhe interno");
    expect(redirect).not.toHaveBeenCalled();
  });
});
