import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
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
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
