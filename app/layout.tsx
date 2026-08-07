import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PokerSync — Organize. Estude. Evolua.",
  description:
    "Plataforma de estudo, gestao de banca e evolucao continua para jogadores de poker.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`dark ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-void text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
