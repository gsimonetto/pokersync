"use client";

import type { ReactNode } from "react";

// Casca visual comum de todo widget do protótipo: vidro escuro, título
// discreto em caixa alta (mesma hierarquia tipográfica dos cards do
// Diário em components/diario/) e um canto livre pra ação da direita.
export function GlassCard({
  title,
  icon,
  action,
  children,
  className = "",
  style,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section className={`psd-card fade-in-up flex flex-col p-5 ${className}`} style={style}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-white/55">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      <div className="mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

// Estado vazio/carregando padronizado — sem isto cada card inventava a
// própria frase e o grid ficava com alturas diferentes no primeiro
// carregamento.
export function CardHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-white/45">{children}</p>;
}
