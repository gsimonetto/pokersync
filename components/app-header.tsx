"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

// Header padrao de todo modulo: fica grudado no topo e encolhe assim
// que a pagina rola, pra sobrar mais espaco de conteudo em telas com
// bastante coisa (Funil, Banca, etc.) sem cada modulo reinventar o
// proprio cabecalho. Usar em todo `app/**/page.tsx` no lugar de um
// <header> proprio — mesma margem (mx-auto max-w-[1280px] px-6) em
// todo canto.
//
// `top-0 sm:top-18`: existe um TopNav global (components/top-nav.tsx)
// que so' fica sticky a partir do breakpoint sm (`sm:sticky sm:top-0`,
// h-16/h-18). Sem esse offset aqui, os dois headers competiam pelo
// mesmo `top: 0` no desktop e ficavam sobrepostos ao rolar.
export function AppHeader({
  backHref,
  onBack,
  icon: Icon,
  iconColor,
  iconNode,
  title,
  subtitle,
  right,
  insideShell,
}: {
  /** Fallback so' usado quando nao ha historico de navegacao (ex: link direto/notificacao) — o clique normal volta pra tela anterior de verdade (router.back), nao pra uma rota fixa, ja que "ir pro inicio" e' o icone Home do TopNav. */
  backHref?: string;
  onBack?: () => void;
  icon?: ComponentType<{ size?: number; style?: React.CSSProperties }>;
  iconColor?: string;
  /** Alternativa a `icon` pra quando o "icone" e' algo custom (ex: Avatar do jogador). */
  iconNode?: ReactNode;
  /** Omitir quando o titulo ja' e' obvio pelo contexto (ex: nav logo acima) — o header fica so' com voltar + acoes. */
  title?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  /** true quando a pagina roda dentro do AppShell (components/app-shell.tsx)
      -- ali a barra do shell fica fora da area com scroll (nao compete
      pelo mesmo `top: 0`), entao o offset "sm:top-18" pensado pro TopNav
      global deixaria uma folga vazia acima deste header. */
  insideShell?: boolean;
}) {
  const router = useRouter();
  const [compacto, setCompacto] = useState(false);

  function handleBack() {
    if (onBack) return onBack();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else if (backHref) {
      router.push(backHref);
    }
  }

  // Threshold com histerese (some so' depois de 56px, volta so' abaixo de
  // 16px) em vez de reagir a 1px de scroll — evita o header "piscar"
  // entre os dois estados quando o usuario rola devagar perto do topo.
  useEffect(() => {
    let ticking = false;
    function avaliar() {
      ticking = false;
      setCompacto((atual) => {
        if (!atual && window.scrollY > 56) return true;
        if (atual && window.scrollY < 16) return false;
        return atual;
      });
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(avaliar);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 ${insideShell ? "" : "sm:top-18"} z-20 mb-4 flex flex-wrap items-center gap-3 border-b bg-void/95 backdrop-blur-sm transition-[padding,border-color] duration-300 ease-out print:static print:border-none print:bg-transparent ${
        compacto ? "border-hairline py-2.5" : "border-transparent py-4"
      }`}
    >
      {(backHref || onBack) && (
        <button
          onClick={handleBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {!compacto && iconNode}
      {!compacto && !iconNode && Icon && <Icon size={20} style={iconColor ? { color: iconColor } : undefined} />}

      <div className="min-w-0 flex-1">
        {title && (
          <h1 className={`m-0 truncate font-semibold tracking-tight transition-all duration-300 ease-out ${compacto ? "text-base" : "text-xl"}`}>
            {title}
          </h1>
        )}
        {subtitle && !compacto && (
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">{subtitle}</div>
        )}
      </div>

      {right}
    </header>
  );
}
