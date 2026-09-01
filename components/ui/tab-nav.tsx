"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Barra de abas com sublinhado — mesmo padrao do Painel do Time
// (Perfil do time / Estatisticas / Jogadores / ...): icone + rotulo,
// indicador border-b-2 na aba ativa, tudo dentro de um border-b comum.
// Reusado em qualquer modulo com navegacao de topo entre telas (Ranges,
// Revisor, Performance, Hub), no lugar do segmented-control/pill que
// cada um tinha do seu jeito.
//
// `href` (opcional, 2026-08): uma opcao pode navegar pra outra rota em
// vez de trocar estado local — usado pelo Player Evolution pra "Análise
// avançada" viver como a última aba da lista (mesmo visual, mesmo lugar),
// em vez de um botão separado ao lado da barra. Nunca fica "ativa" (o
// value corrente nunca bate com ela, já que clicar nela sai da página).
export function TabNav<T extends string>({
  value,
  onChange,
  options,
  className,
  glowIcons,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: LucideIcon; badge?: number; href?: string }[];
  className?: string;
  // Ícones com brilho sutil (ver .icon-glow em globals.css) — opt-in
  // porque o TabNav é reusado em telas fora do módulo de Análise, onde
  // esse acabamento não foi pedido.
  glowIcons?: boolean;
}) {
  return (
    <nav className={`relative flex justify-start gap-1 overflow-x-auto rounded-xl border border-hairline bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center ${className ?? ""}`} aria-label="Navegação de seção">
      {options.map((o) => {
        const Icon = o.icon;
        const active = !o.href && value === o.value;
        const itemClassName = `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-all ${
          active ? "bg-elevated text-ink shadow-[0_4px_14px_-8px_rgba(255,255,255,0.5)]" : "text-muted hover:bg-elevated/60 hover:text-ink"
        }`;
        const content = (
          <>
            <Icon size={15} className={glowIcons ? "icon-glow" : undefined} />
            {o.label}
            {o.badge != null && o.badge > 0 && (
              <span className="rounded-full bg-evolution px-1.5 text-[10px] font-bold leading-4 text-void">{o.badge}</span>
            )}
          </>
        );
        return o.href ? (
          <Link key={o.value} href={o.href} className={itemClassName}>
            {content}
          </Link>
        ) : (
          <button key={o.value} onClick={() => onChange(o.value)} className={itemClassName}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}
