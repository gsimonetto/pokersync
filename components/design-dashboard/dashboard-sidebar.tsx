"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, TrendingUp, BookOpen, LineChart, Layers, Trophy, Settings } from "lucide-react";

// Menu lateral flutuante, só ícones, com pílula roxa no item ativo.
// Os destinos são as rotas reais do app (as mesmas de
// lib/modules-data.tsx) — o protótipo navega pra valer, não é maquete
// morta. Fica escondido no mobile: lá quem navega é o dock de baixo.
const ITEMS = [
  { href: "/design/dashboard", label: "Painel", icon: Home },
  { href: "/treino", label: "Modo Treino", icon: Target },
  { href: "/revisor", label: "Revisão de Mãos", icon: BookOpen },
  { href: "/banca", label: "Gestão de Banca", icon: TrendingUp },
  { href: "/performance", label: "Performance", icon: LineChart },
  { href: "/ranges", label: "Construtor de Ranges", icon: Layers },
  { href: "/hub", label: "Hub de Evolução", icon: Trophy },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="psd-card fixed left-4 top-4 bottom-4 z-30 hidden w-[68px] flex-col items-center justify-between py-5 lg:flex">
      <nav className="flex flex-col items-center gap-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const ativo = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={ativo ? "page" : undefined}
              title={label}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                ativo ? "psd-active text-white" : "text-white/45 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={19} />
            </Link>
          );
        })}
      </nav>

      <Link
        href="/minha-conta"
        aria-label="Minha conta"
        title="Minha conta"
        className="flex h-11 w-11 items-center justify-center rounded-2xl text-white/40 transition-colors hover:bg-white/5 hover:text-white"
      >
        <Settings size={19} />
      </Link>
    </aside>
  );
}
