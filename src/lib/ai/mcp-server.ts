// Builds one MCP server instance per request, scoped to the caller resolved
// by src/lib/ai/context.ts. Every tool here is a thin wrapper: all it does is
// parse args and call into src/lib/ai/tools/* (which in turn only ever calls
// existing domain repositories/calculations — see those files' own comments
// for why). This file owns naming/schemas/descriptions only.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AiRequestContext } from "./context";
import * as queries from "./tools/queries";
import { proposeTransaction, confirmTransaction, cancelTransaction } from "./tools/transactions";

const periodShape = {
  start: z.string().optional().describe("Data inicial yyyy-MM-dd (inclusive). Omitir para não filtrar."),
  end: z.string().optional().describe("Data final yyyy-MM-dd (inclusive). Omitir para não filtrar."),
};

function asToolResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function asErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

export function createErpMcpServer(ctx: AiRequestContext): McpServer {
  const server = new McpServer({ name: "erp-da-marca", version: "1.0.0" });

  server.registerTool(
    "get_caixa",
    {
      title: "Consultar caixa",
      description: "Saldo de caixa realizado (apenas transações concluídas) em um período. Aportes somam, retiradas subtraem, igual receitas/despesas.",
      inputSchema: periodShape,
    },
    async (args) => asToolResult(await queries.getCaixa(ctx, args))
  );

  server.registerTool(
    "get_resultado",
    {
      title: "Consultar resultado (DRE simplificado)",
      description: "Receita, custo dos produtos, lucro bruto, despesas operacionais e lucro líquido em um período. Exclui aporte/retirada (não são resultado).",
      inputSchema: periodShape,
    },
    async (args) => asToolResult(await queries.getResultado(ctx, args))
  );

  server.registerTool(
    "get_receitas_despesas",
    {
      title: "Consultar receitas e despesas",
      description: "Lista as transações de receita e despesa já realizadas (concluídas) em um período.",
      inputSchema: periodShape,
    },
    async (args) => asToolResult(await queries.getReceitasDespesas(ctx, args))
  );

  server.registerTool(
    "get_contas_a_pagar_receber",
    {
      title: "Consultar contas a pagar e a receber",
      description: "Lista todas as transações pendentes (ainda não realizadas), separadas em a pagar e a receber, com vencimento.",
      inputSchema: {},
    },
    async () => asToolResult(await queries.getContasAPagarReceber(ctx))
  );

  server.registerTool(
    "get_vendas",
    {
      title: "Consultar vendas",
      description: "Lista as vendas registradas em um período, com valor total e canal.",
      inputSchema: periodShape,
    },
    async (args) => asToolResult(await queries.getVendas(ctx, args))
  );

  server.registerTool(
    "get_tarefas",
    {
      title: "Consultar tarefas",
      description: "Lista as tarefas do usuário, opcionalmente filtradas por status.",
      inputSchema: { status: z.enum(["a_fazer", "em_andamento", "concluido"]).optional() },
    },
    async (args) => asToolResult(await queries.getTarefas(ctx, args))
  );

  server.registerTool(
    "get_produtos",
    {
      title: "Consultar produtos",
      description: "Lista os produtos do catálogo, opcionalmente filtrados por status.",
      inputSchema: { status: z.enum(["rascunho", "ativo", "arquivado"]).optional() },
    },
    async (args) => asToolResult(await queries.getProdutos(ctx, args))
  );

  server.registerTool(
    "propose_transaction",
    {
      title: "Propor um lançamento financeiro",
      description:
        "Monta uma proposta de lançamento (receita, despesa, aporte ou retirada) a partir de valores já interpretados pela IA e devolve um preview em texto. NÃO grava nada — é preciso chamar confirm_transaction com o proposalId retornado para efetivar. Use quando o usuário descrever um gasto/recebimento em linguagem natural.",
      inputSchema: {
        type: z.enum(["income", "expense", "owner_contribution", "owner_withdrawal"]).describe("income=receita, expense=despesa, owner_contribution=aporte, owner_withdrawal=retirada"),
        amount: z.number().positive().describe("Valor em reais, ex.: 80 ou 79.9"),
        description: z.string().min(1),
        date: z.string().optional().describe("yyyy-MM-dd; default hoje"),
        category: z.string().optional().describe("Id de categoria existente. Se omitido, uma é sugerida e aparece marcada como sugestão no preview."),
        paymentSource: z.enum(["conta_pessoal", "conta_marca", "dinheiro", "cartao", "outro"]).optional(),
        dueDate: z.string().optional().describe("yyyy-MM-dd. Informe para um lançamento futuro/pendente (a pagar ou a receber)."),
        notes: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return asToolResult(await proposeTransaction(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "confirm_transaction",
    {
      title: "Confirmar um lançamento proposto",
      description: "Efetiva a proposta criada por propose_transaction — só depois disso a transação passa a existir no Financeiro. Só chame depois que o usuário confirmar explicitamente o preview.",
      inputSchema: { proposalId: z.string() },
    },
    async (args) => {
      try {
        return asToolResult(await confirmTransaction(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "cancel_transaction",
    {
      title: "Cancelar um lançamento proposto",
      description: "Descarta uma proposta criada por propose_transaction sem gravar nada. Use quando o usuário recusar ou corrigir o preview.",
      inputSchema: { proposalId: z.string() },
    },
    async (args) => {
      try {
        return asToolResult(await cancelTransaction(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
  );

  return server;
}
