"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

// Header padrao de todo modulo: fica grudado no topo e encolhe assim
// que a pagina rola, pra sobrar mais espaco de conteudo em telas com
// bastante coisa (Funil, Banca, etc.) sem cada modulo reinventar o
// proprio cabecalho. Usar em todo `app/**/page.tsx` no lugar de um
// <header> proprio — mesma margem (mx-auto max-w-6xl px-6) em todo canto.
export function AppHeader({
  backHref,
  onBack,
  icon: Icon,
  iconColor,
  iconNode,
  title,
  subtitle,
  right,
}: {
  /** Volta pra uma rota fixa (Link). Use `onBack` quando a volta depende de estado (ex: telas empilhadas dentro da mesma pagina). */
  backHref?: string;
  onBack?: () => void;
  icon?: ComponentType<{ size?: number; style?: React.CSSProperties }>;
  iconColor?: string;
  /** Alternativa a `icon` pra quando o "icone" e' algo custom (ex: Avatar do jogador). */
  iconNode?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  const [compacto, setCompacto] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setCompacto(!entry.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" />
      <header
        className={`sticky top-0 z-30 mb-6 flex flex-wrap items-center gap-3 border-b bg-void/95 backdrop-blur-sm transition-[padding] duration-150 print:static print:border-none print:bg-transparent ${
          compacto ? "border-hairline py-2.5" : "border-transparent py-4"
        }`}
      >
        {backHref ? (
          <Link
            href={backHref}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </Link>
        ) : onBack ? (
          <button
            onClick={onBack}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
        ) : null}

        {!compacto && iconNode}
        {!compacto && !iconNode && Icon && <Icon size={20} style={iconColor ? { color: iconColor } : undefined} />}

        <div className="min-w-0 flex-1">
          <h1 className={`m-0 truncate font-semibold tracking-tight transition-all ${compacto ? "text-base" : "text-xl"}`}>
            {title}
          </h1>
          {subtitle && !compacto && (
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">{subtitle}</div>
          )}
        </div>

        {right}
      </header>
    </>
  );
}
