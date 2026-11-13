import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeStoreProductUrl, parseStoreProductPage } from "@/lib/catalog/store-import";

const MAX_HTML_BYTES = 3_000_000;

/**
 * GET /api/products/import?url=<página do produto na loja>
 * Busca a página no servidor (o navegador não pode, por CORS) e devolve nome,
 * preço, foto, descrição, coleção e tamanhos. Só aceita páginas de produto da
 * loja da marca — nunca vira um "proxy" para qualquer endereço.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const url = normalizeStoreProductUrl(request.nextUrl.searchParams.get("url") ?? "");
  if (!url) {
    return Response.json({ error: "Cole o link de um produto da loja (labinthebush.com/produtos/…)." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ERP-LabInTheBush/1.0)", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "A loja não respondeu. Tente de novo em instantes." }, { status: 502 });
  }
  // Se a loja redirecionar, o destino também precisa ser uma página de produto dela.
  if (res.url && !normalizeStoreProductUrl(res.url)) {
    return Response.json({ error: "O link levou para fora da página do produto." }, { status: 400 });
  }
  if (res.status === 404) return Response.json({ error: "Produto não encontrado na loja." }, { status: 404 });
  if (!res.ok) return Response.json({ error: `A loja respondeu com erro ${res.status}.` }, { status: 502 });

  const html = await res.text();
  if (html.length > MAX_HTML_BYTES) return Response.json({ error: "Página grande demais para ler." }, { status: 502 });

  const product = parseStoreProductPage(html, normalizeStoreProductUrl(res.url || url) ?? url);
  if (!product) return Response.json({ error: "Não encontrei os dados do produto nessa página." }, { status: 422 });
  return Response.json(product, { headers: { "cache-control": "private, no-store" } });
}
