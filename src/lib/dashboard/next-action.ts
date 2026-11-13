// "Próxima ação" do Dashboard: a UMA coisa mais urgente agora, com o botão
// que resolve. Regra fixa e explicável, na ordem do que custa mais caro
// deixar para depois: conta atrasada > cliente devendo > tarefa atrasada >
// lead esperando resposta.

import { formatCurrencyCents } from "@/lib/currency";

export type NextActionInput = {
  overduePayablesCount: number;
  overduePayablesAmount: number;
  receivableCount: number;
  receivableAmount: number;
  overdueTasksCount: number;
  openLeads: number;
};

export type NextAction = { tag: string; title: string; description: string; href: string; cta: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function pickNextAction(input: NextActionInput): NextAction | null {
  if (input.overduePayablesCount > 0) {
    return {
      tag: "Financeiro",
      title: `${plural(input.overduePayablesCount, "conta atrasada", "contas atrasadas")}`,
      description: `${formatCurrencyCents(input.overduePayablesAmount)} já venceram e ainda estão como "a pagar". Pague ou ajuste a data.`,
      href: "/financeiro",
      cta: "Abrir o Financeiro",
    };
  }
  if (input.receivableCount > 0) {
    return {
      tag: "Vendas",
      title: `${formatCurrencyCents(input.receivableAmount)} a receber`,
      description: `${plural(input.receivableCount, "venda espera", "vendas esperam")} pagamento. Dinheiro já vendido que ainda não entrou no caixa.`,
      href: "/vendas",
      cta: "Cobrar",
    };
  }
  if (input.overdueTasksCount > 0) {
    return {
      tag: "Tarefas",
      title: plural(input.overdueTasksCount, "tarefa atrasada", "tarefas atrasadas"),
      description: "Reveja o prazo ou conclua o que já passou da data.",
      href: "/tarefas",
      cta: "Ver tarefas",
    };
  }
  if (input.openLeads > 0) {
    return {
      tag: "Contatos",
      title: plural(input.openLeads, "lead em conversa", "leads em conversa"),
      description: "Pessoas que já mostraram interesse. Responder rápido é a venda mais barata do funil.",
      href: "/contatos",
      cta: "Abrir contatos",
    };
  }
  return null;
}
