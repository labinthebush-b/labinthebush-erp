import { describe, expect, it } from "vitest";
import { actorInitials, describeActivity, viaLabel } from "./format";

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

describe("viaLabel", () => {
  it("mostra o nome da chave de IA", () => {
    expect(viaLabel("Claude")).toBe("pela IA (Claude)");
  });

  it("chave sem nome vira só 'pela IA'", () => {
    expect(viaLabel("IA")).toBe("pela IA");
  });

  it("mudança feita na tela não tem marca", () => {
    expect(viaLabel(null)).toBeNull();
  });
});
