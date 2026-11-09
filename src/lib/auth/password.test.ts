import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("aceita senha com o mínimo de caracteres e confirmação igual", () => {
    const senha = "a".repeat(MIN_PASSWORD_LENGTH);
    expect(validateNewPassword(senha, senha)).toBeNull();
  });

  it("recusa senha vazia", () => {
    expect(validateNewPassword("", "")).toBe("Informe a nova senha.");
  });

  it("recusa senha com um caractere a menos que o mínimo", () => {
    const senha = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(validateNewPassword(senha, senha)).toMatch(/pelo menos 8 caracteres/);
  });

  it("recusa confirmação diferente", () => {
    expect(validateNewPassword("senha-forte-1", "senha-forte-2")).toBe("As senhas não conferem.");
  });

  it("não remove espaços: confirmação com espaço a mais não confere", () => {
    expect(validateNewPassword("senha-forte", "senha-forte ")).toBe("As senhas não conferem.");
  });
});
