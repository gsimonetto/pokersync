"use client";

import { useRef, useState, type ReactNode } from "react";

// Casca visual de todo card do Painel: preto (bg-surface), borda fina e
// o MESMO facho de luz da tela de login — um brilho branco que segue o
// mouse dentro do card e some quando ele sai (ver o "Spotlight do Mouse"
// em app/login/login-form.tsx, copiado aqui com os mesmos valores:
// círculo de 400px, branco a 6%).
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
      className={`group fade-in-up relative flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface p-5 ${className}`}
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

      <header className="relative flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      <div className="relative mt-4 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

// Estado vazio/carregando padronizado — sem isto cada card inventava a
// própria frase e o grid ficava desalinhado no primeiro carregamento.
export function CardHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
