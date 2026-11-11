import { describe, expect, it } from "vitest";
import { actorInitials, describeActivity } from "./format";

describe("describeActivity", () => {
  it("monta a frase com ação, tipo e resumo", () => {
    expect(describeActivity("created", "products", "Camiseta")).toBe("adicionou o produto Camiseta");
    expect(describeActivity("deleted", "sales", "2026-11-04")).toBe("apagou a venda 2026-11-04");
  });

  it("funciona sem resumo e com tabela desconhecida", () => {
    expect(describeActivity("updated", "tasks", null)).toBe("editou a tarefa");
    expect(describeActivity("updated", "outra", null)).toBe("editou o registro");
  });
});

describe("actorInitials", () => {
  it("usa até duas iniciais do nome", () => {
    expect(actorInitials("Ana Lima Souza")).toBe("AL");
  });

  it("usa só a parte antes do @ de um e-mail", () => {
    expect(actorInitials("ana@exemplo.com")).toBe("A");
  });

  it("não quebra com texto vazio", () => {
    expect(actorInitials("  ")).toBe("?");
  });
});
