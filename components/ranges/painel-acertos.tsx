"use client";

import { Check, ChevronRight, Shuffle } from "lucide-react";
import { BOTAO_OURO, BOTAO_VIDRO } from "@/components/banca/util";
import { ATALHOS, FEITAS, PROJETOS, type Feita, type Projeto } from "@/lib/ranges/acertos";
import { maoDoCombo } from "@/lib/ranges/cartas";
import type { Rua, Selecao } from "./use-construtor";
import { COR_FEITA, COR_PROJETO, Chip, Rotulo, numCombos, pct } from "./pecas";

// "Como acerta": cada mão do range cai numa mão feita (somam 100%) e pode
// ter projetos (contados à parte). Clicar numa linha mostra essas mãos na
// grade; marcar o quadradinho diz o que você continua jogando.

export type Destaque = { tipo: "feita"; k: Feita } | { tipo: "projeto"; k: Projeto };

function mesmaSelecao(a: Selecao, feitas: Feita[], projetos: Projeto[]) {
  return a.feitas.length === feitas.length && a.projetos.length === projetos.length && feitas.every((f) => a.feitas.includes(f)) && projetos.every((p) => a.projetos.includes(p));
}

function Linha({
  nome,
  dica,
  cor,
  frac,
  combos,
  marcado,
  destacado,
  onMarcar,
  onDestacar,
}: {
  nome: string;
  dica: string;
  cor: string;
  frac: number;
  combos: number;
  marcado: boolean;
  destacado: boolean;
  onMarcar: () => void;
  onDestacar: () => void;
}) {
  return (
    <div
      className="grid grid-cols-[20px_minmax(0,1fr)_18%_48px_34px] items-center gap-2 rounded-lg px-1.5 py-[3px] sm:grid-cols-[20px_minmax(0,1fr)_26%_50px_40px] sm:gap-2.5"
      style={{
        background: destacado ? "rgba(59,130,246,0.14)" : "transparent",
        outline: destacado ? "1px solid rgba(59,130,246,0.55)" : "none",
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={marcado}
        aria-label={`Continuo jogando: ${nome}`}
        onClick={onMarcar}
        className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border transition"
        style={{ borderColor: marcado ? "#d4af37" : "rgba(255,255,255,0.25)", background: marcado ? "#d4af37" : "transparent" }}
      >
        {marcado && <Check size={12} strokeWidth={3.2} color="#111" />}
      </button>
      <button
        type="button"
        onClick={onDestacar}
        title={`${dica} Clique pra ver na grade.`}
        aria-pressed={destacado}
        className="truncate py-1 text-left text-[12.5px] hover:text-white"
        style={{ color: frac > 0 ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.35)" }}
      >
        {nome}
      </button>
      <span className="h-[7px] overflow-hidden rounded-full bg-white/[0.06]">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, frac * 100 * 2.2)}%`, background: cor }} />
      </span>
      <span className="tnum text-right text-[12px] font-semibold text-ink/90">{pct(frac)}</span>
      <span className="tnum text-right text-[11px] text-muted">{numCombos(combos)}</span>
    </div>
  );
}

// Sem board: do que o range é feito (pares, suited, offsuit).
function ResumoPreflop({ combos }: { combos: Map<string, number> }) {
  let pares = 0;
  let suited = 0;
  let offsuit = 0;
  const maos = new Set<string>();
  for (const [combo, peso] of combos) {
    const m = maoDoCombo(combo);
    maos.add(m);
    if (m.length === 2) pares += peso;
    else if (m[2] === "s") suited += peso;
    else offsuit += peso;
  }
  const total = pares + suited + offsuit;
  if (!total) return <p className="m-0 mt-3 text-[12.5px] text-muted">O range está vazio: pinte mãos na grade, use o Top % ou cole um range.</p>;
  return (
    <div className="mt-3">
      <Rotulo>Do que o range é feito</Rotulo>
      <div className="mt-1.5 flex flex-col gap-1">
        {[
          { nome: "Pares", v: pares },
          { nome: "Mesmo naipe (suited)", v: suited },
          { nome: "Naipes diferentes (offsuit)", v: offsuit },
        ].map((x) => (
          <div key={x.nome} className="grid grid-cols-[minmax(0,1fr)_18%_48px_34px] items-center gap-2 px-1.5 py-[3px] sm:grid-cols-[minmax(0,1fr)_26%_50px_40px] sm:gap-2.5">
            <span className="truncate text-[12.5px] text-ink/85">{x.nome}</span>
            <span className="h-[7px] overflow-hidden rounded-full bg-white/[0.06]">
              <span className="block h-full rounded-full bg-[#d4af37]" style={{ width: `${(x.v / total) * 100}%` }} />
            </span>
            <span className="tnum text-right text-[12px] font-semibold text-ink/90">{pct(x.v / total)}</span>
            <span className="tnum text-right text-[11px] text-muted">{numCombos(x.v)}</span>
          </div>
        ))}
      </div>
      <p className="m-0 mt-1.5 px-1.5 text-[11.5px] text-muted">{maos.size} das 169 mãos da grade.</p>
    </div>
  );
}

export function PainelAcertos({
  rua,
  combosPre,
  destaque,
  onDestaque,
  onSelecao,
  onLevar,
  onSortearFlop,
}: {
  rua: Rua | null;
  /** O range no pré-flop (pro resumo quando ainda não tem board). */
  combosPre: Map<string, number>;
  destaque: Destaque | null;
  onDestaque: (d: Destaque | null) => void;
  onSelecao: (s: Selecao) => void;
  onLevar: () => void;
  onSortearFlop: () => void;
}) {
  if (!rua)
    return (
      <>
        <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-dashed border-white/12 p-4">
          <p className="m-0 text-[13px] leading-relaxed text-ink/85">
            Coloque um flop no board pra ver como o seu range acerta: quantos pares, projetos, mãos fortes e quanto fica sem nada.
          </p>
          <button type="button" onClick={onSortearFlop} className={BOTAO_OURO}>
            <Shuffle size={15} /> Sortear um flop
          </button>
        </div>
        <ResumoPreflop combos={combosPre} />
      </>
    );

  const { analise, selecao } = rua;
  const total = analise.total || 1;
  const proxima = rua.cartas === 3 ? "turn" : rua.cartas === 4 ? "river" : null;

  function marcarFeita(k: Feita) {
    const tem = selecao.feitas.includes(k);
    onSelecao({ ...selecao, feitas: tem ? selecao.feitas.filter((x) => x !== k) : [...selecao.feitas, k] });
  }
  function marcarProjeto(k: Projeto) {
    const tem = selecao.projetos.includes(k);
    onSelecao({ ...selecao, projetos: tem ? selecao.projetos.filter((x) => x !== k) : [...selecao.projetos, k] });
  }
  function destacar(d: Destaque) {
    onDestaque(destaque && destaque.tipo === d.tipo && destaque.k === d.k ? null : d);
  }

  const feitas = FEITAS.filter((f) => analise.feitas[f.k] > 0);
  const projetos = PROJETOS.filter((p) => analise.projetos[p.k] > 0);

  return (
    <div className="mt-3">
      <p className="m-0 text-[12px] leading-relaxed text-muted">
        Clique numa linha pra ver essas mãos na grade.{" "}
        {proxima ? (
          <>
            Marque o que você <b className="text-ink/85">continua jogando</b> pra levar ao {proxima}.
          </>
        ) : (
          "No river não tem próxima carta: marque o que você continua jogando pra ver quanto sobra."
        )}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[11.5px] text-muted">Marcar:</span>
        {ATALHOS.map((a) => (
          <Chip key={a.nome} ativo={mesmaSelecao(selecao, a.feitas, a.projetos)} onClick={() => onSelecao({ feitas: [...a.feitas], projetos: [...a.projetos] })}>
            {a.nome}
          </Chip>
        ))}
        {!rua.semSelecao && <Chip onClick={() => onSelecao({ feitas: [], projetos: [] })}>Desmarcar</Chip>}
      </div>

      <Rotulo className="mt-3">Mãos feitas</Rotulo>
      <div className="mt-1 flex flex-col">
        {feitas.map((f) => (
          <Linha
            key={f.k}
            nome={f.nome}
            dica={f.dica}
            cor={COR_FEITA[f.k]}
            frac={analise.feitas[f.k] / total}
            combos={analise.feitas[f.k]}
            marcado={selecao.feitas.includes(f.k)}
            destacado={destaque?.tipo === "feita" && destaque.k === f.k}
            onMarcar={() => marcarFeita(f.k)}
            onDestacar={() => destacar({ tipo: "feita", k: f.k })}
          />
        ))}
      </div>
      {projetos.length > 0 && (
        <>
          <Rotulo className="mt-3">Projetos</Rotulo>
          <p className="m-0 mt-0.5 text-[11px] text-muted">Contados à parte: uma mão pode ter par e projeto ao mesmo tempo.</p>
          <div className="mt-1 flex flex-col">
            {projetos.map((p) => (
              <Linha
                key={p.k}
                nome={p.nome}
                dica={p.dica}
                cor={COR_PROJETO[p.k]}
                frac={analise.projetos[p.k] / total}
                combos={analise.projetos[p.k]}
                marcado={selecao.projetos.includes(p.k)}
                destacado={destaque?.tipo === "projeto" && destaque.k === p.k}
                onMarcar={() => marcarProjeto(p.k)}
                onDestacar={() => destacar({ tipo: "projeto", k: p.k })}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-3.5 hidden flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d4af37]/35 bg-[#d4af37]/[0.07] px-3 py-2.5 lg:flex">
        <span className="text-[12.5px] text-ink/90">
          {rua.semSelecao ? (
            <>Nada marcado: o range inteiro ({numCombos(analise.total)} combos) segue.</>
          ) : (
            <>
              Continua com <b className="tnum">{numCombos(rua.continuaTotal)} combos</b> ({pct(rua.continuaTotal / total)} do range)
            </>
          )}
        </span>
        {proxima && (
          <button type="button" onClick={onLevar} className={rua.semSelecao ? BOTAO_VIDRO : BOTAO_OURO}>
            Levar pro {proxima} <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
