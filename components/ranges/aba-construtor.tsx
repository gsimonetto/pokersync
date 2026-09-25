"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Eraser, FolderOpen, GitCompareArrows, Pencil, Save, Share2, Sparkles, Target, Undo2, Users, X } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { BOTAO_ICONE, BOTAO_OURO, BOTAO_VIDRO } from "@/components/banca/util";
import { FEITAS, PROJETOS, fracaoPorMao } from "@/lib/ranges/acertos";
import { combosPorMao, maoDoCombo, TODAS_AS_MAOS } from "@/lib/ranges/cartas";
import { pesoDaMao, topPercent, type Pesos } from "@/lib/ranges/notacao";
import { NOME_ACAO, type Acao } from "@/lib/ranges/prontos";
import { atualizarRange, compartilharComTime, criarRange } from "@/lib/services/range-service";
import { CaminhoRuas } from "./caminho-ruas";
import { EscolherRange, rangeTop } from "./escolher-range";
import { COR_SO_OUTRO, COR_SO_SEU, GradeRange, type ModoGrade } from "./grade-range";
import { ModalSalvar, type DadosRange } from "./modal-salvar";
import { PainelAcertos, type Destaque } from "./painel-acertos";
import { PainelEquidade } from "./painel-equidade";
import { PainelProximaCarta } from "./painel-proxima-carta";
import { Chip, OURO_CLARO, Segmentos, TOTAL_COMBOS, haQuanto, numCombos, pct } from "./pecas";
import { PopoverNaipes, mudarMao } from "./popover-naipes";
import { SeletorBoard, sortearCartas } from "./seletor-board";
import type { Biblioteca } from "./use-biblioteca";
import { deSalvo, dePronto, type Construtor, type OutroRange, type RangeAtual } from "./use-construtor";

// Aba principal: o range (grade editável), o board e a análise -- como
// acerta, equidade e próxima carta -- rua por rua.

type Painel = "acertos" | "equidade" | "proxima";
type Ferramenta = "dentro" | "fora" | "peso";

export const outroDe = (r: RangeAtual): OutroRange => ({ nome: r.nome, pesos: r.pesos, pesosCombo: r.pesosCombo, origem: r.origem });

/** Quanto de cada mão está vivo numa rua (0-100), pra grade do turn/river. */
function pesosDaRua(combos: { combo: string; peso: number }[]): Pesos {
  const soma: Pesos = {};
  for (const c of combos) {
    const m = maoDoCombo(c.combo);
    soma[m] = (soma[m] ?? 0) + c.peso;
  }
  for (const m of Object.keys(soma)) soma[m] = (soma[m] / combosPorMao(m)) * 100;
  return soma;
}

function spotTexto(r: RangeAtual): string | null {
  const partes: string[] = [];
  if (r.posicao) partes.push(r.vsPosicao ? `${r.posicao} vs ${r.vsPosicao}` : r.posicao);
  if (r.acao && r.origem !== "pronto" && r.origem !== "real") partes.push(NOME_ACAO[r.acao as Acao] ?? r.acao);
  if (r.stack) partes.push(`${r.stack}bb`);
  return partes.length ? partes.join(" · ") : null;
}

export function AbaConstrutor({
  c,
  bib,
  comparar,
  onComparar,
  onTrocarRange,
  onTreinar,
  onSalvou,
}: {
  c: Construtor;
  bib: Biblioteca;
  comparar: OutroRange | null;
  onComparar: (r: OutroRange | null) => void;
  onTrocarRange: () => void;
  onTreinar: () => void;
  onSalvou: () => void;
}) {
  const confirm = useConfirm();
  const [painel, setPainel] = useState<Painel>("acertos");
  const [destaque, setDestaque] = useState<Destaque | null>(null);
  const [aguardando, setAguardando] = useState<4 | 5 | null>(null);
  const [vilao, setVilao] = useState<OutroRange | null>(null);
  const [colorir, setColorir] = useState(false);
  const [eqPorMao, setEqPorMao] = useState<Record<string, number>>({});
  const [ferramenta, setFerramenta] = useState<Ferramenta>("dentro");
  const [pesoPincel, setPesoPincel] = useState(50);
  const [naipes, setNaipes] = useState<{ mao: string; ancora: DOMRect } | null>(null);
  const [escolher, setEscolher] = useState<null | "comparar" | "vilao">(null);
  const [salvar, setSalvar] = useState<null | "criar" | "editar">(null);
  const [passando, setPassando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { range, ruaAtual } = c;
  const noTurnOuRiver = c.board.length >= 4;

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  // Ctrl/Cmd+Z desfaz a última mudança na grade.
  const { desfazer } = c;
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        desfazer();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [desfazer]);

  function mudarBoard(cartas: string[]) {
    c.setBoard(cartas);
    setDestaque(null);
    if (cartas.length < 3 || (aguardando && cartas.length >= aguardando)) {
      if (aguardando) setPainel("acertos");
      setAguardando(null);
    }
  }

  function levar() {
    if (!ruaAtual || ruaAtual.cartas >= 5) return;
    setAguardando((ruaAtual.cartas + 1) as 4 | 5);
    setPainel("proxima");
    setDestaque(null);
    // No celular o painel fica embaixo da grade: rola até ele. No computador
    // ele já está à vista, do lado.
    const painelEl = document.getElementById("painel-analise");
    const topo = painelEl?.getBoundingClientRect().top ?? 0;
    if (painelEl && (topo > window.innerHeight * 0.55 || topo < 0)) painelEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const pincel = ferramenta === "dentro" ? 100 : ferramenta === "fora" ? 0 : pesoPincel;

  const pintar = useCallback(
    (maos: string[], valor: number, traco: string) => {
      c.editar((r) => {
        let atual = r;
        for (const m of maos) atual = mudarMao(atual.pesos, atual.pesosCombo, m, valor);
        return atual;
      }, `traco:${traco}`);
    },
    [c],
  );

  // Vilão da equidade: sem escolha, o outro lado do mesmo spot (BTN abre ->
  // BB paga) ou "qualquer mão".
  const sugestoes = useMemo(() => {
    const out: OutroRange[] = [];
    const pronto = bib.prontos.find((p) => p.id === range.prontoId);
    if (pronto) {
      // quem paga primeiro: é o range que chega no flop num pote aumentado
      const outros = bib.prontos.filter((p) => p.spotId === pronto.spotId && p.posicao !== pronto.posicao);
      outros.sort((a, b) => (a.acao === "pagar" ? 0 : 1) - (b.acao === "pagar" ? 0 : 1));
      out.push(...outros.map((p) => outroDe(dePronto(p))));
    }
    out.push(outroDe(rangeTop(100)), outroDe(rangeTop(25)));
    return out;
  }, [bib.prontos, range.prontoId]);

  useEffect(() => {
    if (painel === "equidade" && !vilao && sugestoes.length) setVilao(sugestoes[0]);
  }, [painel, vilao, sugestoes]);

  // O que a grade mostra.
  const pesosRua = useMemo(() => (noTurnOuRiver && ruaAtual ? pesosDaRua(ruaAtual.analise.combos) : null), [noTurnOuRiver, ruaAtual]);
  const modoGrade: ModoGrade = useMemo(() => {
    if (comparar) return { tipo: "comparar", outro: comparar };
    if (painel === "equidade" && colorir && vilao) return { tipo: "equidade", eq: eqPorMao };
    if (painel === "acertos" && destaque && ruaAtual) {
      const k = destaque.k;
      const filtro = destaque.tipo === "feita" ? (x: { feita: string }) => x.feita === k : (x: { projetos: string[] }) => x.projetos.includes(k);
      return { tipo: "destaque", fracao: fracaoPorMao(ruaAtual.analise, filtro as never), cor: destaque.tipo === "feita" ? "#3B82F6" : "#60A5FA" };
    }
    return { tipo: "range" };
  }, [comparar, painel, colorir, vilao, eqPorMao, destaque, ruaAtual]);
  const gradeSoLeitura = noTurnOuRiver && !comparar;
  const pesosGrade = gradeSoLeitura && pesosRua ? pesosRua : range.pesos;
  const pesosComboGrade = gradeSoLeitura && pesosRua ? {} : range.pesosCombo;

  // Herói da equidade: o range que chegou nessa rua (ou o range inteiro no pré-flop).
  const heroiEq = useMemo(() => (ruaAtual ? new Map(ruaAtual.analise.combos.map((x) => [x.combo, x.peso] as [string, number])) : c.combos), [ruaAtual, c.combos]);

  // Comparação: quantas mãos só num dos lados.
  const resumoComparar = useMemo(() => {
    if (!comparar) return null;
    const r = { seu: 0, outro: 0, dois: 0, maosSeu: 0, maosOutro: 0 };
    for (const m of TODAS_AS_MAOS) {
      const p = pesoDaMao(range.pesos, range.pesosCombo, m);
      const q = pesoDaMao(comparar.pesos, comparar.pesosCombo, m);
      const n = combosPorMao(m);
      if (p > 0 && q > 0) r.dois += (Math.min(p, q) / 100) * n;
      else if (p > 0) {
        r.seu += (p / 100) * n;
        r.maosSeu++;
      } else if (q > 0) {
        r.outro += (q / 100) * n;
        r.maosOutro++;
      }
    }
    return r;
  }, [comparar, range.pesos, range.pesosCombo]);

  // Linha de informação da mão sob o mouse.
  const infoMao = useMemo(() => {
    if (!passando) return null;
    const peso = pesoDaMao(range.pesos, range.pesosCombo, passando);
    let partes = `${passando} · ${peso > 0 ? `${Math.round(peso)}% no range` : "fora do range"}`;
    if (ruaAtual) {
      const conta = new Map<string, number>();
      for (const x of ruaAtual.analise.combos) if (maoDoCombo(x.combo) === passando) conta.set(x.feita, (conta.get(x.feita) ?? 0) + x.peso);
      const top = [...conta].sort((a, b) => b[1] - a[1]).slice(0, 2);
      if (top.length) partes += ` · ${top.map(([f, n]) => `${numCombos(n)} ${FEITAS.find((x) => x.k === f)?.nome.toLowerCase()}`).join(", ")}`;
    }
    return partes;
  }, [passando, range.pesos, range.pesosCombo, ruaAtual]);

  const meu = range.origem === "meu";

  async function salvarDireto() {
    if (!range.id) return;
    setSalvando(true);
    try {
      await atualizarRange(range.id, { pesos: range.pesos, pesosCombo: range.pesosCombo });
      c.atualizarDados({ atualizadoEm: new Date().toISOString() }, true);
      setAviso({ texto: "Salvo" });
      onSalvou();
    } catch {
      setAviso({ texto: "Não consegui salvar", erro: true });
    } finally {
      setSalvando(false);
    }
  }

  async function salvarModal(d: DadosRange) {
    if (salvar === "editar" && range.id) {
      await atualizarRange(range.id, { ...d, pesos: range.pesos, pesosCombo: range.pesosCombo });
      c.atualizarDados({ ...d, atualizadoEm: new Date().toISOString() }, true);
    } else {
      const novo = await criarRange({ ...d, pesos: range.pesos, pesosCombo: range.pesosCombo });
      const atual = deSalvo(novo, novo.userId);
      c.atualizarDados({ ...atual, prontoId: undefined, donoNome: undefined, amostra: undefined }, true);
    }
    setAviso({ texto: "Salvo" });
    onSalvou();
  }

  async function alternarTime() {
    if (!range.id || !bib.time) return;
    const compartilhado = !!range.teamId;
    const ok = await confirm({
      title: compartilhado ? "Parar de compartilhar?" : `Compartilhar com ${bib.time.nome}?`,
      message: compartilhado
        ? "O range sai da lista do time. Ele continua salvo com você."
        : "Todo mundo do time vai poder abrir e treinar esse range (sem editar o seu). Mudanças que você salvar depois aparecem pra eles também.",
      confirmLabel: compartilhado ? "Parar" : "Compartilhar",
    });
    if (!ok) return;
    try {
      if (!compartilhado && c.alterado) await atualizarRange(range.id, { pesos: range.pesos, pesosCombo: range.pesosCombo });
      await compartilharComTime(range.id, compartilhado ? null : bib.time.id);
      c.atualizarDados({ teamId: compartilhado ? null : bib.time.id }, !compartilhado);
      setAviso({ texto: compartilhado ? "Não está mais no time" : "Compartilhado com o time" });
      onSalvou();
    } catch {
      setAviso({ texto: "Não consegui mudar agora", erro: true });
    }
  }

  const spot = spotTexto(range);
  const pctPre = c.totalCombos / TOTAL_COMBOS;
  const proxima = ruaAtual && ruaAtual.cartas < 5 ? (ruaAtual.cartas === 3 ? "turn" : "river") : null;

  return (
    <div className="flex flex-col gap-3 pb-24 lg:pb-0">
      {/* barra do range */}
      <section className="painel-vidro flex flex-col gap-3 rounded-2xl border border-white/10 p-3 sm:p-3.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="m-0 truncate text-[16px] font-semibold tracking-tight sm:text-[17px]">{range.nome}</h2>
            {meu && (
              <button type="button" onClick={() => setSalvar("editar")} aria-label="Mudar nome e spot" title="Mudar nome e spot" className="shrink-0 text-muted transition hover:text-ink">
                <Pencil size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {range.origem === "pronto" && (
              <Chip ativo>
                <Sparkles size={11} /> Pronto do PokerSync (GTO)
              </Chip>
            )}
            {range.origem === "meu" && <Chip>Meu range</Chip>}
            {range.origem === "time" && (
              <Chip cor="#c084fc">
                <Users size={11} /> Do time{range.donoNome ? ` · ${range.donoNome}` : ""}
              </Chip>
            )}
            {range.origem === "real" && (
              <Chip cor={OURO_CLARO}>
                Seu range de verdade{range.amostra ? ` · ${range.amostra} mãos` : ""}
              </Chip>
            )}
            {range.origem === "real" && (range.amostra ?? 0) < 150 && <Chip cor="#f59e0b">amostra pequena</Chip>}
            {range.origem === "novo" && <Chip>Não salvo</Chip>}
            {meu && range.teamId && (
              <Chip cor="#60A5FA">
                <Share2 size={11} /> No time
              </Chip>
            )}
            {spot && <Chip>{spot}</Chip>}
            {c.alterado && range.origem !== "novo" && <Chip cor="#f59e0b">{meu ? "mudanças não salvas" : "com mudanças"}</Chip>}
            {meu && !c.alterado && range.atualizadoEm && <Chip>salvo {haQuanto(range.atualizadoEm)}</Chip>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={onTrocarRange} className={BOTAO_VIDRO} title="Abrir outro range">
            <FolderOpen size={15} /> <span className="hidden sm:inline">Trocar</span>
          </button>
          <button
            type="button"
            onClick={() => (comparar ? onComparar(null) : setEscolher("comparar"))}
            className={BOTAO_VIDRO}
            title={comparar ? "Parar de comparar" : "Comparar com outro range"}
            aria-pressed={!!comparar}
          >
            <GitCompareArrows size={15} /> <span className="hidden sm:inline">{comparar ? "Parar de comparar" : "Comparar"}</span>
          </button>
          <button type="button" onClick={onTreinar} className={BOTAO_VIDRO} title="Treinar esse range">
            <Target size={15} /> <span className="hidden sm:inline">Treinar</span>
          </button>
          {meu && bib.time && (
            <button type="button" onClick={alternarTime} className={BOTAO_VIDRO} title={range.teamId ? "Parar de compartilhar com o time" : "Compartilhar com o time"}>
              <Share2 size={15} /> <span className="hidden sm:inline">{range.teamId ? "No time" : "Time"}</span>
            </button>
          )}
          {aviso && (
            <span className={`inline-flex items-center gap-1 text-[12.5px] font-semibold ${aviso.erro ? "text-negative" : "text-positive"}`} role="status">
              {!aviso.erro && <Check size={14} />} {aviso.texto}
            </span>
          )}
          {meu ? (
            <button type="button" onClick={salvarDireto} disabled={!c.alterado || salvando} className={BOTAO_OURO}>
              <Save size={15} /> Salvar
            </button>
          ) : (
            <button type="button" onClick={() => setSalvar("criar")} className={BOTAO_OURO}>
              <Save size={15} /> Salvar como meu
            </button>
          )}
        </div>
      </section>

      {comparar && resumoComparar && (
        <section className="painel-vidro flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 px-3.5 py-2.5 text-[12.5px]">
          <span className="text-muted">Comparando com</span>
          <b className="min-w-0 truncate text-ink">{comparar.nome}</b>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_SO_SEU }} /> Só no seu: {resumoComparar.maosSeu} mãos ({numCombos(resumoComparar.seu)} combos)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_SO_OUTRO }} /> Só no outro: {resumoComparar.maosOutro} mãos ({numCombos(resumoComparar.outro)} combos)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#d4af37]" /> Nos dois
          </span>
          <button type="button" onClick={() => onComparar(null)} className="ml-auto inline-flex items-center gap-1 text-muted transition hover:text-ink">
            <X size={14} /> Parar
          </button>
        </section>
      )}

      <CaminhoRuas totalCombos={c.totalCombos} ruas={c.ruas} board={c.board} aguardando={aguardando} onIr={(n) => mudarBoard(c.board.slice(0, n))} />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SeletorBoard board={c.board} onBoard={mudarBoard} aguardando={aguardando} />

          <section className="painel-vidro rounded-2xl border border-white/10 p-3 sm:p-3.5">
            {gradeSoLeitura ? (
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-muted">
                <span>No {c.board.length === 4 ? "turn" : "river"} a grade mostra só o que chegou até aqui.</span>
                <button type="button" onClick={() => mudarBoard(c.board.slice(0, 3))} className="font-semibold text-[#e8cb6a] hover:underline">
                  Voltar pro flop pra editar
                </button>
              </div>
            ) : (
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <Segmentos
                  rotulo="Pincel"
                  valor={ferramenta}
                  onChange={setFerramenta}
                  opcoes={[
                    { v: "dentro", t: "Dentro", title: "Pinta a mão no range (100%)" },
                    { v: "fora", t: "Fora", title: "Tira a mão do range" },
                    { v: "peso", t: `Peso ${pesoPincel}%`, title: "Pinta com peso: a mão entra só parte das vezes" },
                  ]}
                />
                {ferramenta === "peso" && (
                  <div className="flex gap-1">
                    {[25, 50, 75].map((p) => (
                      <Chip key={p} ativo={pesoPincel === p} onClick={() => setPesoPincel(p)}>
                        {p}%
                      </Chip>
                    ))}
                  </div>
                )}
                <label className="flex min-w-[150px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5" title="As X% mãos mais fortes (troca o range inteiro)">
                  <span className="text-[11px] text-muted">Top</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.5}
                    value={Math.round(pctPre * 200) / 2}
                    onChange={(e) => c.editar(() => ({ pesos: topPercent(Number(e.target.value)), pesosCombo: {} }), "top")}
                    aria-label="Top % das mãos"
                    className="h-[5px] flex-1 cursor-pointer accent-[#d4af37]"
                  />
                  <span className="tnum w-[42px] text-right text-[11.5px] font-semibold">{pct(pctPre, 0)}</span>
                </label>
                <button type="button" onClick={c.desfazer} disabled={!c.podeDesfazer} className={`${BOTAO_ICONE} disabled:opacity-40`} aria-label="Desfazer" title="Desfazer (Ctrl+Z)">
                  <Undo2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => c.editar(() => ({ pesos: {}, pesosCombo: {} }))}
                  disabled={!c.totalCombos}
                  className={`${BOTAO_ICONE} disabled:opacity-40`}
                  aria-label="Limpar a grade"
                  title="Limpar a grade"
                >
                  <Eraser size={15} />
                </button>
              </div>
            )}
            <GradeRange
              pesos={pesosGrade}
              pesosCombo={pesosComboGrade}
              modo={modoGrade}
              pincel={pincel}
              onPintar={pintar}
              onNaipes={(mao, ancora) => setNaipes({ mao, ancora })}
              onPassar={setPassando}
              somenteLeitura={gradeSoLeitura}
            />
            <div className="mt-2.5 flex min-h-[18px] flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted">
              {infoMao ? (
                <span className="text-ink/85">{infoMao}</span>
              ) : modoGrade.tipo === "destaque" && destaque ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: modoGrade.cor }} />
                  {(destaque.tipo === "feita" ? FEITAS : PROJETOS).find((x) => x.k === destaque.k)?.nome} (
                  {numCombos(destaque.tipo === "feita" ? ruaAtual!.analise.feitas[destaque.k] : ruaAtual!.analise.projetos[destaque.k])} combos)
                </span>
              ) : (
                <span className="hidden sm:inline">Arraste pra pintar várias mãos · botão direito escolhe os naipes</span>
              )}
              <span className="tnum">
                {numCombos(c.totalCombos)} combos · {pct(pctPre)}
              </span>
            </div>
          </section>
        </div>

        <section id="painel-analise" className="painel-vidro min-w-0 scroll-mt-20 rounded-2xl border border-white/10 p-3 sm:p-3.5">
          <Segmentos
            rotulo="Análise"
            cheio
            valor={painel}
            onChange={(v) => {
              setPainel(v);
              if (v !== "acertos") setDestaque(null);
            }}
            opcoes={[
              { v: "acertos", t: "Como acerta" },
              { v: "equidade", t: "Equidade" },
              { v: "proxima", t: <span>Próx. carta</span> },
            ]}
          />
          {painel === "acertos" && (
            <PainelAcertos
              rua={ruaAtual}
              combosPre={c.combos}
              destaque={destaque}
              onDestaque={setDestaque}
              onSelecao={(s) => ruaAtual && c.setSelecao(ruaAtual.cartas, s)}
              onLevar={levar}
              onSortearFlop={() => mudarBoard(sortearCartas(3, new Set()))}
            />
          )}
          {painel === "equidade" && (
            <PainelEquidade
              heroi={heroiEq}
              board={c.cartasBoard}
              vilao={vilao}
              sugestoes={sugestoes}
              onVilao={setVilao}
              onEscolherVilao={() => setEscolher("vilao")}
              colorir={colorir}
              onColorir={setColorir}
              onEqPorMao={setEqPorMao}
            />
          )}
          {painel === "proxima" && <PainelProximaCarta rua={ruaAtual} aguardando={!!aguardando} onCarta={(carta) => mudarBoard([...c.board, carta])} />}
        </section>
      </div>

      {/* celular: o "continua com" sempre à mão, embaixo */}
      {ruaAtual && proxima && painel === "acertos" && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-2 border-t border-white/10 bg-black/85 py-2.5 pl-3 pr-[84px] backdrop-blur-xl lg:hidden">
          <span className="text-[12px] leading-tight text-ink/90">
            {ruaAtual.semSelecao ? "Nada marcado" : "Continua"}
            <br />
            <b className="tnum">{numCombos(ruaAtual.semSelecao ? ruaAtual.analise.total : ruaAtual.continuaTotal)} combos</b>
            {!ruaAtual.semSelecao && ` · ${pct(ruaAtual.analise.total ? ruaAtual.continuaTotal / ruaAtual.analise.total : 0)}`}
          </span>
          <button type="button" onClick={levar} className={`${BOTAO_OURO} whitespace-nowrap`}>
            Levar pro {proxima} <ChevronRight size={15} />
          </button>
        </div>
      )}

      {naipes && (
        <PopoverNaipes
          mao={naipes.mao}
          ancora={naipes.ancora}
          pesos={range.pesos}
          pesosCombo={range.pesosCombo}
          onMudar={(r) => c.editar(() => r)}
          onFechar={() => setNaipes(null)}
        />
      )}
      <EscolherRange
        aberto={!!escolher}
        titulo={escolher === "vilao" ? "Range do vilão" : "Comparar com"}
        bib={bib}
        comTop
        onEscolher={(r) => {
          if (escolher === "vilao") setVilao(outroDe(r));
          else onComparar(outroDe(r));
          setEscolher(null);
        }}
        onFechar={() => setEscolher(null)}
      />
      <ModalSalvar aberto={!!salvar} range={range} editar={salvar === "editar"} onSalvar={salvarModal} onFechar={() => setSalvar(null)} />
    </div>
  );
}
