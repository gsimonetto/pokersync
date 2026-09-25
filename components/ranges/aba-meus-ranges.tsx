"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Plus, Search, Sparkles, Trash2, Users } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { BOTAO_ICONE, BOTAO_OURO, CAMPO } from "@/components/banca/util";
import { contarCombos } from "@/lib/ranges/notacao";
import { apagarRange, duplicarRange, type AcaoReal, type RangeReal, type RangeSalvo } from "@/lib/services/range-service";
import type { RangePronto } from "@/lib/ranges/prontos";
import { MiniGrade } from "./mini-grade";
import { POSICOES } from "./modal-salvar";
import { Chip, OURO_CLARO, Segmentos, TOTAL_COMBOS, haQuanto, numCombos, pct } from "./pecas";
import type { Biblioteca } from "./use-biblioteca";
import { deReal, dePronto, deSalvo, type Construtor, type RangeAtual } from "./use-construtor";

// "Meus ranges": o seu range de verdade (das mãos importadas), os que você
// salvou, os prontos do PokerSync (GTO) e os que o time compartilhou.

interface Selo {
  texto: string;
  cor: string;
}

function Cartao({
  r,
  meta,
  selos = [],
  onAbrir,
  onTreinar,
  extra,
}: {
  r: RangeAtual;
  meta: string;
  selos?: Selo[];
  onAbrir: () => void;
  onTreinar: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <article className="painel-vidro flex gap-3 rounded-2xl border border-white/10 p-3">
      <button type="button" onClick={onAbrir} aria-label={`Abrir ${r.nome}`} className="shrink-0 self-start rounded-md transition hover:brightness-125">
        <MiniGrade pesos={r.pesos} pesosCombo={r.pesosCombo} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13.5px] font-semibold">{r.nome}</span>
        <span className="tnum text-[11.5px] text-muted">{meta}</span>
        {selos.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {selos.map((s) => (
              <span key={s.texto} className="w-fit rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ color: s.cor, borderColor: `${s.cor}55`, background: `${s.cor}14` }}>
                {s.texto}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <button type="button" onClick={onAbrir} className="rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11.5px] font-semibold transition hover:bg-white/[0.1]">
            Abrir
          </button>
          <button type="button" onClick={onTreinar} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-muted transition hover:text-ink">
            Treinar
          </button>
          {extra}
        </div>
      </div>
    </article>
  );
}

function Secao({ titulo, sub, icone, children }: { titulo: string; sub: string; icone?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <h3 className="m-0 flex items-center gap-2 text-[15px] font-semibold">
          {icone}
          {titulo}
        </h3>
        <span className="text-[12px] text-muted">{sub}</span>
      </div>
      {children}
    </section>
  );
}

const GRADE_CARTOES = "grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3";
const metaCombos = (r: { pesos: RangeAtual["pesos"]; pesosCombo: RangeAtual["pesosCombo"] }) => {
  const n = contarCombos(r.pesos, r.pesosCombo);
  return `${numCombos(n)} combos · ${pct(n / TOTAL_COMBOS)}`;
};

const TITULO_REAL: Record<AcaoReal, (pos: string) => string> = {
  abrir: (pos) => `O que você abre no ${pos}`,
  pagar: (pos) => `O que você paga no ${pos}`,
  "3bet": (pos) => `Seu 3-bet no ${pos}`,
};
const VERBO_REAL: Record<AcaoReal, string> = { abrir: "abre", pagar: "paga", "3bet": "dá 3-bet em" };

/** O pronto do GTO que corresponde ao range de verdade (mesma posição e ação, 40bb de preferência). */
function gtoDoReal(real: RangeReal, prontos: RangePronto[]): RangePronto | null {
  const candidatos = prontos.filter((p) => p.posicao === real.posicao && p.acao === real.acao);
  if (!candidatos.length) return null;
  return [...candidatos].sort((a, b) => Math.abs(a.stack - 40) - Math.abs(b.stack - 40))[0];
}

export function AbaMeusRanges({
  bib,
  c,
  onAbrir,
  onComparar,
  onTreinar,
  onNovo,
}: {
  bib: Biblioteca;
  c: Construtor;
  onAbrir: (r: RangeAtual) => void;
  onComparar: (r: RangeAtual, alvo: RangeAtual) => void;
  onTreinar: (r: RangeAtual) => void;
  onNovo: () => void;
}) {
  const confirm = useConfirm();
  const [busca, setBusca] = useState("");
  const [stack, setStack] = useState<number | null>(null);
  const [acaoReal, setAcaoReal] = useState<AcaoReal>("abrir");
  const { carregarReal } = bib;

  useEffect(() => {
    carregarReal(acaoReal);
  }, [acaoReal, carregarReal]);

  const termo = busca.trim().toLowerCase();
  const bate = (texto: string) => !termo || texto.toLowerCase().includes(termo);
  const bateStack = (s: number | null) => stack == null || (stack >= 60 ? (s ?? 0) >= 60 : s === stack);

  const stacks = useMemo(() => [...new Set(bib.prontos.map((p) => p.stack))].sort((a, b) => a - b), [bib.prontos]);
  const meus = bib.meus.filter((r) => bateStack(r.stack) && bate(`${r.nome} ${r.posicao ?? ""} ${r.vsPosicao ?? ""} ${r.stack ?? ""}bb`));
  const prontos = bib.prontos.filter((p) => bateStack(p.stack) && bate(`${p.titulo} ${p.stack}bb`));
  const doTime = bib.doTime.filter((r) => r.userId !== bib.meuId && bate(`${r.nome} ${r.donoNome ?? ""} ${r.posicao ?? ""}`));
  const reais = (bib.reais[acaoReal] ?? [])
    .filter((r) => bate(r.posicao))
    .sort((a, b) => POSICOES.indexOf(a.posicao) - POSICOES.indexOf(b.posicao));

  async function apagar(r: RangeSalvo) {
    const ok = await confirm({ title: "Apagar range?", message: `"${r.nome}" vai ser apagado de vez${r.teamId ? " (e sai do time)" : ""}.`, confirmLabel: "Apagar", tone: "danger" });
    if (!ok) return;
    try {
      await apagarRange(r.id);
      if (c.range.id === r.id) c.atualizarDados({ id: null, origem: "novo", teamId: null });
    } finally {
      bib.recarregar();
    }
  }

  async function duplicar(r: RangeSalvo) {
    try {
      await duplicarRange(r);
    } finally {
      bib.recarregar();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="painel-vidro flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 p-3">
        <label className="relative flex min-w-[200px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por posição, stack ou nome" className={`${CAMPO} !py-2 !pl-8`} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          <Chip ativo={stack == null} onClick={() => setStack(null)}>
            Todos os stacks
          </Chip>
          {stacks.map((s) => (
            <Chip key={s} ativo={stack === s} onClick={() => setStack(s)}>
              {s >= 60 ? `${s}bb+` : `${s}bb`}
            </Chip>
          ))}
        </div>
      </section>

      {bib.erro && <p className="m-0 rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{bib.erro}</p>}

      <Secao titulo="Seu range de verdade" sub="Montado com as mãos que você importou: o que você realmente fez em cada posição.">
        <div className="mb-2.5">
          <Segmentos
            rotulo="Ação"
            valor={acaoReal}
            onChange={setAcaoReal}
            opcoes={[
              { v: "abrir", t: "Abrir" },
              { v: "pagar", t: "Pagar" },
              { v: "3bet", t: "3-bet" },
            ]}
          />
        </div>
        {!bib.reais[acaoReal] ? (
          <p className="m-0 flex items-center gap-2 py-4 text-[12.5px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Olhando as suas mãos importadas…
          </p>
        ) : !reais.length ? (
          <p className="m-0 rounded-2xl border border-dashed border-white/12 p-4 text-[12.5px] text-muted">
            Ainda não tem mãos suficientes pra montar esse range. Importe mais mãos no Revisor (ou ligue o Radar) e ele aparece aqui sozinho.
          </p>
        ) : (
          <div className={GRADE_CARTOES}>
            {reais.map((real) => {
              const r = deReal(real);
              const gto = gtoDoReal(real, bib.prontos);
              const freq = real.oportunidades ? real.vezes / real.oportunidades : 0;
              const selos: Selo[] = [];
              if (gto) {
                const gtoPct = contarCombos(gto.pesos) / TOTAL_COMBOS;
                selos.push({ texto: `Você ${VERBO_REAL[real.acao]} ${pct(freq, 0)} · GTO ${pct(gtoPct, 0)}`, cor: Math.abs(freq - gtoPct) <= 0.05 ? "#34D399" : "#F87171" });
              }
              if (real.oportunidades < 150) selos.push({ texto: "amostra pequena", cor: "#f59e0b" });
              return (
                <Cartao
                  key={real.posicao}
                  r={{ ...r, nome: TITULO_REAL[real.acao](real.posicao) }}
                  meta={`${real.oportunidades} mãos · ${real.vezes} vezes (${pct(freq, 0)})`}
                  selos={selos}
                  onAbrir={() => onAbrir(r)}
                  onTreinar={() => onTreinar(r)}
                  extra={
                    gto && (
                      <button
                        type="button"
                        onClick={() => onComparar(r, dePronto(gto))}
                        className="rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/[0.08] px-2.5 py-1 text-[11.5px] font-semibold text-[#e8cb6a] transition hover:bg-[#d4af37]/[0.14]"
                      >
                        Comparar com o GTO
                      </button>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </Secao>

      <Secao titulo="Meus ranges" sub="Os seus, editados e salvos.">
        {bib.carregando ? (
          <p className="m-0 flex items-center gap-2 py-4 text-[12.5px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Carregando…
          </p>
        ) : !meus.length ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-white/12 p-4">
            <p className="m-0 text-[12.5px] text-muted">
              {bib.meus.length
                ? "Nenhum range seu com esse filtro."
                : "Você ainda não salvou nenhum range. Abra um pronto do PokerSync e clique em “Salvar como meu”, ou comece um do zero."}
            </p>
            {!bib.meus.length && (
              <button type="button" onClick={onNovo} className={BOTAO_OURO}>
                <Plus size={15} /> Novo range
              </button>
            )}
          </div>
        ) : (
          <div className={GRADE_CARTOES}>
            {meus.map((salvo) => {
              const r = deSalvo(salvo, bib.meuId);
              const spot = [salvo.posicao && (salvo.vsPosicao ? `${salvo.posicao} vs ${salvo.vsPosicao}` : salvo.posicao), salvo.stack && `${salvo.stack}bb`].filter(Boolean).join(" · ");
              return (
                <Cartao
                  key={salvo.id}
                  r={r}
                  meta={`${metaCombos(r)}${spot ? ` · ${spot}` : ""}`}
                  selos={[
                    ...(salvo.teamId ? [{ texto: "No time", cor: "#60A5FA" }] : []),
                    { texto: `salvo ${haQuanto(salvo.atualizadoEm)}`, cor: "#9ca3af" },
                  ]}
                  onAbrir={() => onAbrir(r)}
                  onTreinar={() => onTreinar(r)}
                  extra={
                    <span className="ml-auto flex gap-1">
                      <button type="button" onClick={() => duplicar(salvo)} className={`${BOTAO_ICONE} !h-7 !w-7`} aria-label="Duplicar" title="Duplicar">
                        <Copy size={13} />
                      </button>
                      <button type="button" onClick={() => apagar(salvo)} className={`${BOTAO_ICONE} !h-7 !w-7 hover:!text-negative`} aria-label="Apagar" title="Apagar">
                        <Trash2 size={13} />
                      </button>
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </Secao>

      <Secao titulo="Prontos do PokerSync (GTO)" sub="Resolvidos pelo solver, os mesmos do Modo Treino. Abra e salve uma cópia pra editar." icone={<Sparkles size={15} className="text-[#e8cb6a]" />}>
        {!prontos.length ? (
          <p className="m-0 py-4 text-[12.5px] text-muted">{bib.carregando ? "Carregando…" : "Nenhum range pronto com esse filtro."}</p>
        ) : (
          <div className={GRADE_CARTOES}>
            {prontos.map((p) => {
              const r = dePronto(p);
              return <Cartao key={p.id} r={r} meta={metaCombos(r)} selos={[{ texto: "GTO", cor: OURO_CLARO }]} onAbrir={() => onAbrir(r)} onTreinar={() => onTreinar(r)} />;
            })}
          </div>
        )}
      </Secao>

      {bib.time && (
        <Secao titulo="Do time" sub={`Ranges que o pessoal do ${bib.time.nome} compartilhou.`} icone={<Users size={15} className="text-muted" />}>
          {!doTime.length ? (
            <p className="m-0 rounded-2xl border border-dashed border-white/12 p-4 text-[12.5px] text-muted">
              Ninguém do time compartilhou um range ainda. Pra compartilhar um seu, abra ele no Construtor e use o botão “Time”.
            </p>
          ) : (
            <div className={GRADE_CARTOES}>
              {doTime.map((salvo) => {
                const r = deSalvo(salvo, bib.meuId);
                return (
                  <Cartao
                    key={salvo.id}
                    r={r}
                    meta={`${salvo.donoNome ?? "Membro do time"} · atualizado ${haQuanto(salvo.atualizadoEm)}`}
                    selos={[{ texto: metaCombos(r), cor: "#c084fc" }]}
                    onAbrir={() => onAbrir(r)}
                    onTreinar={() => onTreinar(r)}
                  />
                );
              })}
            </div>
          )}
        </Secao>
      )}
    </div>
  );
}
