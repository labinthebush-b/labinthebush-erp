// Remote MCP endpoint for external AI assistants (ChatGPT, Claude, ...).
// Authenticated with a personal API key (Authorization: Bearer sk_erp_...),
// generated in Configurações → Integração com IA — see src/lib/ai/keys.ts
// for why this is a static key rather than OAuth at this stage.
//
// One MCP server + transport is created per request (stateless mode: no
// sessionIdGenerator) so this works on Vercel's serverless functions without
// needing sticky sessions or in-memory state across requests — every tool
// call is a self-contained POST that goes straight to Supabase and back.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveAiRequestContext } from "@/lib/ai/context";
import { createErpMcpServer } from "@/lib/ai/mcp-server";

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Chave de API ausente ou inválida. Envie 'Authorization: Bearer <sua-chave>'." }), {
    status: 401,
    headers: { "content-type": "application/json", "www-authenticate": "Bearer" },
  });
}

async function handle(request: Request): Promise<Response> {
  const ctx = await resolveAiRequestContext(request);
  if (!ctx) return unauthorized();

  const server = createErpMcpServer(ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function DELETE(request: Request) {
  return handle(request);
}
