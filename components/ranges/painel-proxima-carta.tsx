"use client";

import { useMemo } from "react";
import { FORTES, proximaCarta } from "@/lib/ranges/acertos";
import { GRADE, NAIPES, cartaTexto, nomeCarta } from "@/lib/ranges/cartas";
import type { Rua } from "./use-construtor";
import { CartaTexto, VERDE, VERMELHO, pct, simboloNaipe, useCoresNaipe } from "./pecas";

// Próxima carta: pra cada carta que pode cair, quanto do range que continua
// fica com par no topo ou melhor. Verde melhora, vermelho piora; clicar
// numa carta coloca ela no board.

export function PainelProximaCarta({
  rua,
  aguardando,
  onCarta,
}: {
  rua: Rua | null;
  aguardando: boolean;
  onCarta: (carta: string) => void;
}) {
  const cores = useCoresNaipe();
  const dados = useMemo(() => {
    if (!rua || rua.cartas >= 5 || !rua.continuaTotal) return null;
    const lista = proximaCarta(rua.continua, rua.board);
    let fortes = 0;
    for (const c of rua.analise.combos) if (rua.continua.has(c.combo) && FORTES.includes(c.feita)) fortes += c.peso;
    const base = fortes / rua.continuaTotal;
    return { mapa: new Map(lista.map((x) => [x.carta, x.forte])), lista, base };
  }, [rua]);

  if (!rua) return <p className="m-0 mt-3 text-[12.5px] text-muted">Escolha o flop primeiro: aqui aparece como cada carta do turn muda o seu range.</p>;
  if (rua.cartas >= 5) return <p className="m-0 mt-3 text-[12.5px] text-muted">O board já está completo (river): não tem próxima carta.</p>;
  if (!dados) return <p className="m-0 mt-3 text-[12.5px] text-muted">Nada do range continua nessa rua.</p>;

  const usadas = new Set(rua.board.map(cartaTexto));
  const ordem = [...dados.lista].sort((a, b) => b.forte - a.forte);
  // só entra na lista a carta que muda de verdade (meio ponto ou mais)
  const melhores = ordem.filter((x) => x.forte - dados.base >= 0.005).slice(0, 4);
  const piores = [...ordem]
    .reverse()
    .filter((x) => dados.base - x.forte >= 0.005)
    .slice(0, 4);
  const nomeRua = rua.cartas === 3 ? "turn" : "river";

  return (
    <div className="mt-3">
      {aguardando && (
        <p className="m-0 mb-2 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/[0.08] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#e8cb6a]">
          Escolha a carta do {nomeRua}: clique numa carta abaixo (ou no espaço do {nomeRua} no board).
        </p>
      )}
      <p className="m-0 text-[12px] leading-relaxed text-muted">
        Cada carta do {nomeRua} e quanto do seu range ({rua.semSelecao ? "o range inteiro" : "o que continua"}) fica com{" "}
        <b className="text-ink/85">par no topo ou melhor</b>. Hoje: <b className="tnum text-ink/85">{pct(dados.base)}</b>.
        {dados.base >= 0.995 && " Tudo o que continua já é par no topo ou melhor: aqui o que conta são as cartas que pioram (em vermelho)."}
      </p>
      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: "18px repeat(13, minmax(0,1fr))" }}>
        {NAIPES.map((n) => (
          <div key={n} className="contents">
            <span className="grid place-items-center text-[12px]" style={{ color: cores.texto(n) }}>
              {simboloNaipe(n)}
            </span>
            {GRADE.map((v) => {
              const c = v + n;
              if (usadas.has(c))
                return (
                  <span key={c} className="grid aspect-[3/4] place-items-center rounded-[4px] border border-dashed border-white/15 text-[10px] text-muted">
                    {v === "T" ? "10" : v}
                  </span>
                );
              const d = (dados.mapa.get(c) ?? 0) - dados.base;
              const fundo =
                d >= 0.04 ? "rgba(52,211,153,0.85)" : d >= 0.01 ? "rgba(52,211,153,0.45)" : d > -0.01 ? "rgba(255,255,255,0.10)" : d > -0.04 ? "rgba(248,113,113,0.45)" : "rgba(248,113,113,0.85)";
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCarta(c)}
                  title={`${nomeCarta(c)}: ${pct(dados.mapa.get(c) ?? 0)} com par no topo ou melhor`}
                  className="grid aspect-[3/4] place-items-center rounded-[4px] text-[10.5px] font-bold transition hover:ring-2 hover:ring-white/70 active:scale-95"
                  style={{ background: fundo, color: Math.abs(d) >= 0.01 ? "#0b0b0b" : "rgba(255,255,255,0.8)" }}
                >
                  {v === "T" ? "10" : v}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: VERDE }} /> melhora seu range
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: VERMELHO }} /> piora
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="painel-bloco rounded-xl border border-white/5 p-2.5">
          <div className="text-[11px] text-muted">Melhores cartas pra você</div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[13px]">
            {melhores.length ? melhores.map((x) => <CartaTexto key={x.carta} carta={x.carta} />) : <span className="text-[12px] text-muted">nenhuma carta melhora</span>}
          </div>
        </div>
        <div className="painel-bloco rounded-xl border border-white/5 p-2.5">
          <div className="text-[11px] text-muted">Piores cartas pra você</div>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[13px]">
            {piores.length ? piores.map((x) => <CartaTexto key={x.carta} carta={x.carta} />) : <span className="text-[12px] text-muted">nenhuma carta piora</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
