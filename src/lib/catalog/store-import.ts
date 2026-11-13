// Importar produto a partir do link da loja (Nuvemshop). Puro: recebe o HTML
// da página do produto e devolve os campos que o ERP usa. A busca do HTML fica
// em app/api/products/import/route.ts, que só aceita os endereços da loja.
//
// Fontes na página, da mais confiável para a menos:
//   1. JSON-LD do produto PRINCIPAL (o "mainEntity" da WebPage, ou o Product
//      cujo @id é a própria página) — a página também traz JSON-LD dos
//      produtos relacionados, que precisam ser ignorados;
//   2. data-variants (tamanhos/cores e preço em centavos);
//   3. meta tags og:* como reserva;
//   4. produto NÃO LISTADO: a Nuvemshop serve a página sem og:* nem JSON-LD —
//      aí o nome vem do <h1>, a descrição da meta "description" e a foto das
//      variantes.

import { STORE_CDN_HOST } from "@/lib/brand";

export type StoreProduct = {
  storeUrl: string;
  name: string;
  /** Centavos. */
  price?: number;
  image?: string;
  description?: string;
  collection?: string;
  sizes?: string[];
  colors?: string[];
};

const STORE_HOSTS = ["labinthebush.com", "www.labinthebush.com"];

/** Só páginas de produto da loja da marca (evita o servidor buscar endereços arbitrários). */
export function normalizeStoreProductUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const allowed = STORE_HOSTS.includes(host) || host.endsWith(".lojavirtualnuvem.com.br");
  if (!allowed || !url.pathname.startsWith("/produtos/") || url.pathname.length <= "/produtos/".length) return null;
  return `https://${host}${url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`}`;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function meta(html: string, property: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property.replace(/[:.]/g, "\\$&")}["'][^>]*content=["']([^"']*)["']`, "i");
  const m = html.match(re);
  return m ? decodeEntities(m[1]).trim() || undefined : undefined;
}

type LdProduct = {
  "@type"?: string;
  "@id"?: string;
  name?: string;
  image?: string | string[];
  description?: string;
  offers?: { price?: string | number } | { price?: string | number }[];
  mainEntityOfPage?: { "@id"?: string };
};

function mainLdProduct(html: string, pageUrl: string): { product?: LdProduct; collection?: string } {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  let fallback: LdProduct | undefined;
  for (const block of blocks) {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(block);
    } catch {
      continue;
    }
    if (json["@type"] === "WebPage" && (json.mainEntity as LdProduct | undefined)?.["@type"] === "Product") {
      const crumbs = (json.breadcrumb as { itemListElement?: { position?: number; name?: string }[] } | undefined)?.itemListElement ?? [];
      // Início > COLEÇÃO > Produto: o penúltimo item é a coleção/categoria.
      const collectionCrumb = crumbs.length >= 3 ? crumbs[crumbs.length - 2]?.name : undefined;
      return { product: json.mainEntity as LdProduct, collection: collectionCrumb };
    }
    if (json["@type"] === "Product") {
      const id = (json["@id"] as string | undefined) ?? (json.mainEntityOfPage as { "@id"?: string } | undefined)?.["@id"];
      if (id && id.replace(/\/$/, "") === pageUrl.replace(/\/$/, "")) fallback = json as LdProduct;
    }
  }
  return { product: fallback };
}

/** Foto no maior tamanho que o CDN da Nuvemshop serve (…-1024-1024.webp). */
export function largestCdnImage(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const https = url.replace(/^http:\/\//, "https://");
  try {
    if (new URL(https).hostname !== STORE_CDN_HOST) return https;
  } catch {
    return undefined;
  }
  return https.replace(/-\d+-\d+\.(webp|jpe?g|png)$/i, "-1024-1024.$1");
}

function titleCase(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}

type Variant = { option0?: string | null; option1?: string | null; price_number_raw?: number; image_url?: string | null };

function variantOptions(html: string): { sizes?: string[]; colors?: string[]; price?: number; image?: string } {
  const raw = html.match(/data-variants="([^"]*)"/);
  if (!raw) return {};
  let variants: Variant[];
  try {
    variants = JSON.parse(decodeEntities(raw[1]));
  } catch {
    return {};
  }
  // Rótulo de cada eixo (Tamanho, Cor...) vem dos <label for="variation_N">.
  const labels = [...html.matchAll(/<label[^>]+for=["']variation_(\d+)["'][^>]*>\s*([^<]+?)\s*</gi)].map((m) => ({
    axis: Number(m[1]) - 1,
    label: m[2].toLowerCase(),
  }));
  const axisOf = (word: RegExp) => labels.find((l) => word.test(l.label))?.axis;
  const sizeAxis = axisOf(/tamanho|size/) ?? 0;
  const colorAxis = axisOf(/cor|color/);
  const unique = (axis: number | undefined) => {
    if (axis === undefined) return undefined;
    const key = `option${axis}` as keyof Variant;
    const values = [...new Set(variants.map((v) => v[key]).filter((x): x is string => typeof x === "string" && x.trim() !== ""))];
    return values.length > 0 ? values : undefined;
  };
  return {
    sizes: unique(sizeAxis),
    colors: colorAxis !== undefined && colorAxis !== sizeAxis ? unique(colorAxis) : undefined,
    // price_number_raw já é o preço de venda (com promoção, quando houver).
    price: typeof variants[0]?.price_number_raw === "number" ? variants[0].price_number_raw : undefined,
    image: variants.find((v) => v.image_url)?.image_url?.replace(/^\/\//, "https://") ?? undefined,
  };
}

function toCents(price: string | number | undefined): number | undefined {
  if (price === undefined || price === "") return undefined;
  const n = typeof price === "number" ? price : Number(String(price).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined;
}

export function parseStoreProductPage(html: string, pageUrl: string): StoreProduct | null {
  const { product, collection } = mainLdProduct(html, pageUrl);
  const variants = variantOptions(html);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const name = product?.name?.trim() || meta(html, "og:title") || h1;
  if (!name) return null;

  const offer = Array.isArray(product?.offers) ? product?.offers[0] : product?.offers;
  const ldImage = Array.isArray(product?.image) ? product?.image[0] : product?.image;

  return {
    storeUrl: pageUrl,
    name: decodeEntities(name),
    price: variants.price ?? toCents(offer?.price),
    image: largestCdnImage(ldImage ?? meta(html, "og:image:secure_url") ?? meta(html, "og:image") ?? variants.image),
    description: product?.description ? decodeEntities(product.description) : (meta(html, "og:description") ?? meta(html, "description")),
    collection: collection ? titleCase(decodeEntities(collection)) : undefined,
    sizes: variants.sizes,
    colors: variants.colors,
  };
}

/**
 * Endereço provável do produto na loja a partir do nome — a Nuvemshop monta a
 * URL assim ("NREM Camiseta" → /produtos/nrem-camiseta/). É só um palpite:
 * quem usa confere buscando a página (404 = não achou).
 */
export function guessStoreProductUrl(name: string, storeUrl = "https://labinthebush.com"): string | null {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${storeUrl}/produtos/${slug}/` : null;
}
