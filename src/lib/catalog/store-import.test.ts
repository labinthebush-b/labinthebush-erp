import { describe, expect, it } from "vitest";
import { guessStoreProductUrl, largestCdnImage, normalizeStoreProductUrl, parseStoreProductPage } from "./store-import";

const PAGE = "https://labinthebush.com/produtos/nrem-camiseta/";
const CDN = "https://dcdn-us.mitiendanube.com/stores/008/085/163/products";

/** Recorte do HTML real da loja (nov/2026), só com o que o importador lê. */
function storeHtml({ withVariants = true } = {}): string {
  const variants = JSON.stringify([
    { option0: "P", option1: null, price_number_raw: 14990 },
    { option0: "M", option1: null, price_number_raw: 14990 },
    { option0: "G", option1: null, price_number_raw: 14990 },
    { option0: "GG", option1: null, price_number_raw: 14990 },
  ]).replace(/"/g, "&quot;");
  return `
<meta property="og:title" content="NREM Camiseta" />
<meta property="og:image:secure_url" content="${CDN}/still-tee-nrem-640-0.webp" />
<script type="application/ld+json">{"@context":"https://schema.org/","@type":"WebPage","name":"x","breadcrumb":{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Início"},{"@type":"ListItem","position":2,"name":"HIPNAGOGIA"},{"@type":"ListItem","position":3,"name":"NREM Camiseta"}]},"mainEntity":{"@type":"Product","@id":"${PAGE}","name":"NREM Camiseta","image":"http://dcdn-us.mitiendanube.com/stores/008/085/163/products/still-tee-nrem-480-0.webp","description":"Camiseta NREM: 100% algodão &amp; estampa DTG.","offers":{"@type":"Offer","price":"149.9"}}}</script>
<script type="application/ld+json">{"@context":"https://schema.org/","@type":"Product","mainEntityOfPage":{"@id":"https://labinthebush.com/produtos/komodo-camiseta/"},"name":"Komodo Camiseta","offers":{"price":"99.9"}}</script>
${withVariants ? `<div data-variants="${variants}"></div><label class="form-label" for="variation_1">Tamanho</label>` : ""}
`;
}

describe("normalizeStoreProductUrl", () => {
  it("aceita só páginas de produto da loja, com ou sem https/www/barra final", () => {
    expect(normalizeStoreProductUrl("labinthebush.com/produtos/nrem-camiseta")).toBe(PAGE);
    expect(normalizeStoreProductUrl("https://www.labinthebush.com/produtos/nrem-camiseta/?variant=1")).toBe("https://www.labinthebush.com/produtos/nrem-camiseta/");
    expect(normalizeStoreProductUrl("https://labinthebush2.lojavirtualnuvem.com.br/produtos/x/")).toBe("https://labinthebush2.lojavirtualnuvem.com.br/produtos/x/");
  });

  it("recusa outros sites, páginas que não são de produto e lixo", () => {
    expect(normalizeStoreProductUrl("https://evil.com/produtos/nrem/")).toBeNull();
    expect(normalizeStoreProductUrl("https://labinthebush.com.evil.com/produtos/x/")).toBeNull();
    expect(normalizeStoreProductUrl("https://labinthebush.com/")).toBeNull();
    expect(normalizeStoreProductUrl("https://labinthebush.com/produtos/")).toBeNull();
    expect(normalizeStoreProductUrl("http://localhost/produtos/x")).toBeNull();
    expect(normalizeStoreProductUrl("nada a ver")).toBeNull();
  });
});

describe("parseStoreProductPage", () => {
  it("lê o produto principal (não os relacionados): nome, preço, foto grande, descrição, coleção e tamanhos", () => {
    expect(parseStoreProductPage(storeHtml(), PAGE)).toEqual({
      storeUrl: PAGE,
      name: "NREM Camiseta",
      price: 14990,
      image: `${CDN}/still-tee-nrem-1024-1024.webp`,
      description: "Camiseta NREM: 100% algodão & estampa DTG.",
      collection: "Hipnagogia",
      sizes: ["P", "M", "G", "GG"],
      colors: undefined,
    });
  });

  it("sem variantes: preço vem do JSON-LD e não inventa tamanhos", () => {
    const p = parseStoreProductPage(storeHtml({ withVariants: false }), PAGE);
    expect(p?.price).toBe(14990);
    expect(p?.sizes).toBeUndefined();
  });

  it("página sem JSON-LD: usa as meta tags", () => {
    const html = `<meta property="og:title" content="Pôster &amp; Arte" /><meta property="og:image" content="http://dcdn-us.mitiendanube.com/a/b-640-0.webp" />`;
    expect(parseStoreProductPage(html, PAGE)).toMatchObject({ name: "Pôster & Arte", image: "https://dcdn-us.mitiendanube.com/a/b-1024-1024.webp", price: undefined });
  });

  it("produto NÃO LISTADO (sem og:* nem JSON-LD): nome do <h1>, descrição da meta, foto e preço das variantes", () => {
    const variants = JSON.stringify([
      { option0: "P", price_number_raw: 49900, image_url: "//dcdn-us.mitiendanube.com/stores/008/085/163/products/jaqueta-frente-1024-1024.webp" },
      { option0: "GG", price_number_raw: 49900, image_url: null },
    ]).replace(/"/g, "&quot;");
    const html = `<title>Jaqueta | Lab</title><meta name="description" content="Jaqueta preta &amp; com capuz." />
<h1 class="js-product-name">SLEEPWALKER Jaqueta <span>[EDIÇÃO LIMITADA]</span></h1>
<div data-variants="${variants}"></div><label for="variation_1">Tamanho</label>`;
    expect(parseStoreProductPage(html, "https://labinthebush.com/produtos/sleepwalker-jaqueta/")).toEqual({
      storeUrl: "https://labinthebush.com/produtos/sleepwalker-jaqueta/",
      name: "SLEEPWALKER Jaqueta [EDIÇÃO LIMITADA]",
      price: 49900,
      image: "https://dcdn-us.mitiendanube.com/stores/008/085/163/products/jaqueta-frente-1024-1024.webp",
      description: "Jaqueta preta & com capuz.",
      collection: undefined,
      sizes: ["P", "GG"],
      colors: undefined,
    });
  });

  it("página que não é de produto: null", () => {
    expect(parseStoreProductPage("<html><body>404</body></html>", PAGE)).toBeNull();
  });
});

describe("largestCdnImage", () => {
  it("só reescreve o tamanho no CDN da loja", () => {
    expect(largestCdnImage("https://example.com/x-640-0.webp")).toBe("https://example.com/x-640-0.webp");
    expect(largestCdnImage(undefined)).toBeUndefined();
  });
});

describe("guessStoreProductUrl", () => {
  it("monta o endereço como a Nuvemshop: minúsculas, sem acento, hífen no lugar de espaço e pontuação", () => {
    expect(guessStoreProductUrl("NREM Camiseta")).toBe("https://labinthebush.com/produtos/nrem-camiseta/");
    expect(guessStoreProductUrl("Komodo — camiseta")).toBe("https://labinthebush.com/produtos/komodo-camiseta/");
    expect(guessStoreProductUrl("'Frags/Hipnagogia' Pôster")).toBe("https://labinthebush.com/produtos/frags-hipnagogia-poster/");
  });

  it("nome sem letras nem números: sem palpite", () => {
    expect(guessStoreProductUrl(" — ")).toBeNull();
  });
});
