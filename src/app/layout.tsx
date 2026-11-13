import type { Metadata } from "next";
import { Golos_Text, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// As mesmas fontes do site da marca (labinthebush.com): Golos Text no texto,
// Space Grotesk nos títulos e números grandes.
const golos = Golos_Text({
  variable: "--font-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERP da Marca",
  description: "Sistema operacional interno da marca.",
  appleWebApp: { capable: true, title: "ERP LITB", statusBarStyle: "default" },
};

// Deliberately minimal: no domain providers and no AppShell here — those
// live in app/(app)/layout.tsx, scoped to the authenticated app only, so
// /login never mounts a single Supabase-backed provider.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${golos.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
