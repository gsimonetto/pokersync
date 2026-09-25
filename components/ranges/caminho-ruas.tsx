"use client";

import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import type { Rua } from "./use-construtor";
import { CartasTexto, TOTAL_COMBOS, numCombos, pct } from "./pecas";

// Caminho do range rua por rua: quanto entra no pré-flop e quanto continua
// depois de cada carta. Clicar numa rua de trás volta pra ela.

export function CaminhoRuas({
  totalCombos,
  ruas,
  board,
  aguardando,
  onIr,
}: {
  totalCombos: number;
  ruas: Rua[];
  board: string[];
  aguardando: 4 | 5 | null;
  onIr: (cartas: 0 | 3 | 4) => void;
}) {
  const atual = aguardando ?? (board.length >= 3 ? board.length : 0);
  const passos: { chave: 0 | 3 | 4 | 5; titulo: React.ReactNode; info: string; feito: boolean }[] = [
    {
      chave: 0,
      titulo: "Pré-flop",
      info: `${numCombos(totalCombos)} combos · ${pct(totalCombos / TOTAL_COMBOS)} das mãos`,
      feito: true,
    },
  ];
  const nomes = { 3: "Flop", 4: "Turn", 5: "River" } as const;
  for (const n of [3, 4, 5] as const) {
    const rua = ruas.find((r) => r.cartas === n);
    const cartas = n === 3 ? board.slice(0, 3) : board[n - 1] ? [board[n - 1]] : [];
    let info = n === 3 ? "escolha o board" : "próximo passo";
    if (rua)
      info = rua.semSelecao
        ? `${numCombos(rua.analise.total)} combos`
        : `continua ${numCombos(rua.continuaTotal)} (${pct(rua.analise.total ? rua.continuaTotal / rua.analise.total : 0, 0)})`;
    else if (aguardando === n) info = "escolha a carta";
    passos.push({
      chave: n,
      titulo: (
        <>
          {nomes[n]}
          {cartas.length > 0 && (
            <span className="ml-1.5">
              <CartasTexto cartas={cartas} />
            </span>
          )}
        </>
      ),
      info,
      feito: !!rua,
    });
  }

  return (
    <nav aria-label="Ruas" className="painel-vidro painel-scroll flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 px-3 py-2.5 sm:gap-2 sm:px-3.5">
      {passos.map((p, i) => {
        const ativo = p.chave === atual;
        const clicavel = p.feito && !ativo && p.chave !== 5;
        return (
          <Fragment key={p.chave}>
            <button
              type="button"
              disabled={!clicavel}
              onClick={() => clicavel && onIr(p.chave as 0 | 3 | 4)}
              title={clicavel ? (p.chave === 0 ? "Voltar pro pré-flop (tira o board)" : "Voltar pra essa rua") : undefined}
              className="shrink-0 rounded-xl border px-2.5 py-1.5 text-left transition enabled:hover:border-white/25 sm:px-3"
              style={{
                borderColor: ativo ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.10)",
                background: ativo ? "rgba(212,175,55,0.10)" : "rgba(255,255,255,0.02)",
                opacity: p.feito || ativo ? 1 : 0.5,
              }}
            >
              <div className="text-[12px] font-semibold" style={{ color: ativo ? "#e8cb6a" : "rgba(255,255,255,0.9)" }}>
                {p.titulo}
              </div>
              <div className="tnum text-[11px] text-muted">{p.info}</div>
            </button>
            {i < passos.length - 1 && <ChevronRight size={14} className="shrink-0 text-muted" />}
          </Fragment>
        );
      })}
    </nav>
  );
}
