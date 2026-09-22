"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, BookOpen, TrendingUp, LineChart, Layers, Users } from "lucide-react";

// Dock flutuante estilo macOS — navegação SÓ no celular, onde a barra
// lateral não cabe. No computador ele fica escondido (lg:hidden): ali a
// lateral já faz esse papel e os dois juntos eram navegação duplicada.
// O rodapé do computador passou a ser da barra de ações rápidas.
const DOCK = [
  { href: "/design/dashboard", label: "Painel", icon: Home, cor: "#a855f7" },
  { href: "/treino", label: "Treino", icon: Target, cor: "#2FB89A" },
  { href: "/revisor", label: "Revisão", icon: BookOpen, cor: "#A855F7" },
  { href: "/banca", label: "Banca", icon: TrendingUp, cor: "#5AA6E0" },
  { href: "/performance", label: "Performance", icon: LineChart, cor: "#22D3EE" },
  { href: "/ranges", label: "Ranges", icon: Layers, cor: "#E0559E" },
  { href: "/time", label: "Time", icon: Users, cor: "#6366F1" },
];

export function DashboardDock() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação rápida"
      className="psd-card fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-end gap-1.5 px-3 py-2.5 sm:gap-2 sm:px-4 lg:hidden"
    >
      {DOCK.map(({ href, label, icon: Icon, cor }) => {
        const ativo = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={ativo ? "page" : undefined}
            className={`psd-dock-item flex h-11 w-11 items-center justify-center rounded-2xl sm:h-12 sm:w-12 ${
              ativo ? "psd-active" : "bg-white/[0.06] hover:bg-white/10"
            }`}
          >
            {/* Cor do ícone = accent real do módulo (lib/modules-data.tsx),
                pra o dock ser reconhecível pelo mesmo código de cor usado
                no resto do app. O item ativo vira branco sobre o roxo. */}
            <Icon size={20} color={ativo ? "#ffffff" : cor} />
          </Link>
        );
      })}
    </nav>
  );
}
