"use client";

import { useRef, useState, type ReactNode } from "react";

// Casca visual de todo card do Painel: preto (bg-surface), borda fina,
// um fio de luz no topo e o MESMO facho da tela de login — brilho branco
// que segue o mouse e some quando ele sai (ver "Spotlight do Mouse" em
// app/login/login-form.tsx: círculo de 400px, branco a 6%).
export function PainelCard({
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
  const ref = useRef<HTMLElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  return (
    <section
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      className={`painel-vidro group fade-in-up relative flex flex-col overflow-hidden rounded-3xl border border-white/10 p-5 sm:p-6 ${className}`}
      style={style}
    >
      {/* -inset-px cobre a borda também, senão o brilho para 1px antes
          dela e o recorte fica visível no canto. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(400px circle at ${mouse.x}px ${mouse.y}px, rgba(255, 255, 255, 0.06), transparent 40%)`,
        }}
      />
      {/* Fio de luz no topo: separa o card do fundo preto sem precisar de
          borda mais forte, que engrossaria a tela toda. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />

      <header className="relative flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          {icon && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-muted">{icon}</span>}
          {title}
        </h2>
        {action}
      </header>
      <div className="relative mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

// Quadradinho de ícone colorido — o detalhe que dá acabamento às listas
// (cada item ganha identidade visual sem precisar de texto extra). A cor
// vem em hex de 6 dígitos; os sufixos montam fundo e contorno translúcidos
// a partir dela, então basta passar o accent do módulo.
export function TileIcone({ children, cor, grande = false }: { children: ReactNode; cor: string; grande?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl ${grande ? "h-10 w-10" : "h-8 w-8"}`}
      style={{ background: `${cor}1f`, color: cor, boxShadow: `inset 0 0 0 1px ${cor}33` }}
    >
      {children}
    </span>
  );
}

// Selo pequeno (prioridade, categoria, data) — mesma ideia dos "High"/
// "Medium" da referência visual.
export function Selo({ children, cor }: { children: ReactNode; cor: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]"
      style={{ background: `${cor}1f`, color: cor }}
    >
      {children}
    </span>
  );
}

// Bloco interno de lista: dá ao item o mesmo tratamento de card pequeno
// (fundo próprio, canto arredondado, realce no hover) em vez de deixar o
// texto solto sobre o fundo do card.
export function Linha({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`painel-bloco rounded-2xl border border-white/5 p-3 transition-colors hover:border-white/15 ${className}`}>
      {children}
    </div>
  );
}

// Estado vazio/carregando padronizado — sem isto cada card inventava a
// própria frase e o grid ficava desalinhado no primeiro carregamento.
export function CardHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
