"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const FAQS = [
  {
    q: "Como registrar uma sessão de bankroll?",
    a: "Acesse Gestão de Banca → Registrar sessão. Preencha data, formato, buy-in e cashout. O sistema calcula ROI e leaks automaticamente.",
  },
  {
    q: "Meus dados ficam privados?",
    a: "Sim. Cada usuário só acessa suas próprias sessões, notificações e histórico de treinos — garantido por políticas de segurança no banco (RLS).",
  },
  {
    q: "Como funciona o Modo Treino?",
    a: "As mãos (spots) são resolvidas com solver GTO e ficam num catálogo compartilhado. Seu desempenho, porém, é individual e privado.",
  },
  {
    q: "Esqueci minha senha, o que faço?",
    a: "Na tela de login, clique em 'Esqueci minha senha' e siga as instruções enviadas no seu e-mail.",
  },
];

export function HelpMenu({ onClose }: { onClose: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[46px] z-50 w-[340px] overflow-hidden rounded-2xl border border-hairline bg-surface/[0.98] shadow-2xl shadow-black/60 backdrop-blur-xl"
    >
      <div className="border-b border-hairline px-4 py-3">
        <span className="text-sm font-bold text-ink">Central de Ajuda</span>
      </div>
      <div className="max-h-[380px] overflow-y-auto">
        {FAQS.map((f, i) => {
          const isOpen = expanded === i;
          return (
            <div key={i} className={i === FAQS.length - 1 ? "" : "border-b border-hairline"}>
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] text-ink"
              >
                <span className="flex-1">{f.q}</span>
                {isOpen ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
              </button>
              {isOpen && <p className="px-4 pb-3 text-xs leading-relaxed text-muted">{f.a}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
