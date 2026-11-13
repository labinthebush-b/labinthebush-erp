import { describe, expect, it } from "vitest";
import { pickNextAction, type NextActionInput } from "./next-action";

const none: NextActionInput = { overduePayablesCount: 0, overduePayablesAmount: 0, receivableCount: 0, receivableAmount: 0, overdueTasksCount: 0, openLeads: 0 };

describe("pickNextAction", () => {
  it("nada pendente: nenhuma ação (a tela não inventa urgência)", () => {
    expect(pickNextAction(none)).toBeNull();
  });

  it("conta atrasada vem antes de tudo", () => {
    const action = pickNextAction({ ...none, overduePayablesCount: 2, overduePayablesAmount: 7680, receivableCount: 3, receivableAmount: 1, openLeads: 6 });
    expect(action?.href).toBe("/financeiro");
    expect(action?.title).toBe("2 contas atrasadas");
    expect(action?.description).toContain("76,80");
  });

  it("depois cliente devendo, depois tarefa atrasada, depois lead", () => {
    expect(pickNextAction({ ...none, receivableCount: 1, receivableAmount: 14990, overdueTasksCount: 1, openLeads: 1 })?.href).toBe("/vendas");
    expect(pickNextAction({ ...none, overdueTasksCount: 1, openLeads: 1 })?.title).toBe("1 tarefa atrasada");
    expect(pickNextAction({ ...none, openLeads: 6 })?.title).toBe("6 leads em conversa");
  });

  it("singular e plural certos", () => {
    expect(pickNextAction({ ...none, receivableCount: 1, receivableAmount: 100 })?.description).toContain("1 venda espera");
    expect(pickNextAction({ ...none, openLeads: 1 })?.title).toBe("1 lead em conversa");
  });
});
