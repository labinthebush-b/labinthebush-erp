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
import { cancelProposal, confirmProposal, proposeContact, proposeSale, proposeTask } from "./tools/actions";

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
    "get_estoque",
    {
      title: "Consultar estoque",
      description: "Estoque por produto, tamanho e cor (saldo, situação ok/baixo/esgotado), totais de peças e valor ao custo, e produtos que ainda não têm controle de estoque.",
      inputSchema: {},
    },
    async () => asToolResult(await queries.getEstoque(ctx))
  );

  server.registerTool(
    "get_contatos",
    {
      title: "Consultar contatos (CRM)",
      description: "Contatos com estágio no funil do CRM, WhatsApp/Instagram/e-mail, tags e histórico de compras (total, nº de compras, última compra). Use 'busca' para filtrar por nome, telefone, @ ou e-mail.",
      inputSchema: { busca: z.string().optional() },
    },
    async (args) => asToolResult(await queries.getContatos(ctx, args))
  );

  server.registerTool(
    "get_campanhas",
    {
      title: "Consultar campanhas de marketing",
      description: "Campanhas registradas: canal, período, situação, custo, UTM e posts do Instagram ligados.",
      inputSchema: {},
    },
    async () => asToolResult(await queries.getCampanhas(ctx))
  );

  server.registerTool(
    "get_marketing",
    {
      title: "Consultar marketing (site e Instagram)",
      description: "Números ao vivo do site (Google Analytics: sessões, usuários, funil produto→carrinho→checkout→compra) e do Instagram (alcance, visualizações, engajamento, toques no link da bio) nos últimos 7 ou 30 dias.",
      inputSchema: { dias: z.union([z.literal(7), z.literal(30)]).optional() },
    },
    async (args) => {
      try {
        return asToolResult(await queries.getMarketing(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "propose_sale",
    {
      title: "Propor o registro de uma venda",
      description:
        "Monta uma venda (um ou mais produtos, tamanho/cor quando o produto tem, canal, pagamento pago/pendente, frete) e devolve um preview com total, taxa e aviso de estoque. NÃO grava nada: chame confirm_proposal com o proposalId depois que o usuário confirmar. Ao confirmar, a venda entra no Financeiro e baixa o estoque, igual ao formulário do ERP.",
      inputSchema: {
        items: z
          .array(
            z.object({
              productId: z.string().optional(),
              productName: z.string().optional().describe("Alternativa ao productId; precisa identificar um produto só."),
              size: z.string().optional(),
              color: z.string().optional(),
              quantity: z.number().int().positive(),
              unitPrice: z.number().positive().optional().describe("Em reais; default = preço do produto."),
            })
          )
          .min(1),
        channel: z.enum(["nuvemshop", "instagram", "whatsapp", "outro"]),
        date: z.string().optional().describe("yyyy-MM-dd; default hoje"),
        contactId: z.string().optional(),
        payment: z.enum(["pago", "pendente"]).optional().describe("default pago"),
        shippingCost: z.number().min(0).optional().describe("Custo real do frete em reais"),
        notes: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return asToolResult(await proposeSale(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "propose_task",
    {
      title: "Propor uma tarefa",
      description: "Monta uma tarefa (título, prazo, prioridade). NÃO grava: chame confirm_proposal depois que o usuário confirmar.",
      inputSchema: {
        title: z.string().min(1),
        description: z.string().optional(),
        dueDate: z.string().optional().describe("yyyy-MM-dd"),
        priority: z.enum(["baixa", "media", "alta"]).optional(),
      },
    },
    async (args) => {
      try {
        return asToolResult(await proposeTask(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "propose_contact",
    {
      title: "Propor um contato novo",
      description: "Monta um contato (nome, WhatsApp, Instagram, e-mail) e avisa se já existe um parecido. NÃO grava: chame confirm_proposal depois que o usuário confirmar.",
      inputSchema: { name: z.string().min(1), whatsapp: z.string().optional(), instagram: z.string().optional(), email: z.string().optional() },
    },
    async (args) => {
      try {
        return asToolResult(await proposeContact(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "confirm_proposal",
    {
      title: "Confirmar qualquer proposta",
      description: "Efetiva uma proposta (lançamento, venda, tarefa ou contato). Só chame depois que o usuário confirmar explicitamente o preview.",
      inputSchema: { proposalId: z.string() },
    },
    async (args) => {
      try {
        return asToolResult(await confirmProposal(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
  );

  server.registerTool(
    "cancel_proposal",
    {
      title: "Cancelar qualquer proposta",
      description: "Descarta uma proposta sem gravar nada.",
      inputSchema: { proposalId: z.string() },
    },
    async (args) => {
      try {
        return asToolResult(await cancelProposal(ctx, args));
      } catch (error) {
        return asErrorResult(error);
      }
    }
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
