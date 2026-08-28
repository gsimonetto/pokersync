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
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon: LucideIcon; badge?: number; href?: string }[];
  className?: string;
}) {
  return (
    <nav className={`relative flex justify-start gap-1 overflow-x-auto border-b border-hairline sm:justify-center ${className ?? ""}`}>
      {options.map((o) => {
        const Icon = o.icon;
        const active = !o.href && value === o.value;
        const itemClassName = `-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
          active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
        }`;
        const content = (
          <>
            <Icon size={15} />
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
