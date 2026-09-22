"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Target, TrendingUp, BookOpen, LineChart, Layers, Trophy, Settings } from "lucide-react";

// Navegação do painel. Os destinos são as rotas reais do app (as mesmas
// de lib/modules-data.tsx) — o protótipo navega pra valer.
const ITENS = [
  { href: "/design/dashboard", label: "Painel", icon: Home },
  { href: "/treino", label: "Modo Treino", icon: Target },
  { href: "/revisor", label: "Revisão de Mãos", icon: BookOpen },
  { href: "/banca", label: "Gestão de Banca", icon: TrendingUp },
  { href: "/performance", label: "Performance", icon: LineChart },
  { href: "/ranges", label: "Construtor de Ranges", icon: Layers },
  { href: "/hub", label: "Hub de Evolução", icon: Trophy },
];

// Barra lateral flutuante, só ícones, pílula roxa no ativo. Só no
// computador (lg+): no celular ela viraria uma coluna espremendo os
// cards, então lá quem navega é a MobileModuleBar abaixo.
export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="psd-card fixed left-4 top-4 bottom-4 z-30 hidden w-[68px] flex-col items-center justify-between py-5 lg:flex">
      <nav className="flex flex-col items-center gap-2">
        {ITENS.map(({ href, label, icon: Icon }) => {
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

// Mesma navegação no celular, como fita horizontal rolável NO TOPO do
// conteúdo (não como rodapé fixo: o rodapé de ícones foi removido a
// pedido do usuário). Fica fora do caminho do polegar mas continua
// sendo a única forma de trocar de módulo numa tela estreita.
export function MobileModuleBar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Módulos" className="psd-scroll -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
      {ITENS.map(({ href, label, icon: Icon }) => {
        const ativo = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-[13px] font-semibold transition-colors ${
              ativo ? "psd-active text-white" : "psd-card text-white/60"
            }`}
          >
            <Icon size={15} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
