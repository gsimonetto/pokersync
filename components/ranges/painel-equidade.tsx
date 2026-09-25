"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { equidadeEntre, equidadePorMao, type ResultadoEquidade } from "@/lib/ranges/equidade";
import { combosDoRange } from "@/lib/ranges/notacao";
import { cartaTexto, maoDoCombo, type Carta } from "@/lib/ranges/cartas";
import type { OutroRange } from "./use-construtor";
import { Chip, VERDE, VERMELHO, OURO_CLARO, corEquidade, pct } from "./pecas";

// Equidade: a chance do seu range ganhar do range do vilão até o river
// (simulação), e a de cada mão da grade -- pra ver o que é valor e o que
// desiste.

export function PainelEquidade({
  heroi,
  board,
  vilao,
  sugestoes,
  onVilao,
  onEscolherVilao,
  colorir,
  onColorir,
  onEqPorMao,
}: {
  /** Combos do seu range nessa rua. */
  heroi: Map<string, number>;
  board: Carta[];
  vilao: OutroRange | null;
  sugestoes: OutroRange[];
  onVilao: (r: OutroRange) => void;
  onEscolherVilao: () => void;
  colorir: boolean;
  onColorir: (v: boolean) => void;
  onEqPorMao: (eq: Record<string, number>) => void;
}) {
  const [total, setTotal] = useState<ResultadoEquidade | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [porMao, setPorMao] = useState<Record<string, number>>({});
  const chaveBoard = board.map(cartaTexto).join("");

  const combosVilao = useMemo(() => (vilao ? combosDoRange(vilao.pesos, vilao.pesosCombo) : null), [vilao]);

  useEffect(() => {
    setTotal(null);
    setPorMao({});
    onEqPorMao({});
    if (!combosVilao || !heroi.size) return;
    setCalculando(true);
    let cancelarMaos: (() => void) | null = null;
    const t = setTimeout(() => {
      setTotal(equidadeEntre(heroi, combosVilao, board, 6000));
      setCalculando(false);
      cancelarMaos = equidadePorMao(heroi, combosVilao, board, (parcial) => {
        setPorMao(parcial);
        onEqPorMao(parcial);
      });
    }, 180);
    return () => {
      clearTimeout(t);
      cancelarMaos?.();
    };
    // chaveBoard no lugar de board: mesma mão, mesma conta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroi, combosVilao, chaveBoard, onEqPorMao]);

  // Faixas: quanto do range (em combos) está forte, no meio ou fraco.
  const faixas = useMemo(() => {
    const usadas = new Set(board.map(cartaTexto));
    let forte = 0;
    let meio = 0;
    let fraca = 0;
    let soma = 0;
    for (const [combo, peso] of heroi) {
      if (usadas.has(combo.slice(0, 2)) || usadas.has(combo.slice(2, 4))) continue;
      const e = porMao[maoDoCombo(combo)];
      if (e == null) continue;
      soma += peso;
      if (e >= 60) forte += peso;
      else if (e >= 40) meio += peso;
      else fraca += peso;
    }
    return soma ? { forte: forte / soma, meio: meio / soma, fraca: fraca / soma } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroi, porMao, chaveBoard]);

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-muted">Contra:</span>
        <button
          type="button"
          onClick={onEscolherVilao}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1.5 font-semibold transition hover:border-white/25"
        >
          <span className="truncate">{vilao ? vilao.nome : "Escolher o range do vilão"}</span>
          <ChevronDown size={14} className="shrink-0 text-muted" />
        </button>
        <span className="text-muted">{board.length ? "nesse board" : "antes do flop"}</span>
      </div>

      {!vilao && sugestoes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sugestoes.map((s) => (
            <Chip key={s.nome} onClick={() => onVilao(s)}>
              {s.nome}
            </Chip>
          ))}
        </div>
      )}

      {!heroi.size ? (
        <p className="m-0 text-[12px] text-muted">Seu range está vazio nessa rua.</p>
      ) : !vilao ? (
        <p className="m-0 text-[12px] leading-relaxed text-muted">
          Escolha contra qual range você quer medir: um pronto do PokerSync, um seu, ou simplesmente &quot;qualquer mão&quot;.
        </p>
      ) : !total ? (
        <p className="m-0 flex items-center gap-2 text-[12px] text-muted">
          {calculando ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Calculando…
            </>
          ) : (
            "Os dois ranges não têm mãos que possam se enfrentar nesse board."
          )}
        </p>
      ) : (
        <>
          <div className="flex h-9 overflow-hidden rounded-xl text-[13px] font-bold">
            <div className="grid min-w-[72px] place-items-center whitespace-nowrap px-1 text-black" style={{ width: `${total.heroi}%`, background: "#d4af37" }}>
              Você {total.heroi.toFixed(1).replace(".", ",")}%
            </div>
            <div className="grid min-w-[72px] place-items-center whitespace-nowrap px-1 text-white" style={{ width: `${total.vilao}%`, background: "#3B82F6" }}>
              Vilão {total.vilao.toFixed(1).replace(".", ",")}%
            </div>
          </div>
          {total.empate >= 0.5 && <p className="m-0 -mt-1.5 text-[11px] text-muted">Empate em {total.empate.toFixed(1).replace(".", ",")}% das vezes (já dividido nos números).</p>}
          <div className="grid grid-cols-3 gap-2">
            {[
              { t: "Mãos com 60%+", v: faixas?.forte, c: VERDE },
              { t: "Entre 40% e 60%", v: faixas?.meio, c: OURO_CLARO },
              { t: "Abaixo de 40%", v: faixas?.fraca, c: VERMELHO },
            ].map((x) => (
              <div key={x.t} className="painel-bloco rounded-xl border border-white/5 p-2.5">
                <div className="text-[11px] text-muted">{x.t}</div>
                <div className="tnum text-[18px] font-bold" style={{ color: x.c }}>
                  {x.v == null ? "…" : pct(x.v)}
                </div>
                <div className="text-[10.5px] text-muted">do seu range</div>
              </div>
            ))}
          </div>
          <button type="button" role="switch" aria-checked={colorir} onClick={() => onColorir(!colorir)} className="flex items-center gap-2 text-left text-[12.5px]">
            <span
              className="grid h-[18px] w-[32px] shrink-0 items-center rounded-full px-[2px] transition-colors"
              style={{ background: colorir ? "#d4af37" : "rgba(255,255,255,0.15)" }}
            >
              <span className={`h-[14px] w-[14px] rounded-full transition-transform ${colorir ? "translate-x-[14px] bg-black" : "bg-white/80"}`} />
            </span>
            Colorir a grade pela equidade de cada mão
          </button>
          {colorir && (
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span className="h-2.5 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${corEquidade(30)}, ${corEquidade(50)}, ${corEquidade(70)})` }} />
              <span>30% → 70%+</span>
            </div>
          )}
          <p className="m-0 text-[12px] leading-relaxed text-muted">
            O número em cada mão da grade é a chance de ela ganhar do range do vilão até o river. Ajuda a ver o que apostar por valor e o que desistir.
          </p>
        </>
      )}
    </div>
  );
}
