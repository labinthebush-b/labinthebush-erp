import type { MetadataRoute } from "next";

// Makes the ERP installable ("Instalar app" in Chrome/Edge, "Adicionar à tela
// inicial" on the phone): it then opens in its own window, with the brand icon,
// instead of a browser tab. Colors mirror --color-canvas-white in globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ERP da Marca — Lab in the Bush",
    short_name: "ERP LITB",
    description: "Sistema operacional interno da marca.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
