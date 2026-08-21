"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ModalPortal } from "./modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";

// Substitui o confirm() nativo do navegador.
//
// O confirm() do sistema desenha uma caixa branca com a fonte e os
// botoes do SO no meio de uma interface toda dark — quebra a
// identidade visual inteira e ainda mostra o dominio do site no topo.
// Fora isso ele nao distingue acao destrutiva de acao comum: "Excluir
// este range" e "Carregar biblioteca" saem com o mesmo botao azul
// padrao.
//
// A API e' promise-based de proposito: o call site continua sendo uma
// guarda de uma linha, igual era antes —
//   if (!(await confirm("Excluir?"))) return;
// — em vez de virar maquina de estado com dois callbacks em cada tela.

export interface ConfirmOptions {
  /** Pergunta principal. Unico campo obrigatorio. */
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" pinta o botao de confirmar em vermelho (padrao pra exclusao). */
  tone?: "danger" | "default";
  /** So um botao de "Ok" — substitui o alert() nativo (aviso, nao pergunta). */
  okOnly?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm precisa do <ConfirmProvider> (montado no app/layout.tsx).");
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  // Guarda o resolve da Promise aberta pra responder quando o usuario
  // escolher. Ref (nao state) porque trocar isso nao deve re-renderizar.
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending(normalized);
    });
  }, []);

  const settle = useCallback((answer: boolean) => {
    resolverRef.current?.(answer);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && <ConfirmDialog opts={pending} onAnswer={settle} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ opts, onAnswer }: { opts: ConfirmOptions; onAnswer: (v: boolean) => void }) {
  // Aviso (okOnly) nunca e' vermelho: nao ha nada destrutivo pra sinalizar.
  const danger = !opts.okOnly && opts.tone !== "default";
  // Esc = cancelar, mesma semantica do confirm() nativo.
  useEscapeToClose(() => onAnswer(false));

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
        onClick={() => onAnswer(false)}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-black/60"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-3 p-5">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full ${
                danger ? "bg-negative/15 text-negative" : "bg-elevated text-muted"
              }`}
            >
              <AlertTriangle size={17} />
            </span>
            <div className="min-w-0 flex-1">
              {opts.title && <h3 className="mb-1 text-sm font-bold text-ink">{opts.title}</h3>}
              <p className="text-[13px] leading-relaxed text-muted">{opts.message}</p>
            </div>
          </div>

          <div className="flex gap-2 border-t border-hairline p-3">
            {!opts.okOnly && (
              <button
                onClick={() => onAnswer(false)}
                className="flex-1 rounded-lg border border-hairline bg-void py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-ink/40"
              >
                {opts.cancelLabel ?? "Cancelar"}
              </button>
            )}
            <button
              autoFocus
              onClick={() => onAnswer(true)}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-90 ${
                danger ? "bg-negative text-void" : "bg-ink text-void"
              }`}
            >
              {opts.confirmLabel ?? (opts.okOnly ? "Ok" : "Confirmar")}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
