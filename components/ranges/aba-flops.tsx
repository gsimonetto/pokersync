"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { BOTAO_VIDRO } from "@/components/banca/util";
import { ALTAS, FILTRO_INICIAL, NAIPES_FLOP, analisarFlops, matriz, medias, passaNoFiltro, type FiltroFlops, type ResumoFlop } from "@/lib/ranges/flops";
import { listarFlops } from "@/lib/services/range-service";
import type { FlopRepresentativo } from "@/lib/ranges/flops";
import { CartasTexto, Chip, VERDE, VERMELHO, OURO, AZUL_CLARO, TOTAL_COMBOS, numCombos, pct } from "./pecas";
import type { Construtor } from "./use-construtor";

// "Todos os flops": o range aberto nos 184 flops que representam os 1.755
// flops possíveis -- em média quanto acerta, em que tipo de flop vai bem e
// em qual sofre. Clicar num flop abre ele no Construtor.

export function AbaFlops({ c, onAbrirFlop, onTrocarRange }: { c: Construtor; onAbrirFlop: (cartas: string[]) => void; onTrocarRange: () => void }) {
  const [flops, setFlops] = useState<FlopRepresentativo[] | null>(null);
  const [erro, setErro] = useState(false);
  const [resumos, setResumos] = useState<ResumoFlop[] | null>(null);
  const [filtro, setFiltro] = useState<FiltroFlops>(FILTRO_INICIAL);

  useEffect(() => {
    listarFlops()
      .then(setFlops)
      .catch(() => setErro(true));
  }, []);

  // 184 flops x o range inteiro: leva um instante, então roda fora do clique.
  const { combos } = c;
  useEffect(() => {
    setResumos(null);
    if (!flops || !combos.size) return;
    const t = setTimeout(() => setResumos(analisarFlops(combos, flops)), 60);
    return () => clearTimeout(t);
  }, [flops, combos]);

  const filtrados = useMemo(() => (resumos ? resumos.filter((r) => passaNoFiltro(r.flop, filtro)) : []), [resumos, filtro]);
  const m = useMemo(() => medias(filtrados), [filtrados]);
  // A matriz já separa por carta alta e naipes: ali só valem os outros filtros.
  const tabela = useMemo(
    () => (resumos ? matriz(resumos.filter((r) => passaNoFiltro(r.flop, { ...filtro, naipes: "todos", alta: "todas" }))) : null),
    [resumos, filtro],
  );
  const ordenados = useMemo(() => [...filtrados].sort((a, b) => b.topoOuMelhor - a.topoOuMelhor), [filtrados]);

  const f = (k: keyof FiltroFlops, v: string) => setFiltro({ ...filtro, [k]: v });

  return (
    <div className="flex flex-col gap-3">
      <section className="painel-vidro flex flex-col gap-2.5 rounded-2xl border border-white/10 p-3 sm:p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-muted">Range:</span>
          <span className="min-w-0 truncate text-[13px] font-semibold">{c.range.nome}</span>
          <span className="tnum text-[12px] text-muted">
            {numCombos(c.totalCombos)} combos · {pct(c.totalCombos / TOTAL_COMBOS)}
          </span>
          <button type="button" onClick={onTrocarRange} className={`${BOTAO_VIDRO} !px-3 !py-1.5 text-[12.5px] sm:ml-auto`}>
            <FolderOpen size={14} /> Trocar range
          </button>
        </div>
        <p className="m-0 text-[12px] text-muted">
          Em {flops?.length ?? 184} flops que representam todos os 1.755 flops possíveis (cada um com o peso de quantos flops ele representa).
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip ativo={filtro.naipes === "todos"} onClick={() => f("naipes", "todos")}>
            Todos os naipes
          </Chip>
          {NAIPES_FLOP.map((n) => (
            <Chip key={n.k} ativo={filtro.naipes === n.k} onClick={() => f("naipes", n.k)}>
              {n.nome}
            </Chip>
          ))}
          <span className="mx-1 w-px self-stretch bg-white/10" />
          <Chip ativo={filtro.alta === "todas"} onClick={() => f("alta", "todas")}>
            Qualquer carta alta
          </Chip>
          <Chip ativo={filtro.alta === "AK"} onClick={() => f("alta", "AK")}>
            A ou K
          </Chip>
          <Chip ativo={filtro.alta === "QJ"} onClick={() => f("alta", "QJ")}>
            Q ou J
          </Chip>
          <Chip ativo={filtro.alta === "T9"} onClick={() => f("alta", "T9")}>
            10 ou 9
          </Chip>
          <Chip ativo={filtro.alta === "baixa"} onClick={() => f("alta", "baixa")}>
            8 ou menor
          </Chip>
          <span className="mx-1 w-px self-stretch bg-white/10" />
          <Chip ativo={filtro.par === "todos"} onClick={() => f("par", "todos")}>
            Com e sem par
          </Chip>
          <Chip ativo={filtro.par === "sem"} onClick={() => f("par", "sem")}>
            Sem par
          </Chip>
          <Chip ativo={filtro.par === "com"} onClick={() => f("par", "com")}>
            Pareado
          </Chip>
          <Chip ativo={filtro.conexao === "conectado"} onClick={() => f("conexao", filtro.conexao === "conectado" ? "todas" : "conectado")}>
            Conectado
          </Chip>
        </div>
      </section>

      {erro ? (
        <p className="m-0 rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">Não consegui carregar os flops agora. Tente de novo em instantes.</p>
      ) : !c.totalCombos ? (
        <p className="m-0 rounded-2xl border border-dashed border-white/12 p-5 text-center text-[13px] text-muted">O range aberto está vazio: pinte algumas mãos no Construtor (ou abra um range) pra ver como ele vai nos flops.</p>
      ) : !resumos ? (
        <p className="m-0 flex items-center justify-center gap-2 py-10 text-[13px] text-muted">
          <Loader2 size={15} className="animate-spin" /> Olhando o range em todos os flops…
        </p>
      ) : !filtrados.length ? (
        <p className="m-0 rounded-2xl border border-dashed border-white/12 p-5 text-center text-[13px] text-muted">Nenhum flop com esse filtro.</p>
      ) : (
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="painel-vidro rounded-2xl border border-white/10 p-3 sm:p-3.5">
            <h3 className="m-0 text-sm font-semibold">
              Em média, {m.quantos === resumos.length ? "nos flops" : `nesses ${m.quantos} flops`}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { t: "Par ou melhor", v: m.parOuMelhor, c: OURO },
                { t: "Par no topo ou melhor", v: m.topoOuMelhor, c: VERDE },
                { t: "Projeto forte, sem par", v: m.projetoForte, c: AZUL_CLARO },
                { t: "Nada (sem par e sem projeto)", v: m.nada, c: "#9ca3af" },
              ].map((x) => (
                <div key={x.t} className="painel-bloco rounded-xl border border-white/5 p-3">
                  <div className="text-[11.5px] text-muted">{x.t}</div>
                  <div className="tnum mt-0.5 text-[22px] font-bold" style={{ color: x.c }}>
                    {pct(x.v)}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                { t: "Flops em que o range mais acerta", lista: ordenados.slice(0, 5), cor: VERDE },
                { t: "Flops em que o range menos acerta", lista: ordenados.slice(-5).reverse(), cor: VERMELHO },
              ].map((bloco) => (
                <div key={bloco.t} className="painel-bloco rounded-xl border border-white/5 p-2.5">
                  <div className="text-[11px] text-muted">{bloco.t}</div>
                  {bloco.lista.map((r) => {
                    const cartas = [r.flop.flop.slice(0, 2), r.flop.flop.slice(2, 4), r.flop.flop.slice(4, 6)];
                    return (
                      <button
                        key={r.flop.flop}
                        type="button"
                        onClick={() => onAbrirFlop(cartas)}
                        title="Abrir esse flop no Construtor"
                        className="mt-1 flex w-full items-center justify-between rounded-md px-1 py-0.5 text-[12.5px] transition hover:bg-white/[0.05]"
                      >
                        <CartasTexto cartas={cartas} />
                        <span className="tnum" style={{ color: bloco.cor }}>
                          {pct(r.topoOuMelhor)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="m-0 mt-2.5 text-[11.5px] text-muted">Percentual = quanto do range fica com par no topo ou melhor. Clique num flop pra abrir no Construtor.</p>
          </section>
          <section className="painel-vidro rounded-2xl border border-white/10 p-3 sm:p-3.5">
            <h3 className="m-0 text-sm font-semibold">Par no topo ou melhor, por tipo de flop</h3>
            <p className="m-0 mt-1 text-[12px] text-muted">Quanto mais verde, mais o seu range acerta esse tipo de flop.</p>
            <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: "88px repeat(3, minmax(0,1fr))" }}>
              <span />
              {NAIPES_FLOP.map((n) => (
                <span key={n.k} className="text-center text-[11px] font-semibold text-muted">
                  {n.nome}
                </span>
              ))}
              {ALTAS.map((a, i) => (
                <div key={a.k} className="contents">
                  <span className="self-center text-[12px] text-ink/85">{a.nome}</span>
                  {tabela?.[i].map((cel, j) =>
                    cel ? (
                      <span
                        key={j}
                        className="grid h-12 place-items-center rounded-lg text-[13px] font-bold"
                        title={`${cel.quantos} flops`}
                        style={{
                          background: `rgba(52,211,153,${0.12 + Math.max(0, Math.min(1, (cel.valor - 0.15) / 0.3)) * 0.75})`,
                          color: (cel.valor - 0.15) / 0.3 > 0.45 ? "#0b0b0b" : "rgba(255,255,255,0.9)",
                        }}
                      >
                        {pct(cel.valor)}
                      </span>
                    ) : (
                      <span key={j} className="grid h-12 place-items-center rounded-lg border border-dashed border-white/10 text-[11px] text-muted">
                        —
                      </span>
                    ),
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
