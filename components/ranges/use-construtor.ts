"use client";

import { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { combosDoRange, contarCombos, type Pesos } from "@/lib/ranges/notacao";
import { analisar, continuar, lerBoard, type Analise, type Feita, type Projeto } from "@/lib/ranges/acertos";
import type { Carta } from "@/lib/ranges/cartas";
import type { RangeSalvo } from "@/lib/services/range-service";
import type { RangePronto } from "@/lib/ranges/prontos";
import type { RangeReal } from "@/lib/services/range-service";

// Estado do Construtor: o range aberto (com desfazer), o board e o que
// "continua" em cada rua -- igual ao Flopzilla: no flop você marca as mãos
// que segue jogando e só elas vão pro turn, e assim por diante.

export type Origem = "novo" | "meu" | "pronto" | "time" | "real";

export interface RangeAtual {
  /** Id na tabela ranges (meu ou do time); null = ainda não salvo. */
  id: string | null;
  origem: Origem;
  nome: string;
  pesos: Pesos;
  pesosCombo: Pesos;
  posicao: string | null;
  vsPosicao: string | null;
  stack: number | null;
  acao: string | null;
  teamId: string | null;
  donoNome?: string;
  prontoId?: string;
  atualizadoEm?: string;
  /** Range de verdade: em quantas mãos a pessoa teve a chance. */
  amostra?: number;
}

/** Outro range (comparar, vilão da equidade). */
export interface OutroRange {
  nome: string;
  pesos: Pesos;
  pesosCombo: Pesos;
  origem: Origem;
}

export interface Selecao {
  feitas: Feita[];
  projetos: Projeto[];
}
export const SELECAO_VAZIA: Selecao = { feitas: [], projetos: [] };

export interface Rua {
  /** 3 = flop, 4 = turn, 5 = river. */
  cartas: number;
  board: Carta[];
  analise: Analise;
  selecao: Selecao;
  /** Nada marcado = o range inteiro segue. */
  semSelecao: boolean;
  /** O que segue pra próxima rua. */
  continua: Map<string, number>;
  continuaTotal: number;
}

export const RANGE_NOVO: RangeAtual = {
  id: null,
  origem: "novo",
  nome: "Range novo",
  pesos: {},
  pesosCombo: {},
  posicao: null,
  vsPosicao: null,
  stack: null,
  acao: null,
  teamId: null,
};

export function deSalvo(r: RangeSalvo, meuId: string | null): RangeAtual {
  const meu = !!meuId && r.userId === meuId;
  return {
    id: r.id,
    origem: meu ? "meu" : "time",
    nome: r.nome,
    pesos: r.pesos,
    pesosCombo: r.pesosCombo,
    posicao: r.posicao,
    vsPosicao: r.vsPosicao,
    stack: r.stack,
    acao: r.acao,
    teamId: r.teamId,
    donoNome: meu ? undefined : r.donoNome,
    atualizadoEm: r.atualizadoEm,
  };
}

export function dePronto(p: RangePronto): RangeAtual {
  return {
    id: null,
    origem: "pronto",
    nome: `${p.titulo} · ${p.stack}bb`,
    pesos: p.pesos,
    pesosCombo: {},
    posicao: p.posicao,
    vsPosicao: p.vsPosicao,
    stack: p.stack,
    acao: p.acao,
    teamId: null,
    prontoId: p.id,
  };
}

export const NOME_ACAO_REAL = { abrir: "abre", pagar: "paga um aumento", "3bet": "dá 3-bet" } as const;

export function deReal(r: RangeReal): RangeAtual {
  return {
    id: null,
    origem: "real",
    nome: `Seu range de verdade · ${r.posicao} ${NOME_ACAO_REAL[r.acao]}`,
    pesos: r.pesos,
    pesosCombo: {},
    posicao: r.posicao,
    vsPosicao: null,
    stack: null,
    acao: r.acao,
    teamId: null,
    amostra: r.oportunidades,
  };
}

type Retrato = { pesos: Pesos; pesosCombo: Pesos };

function assinatura(r: Retrato): string {
  const ordenar = (p: Pesos) =>
    Object.keys(p)
      .sort()
      .map((k) => `${k}:${Math.round(p[k] * 10) / 10}`)
      .join(",");
  return `${ordenar(r.pesos)}|${ordenar(r.pesosCombo)}`;
}

export function useConstrutor() {
  const [range, setRange] = useState<RangeAtual>(RANGE_NOVO);
  const rangeRef = useRef(range);
  const [salvo, setSalvo] = useState(() => assinatura(RANGE_NOVO));
  const desfazerRef = useRef<{ retratos: Retrato[]; grupo: string | null; quando: number }>({ retratos: [], grupo: null, quando: 0 });
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const [board, setBoardState] = useState<string[]>([]);
  const [selecoes, setSelecoes] = useState<Record<number, Selecao>>({});

  const aplicar = useCallback((novo: RangeAtual) => {
    rangeRef.current = novo;
    setRange(novo);
  }, []);

  /** Abre outro range (zera o desfazer e marca como "sem mudanças"). */
  const carregar = useCallback(
    (r: RangeAtual) => {
      aplicar(r);
      setSalvo(assinatura(r));
      desfazerRef.current = { retratos: [], grupo: null, quando: 0 };
      setPodeDesfazer(false);
    },
    [aplicar],
  );

  /** Troca dados do range sem mexer nas mãos (depois de salvar, por exemplo). */
  const atualizarDados = useCallback(
    (dados: Partial<RangeAtual>, marcarSalvo = false) => {
      const novo = { ...rangeRef.current, ...dados };
      aplicar(novo);
      if (marcarSalvo) setSalvo(assinatura(novo));
    },
    [aplicar],
  );

  /**
   * Muda as mãos do range. `grupo` junta mudanças seguidas num passo só do
   * desfazer (um arrasto na grade, o controle de Top %).
   */
  const editar = useCallback(
    (mudar: (r: Retrato) => Retrato, grupo?: string) => {
      const atual = rangeRef.current;
      const prox = mudar({ pesos: atual.pesos, pesosCombo: atual.pesosCombo });
      if (prox.pesos === atual.pesos && prox.pesosCombo === atual.pesosCombo) return;
      const d = desfazerRef.current;
      const agora = Date.now();
      if (!grupo || grupo !== d.grupo || agora - d.quando > 1500) {
        d.retratos.push({ pesos: atual.pesos, pesosCombo: atual.pesosCombo });
        if (d.retratos.length > 60) d.retratos.shift();
      }
      d.grupo = grupo ?? null;
      d.quando = agora;
      aplicar({ ...atual, ...prox });
      setPodeDesfazer(true);
    },
    [aplicar],
  );

  const desfazer = useCallback(() => {
    const d = desfazerRef.current;
    const ultimo = d.retratos.pop();
    if (!ultimo) return;
    d.grupo = null;
    aplicar({ ...rangeRef.current, ...ultimo });
    setPodeDesfazer(d.retratos.length > 0);
  }, [aplicar]);

  const alterado = useMemo(() => assinatura(range) !== salvo, [range, salvo]);

  const setBoard = useCallback((cartas: string[]) => {
    setBoardState(cartas.length >= 3 ? cartas.slice(0, 5) : []);
  }, []);

  const setSelecao = useCallback((cartas: number, s: Selecao) => {
    setSelecoes((atual) => ({ ...atual, [cartas]: s }));
  }, []);

  // Conta pesada (analisar o range no board) com os valores "adiados": a
  // grade responde na hora durante um arrasto e a análise vem logo depois.
  const pesosAdiados = useDeferredValue(range.pesos);
  const pesosComboAdiados = useDeferredValue(range.pesosCombo);
  const combos = useMemo(() => combosDoRange(pesosAdiados, pesosComboAdiados), [pesosAdiados, pesosComboAdiados]);
  const totalCombos = useMemo(() => contarCombos(range.pesos, range.pesosCombo), [range.pesos, range.pesosCombo]);
  const cartasBoard = useMemo(() => lerBoard(board), [board]);

  const ruas = useMemo(() => {
    const out: Rua[] = [];
    if (cartasBoard.length < 3) return out;
    let entrada = combos;
    for (let n = 3; n <= cartasBoard.length; n++) {
      const b = cartasBoard.slice(0, n);
      const analise = analisar(entrada, b);
      const selecao = selecoes[n] ?? SELECAO_VAZIA;
      const semSelecao = !selecao.feitas.length && !selecao.projetos.length;
      const continua = semSelecao
        ? new Map(analise.combos.map((c) => [c.combo, c.peso] as [string, number]))
        : continuar(analise, new Set(selecao.feitas), new Set(selecao.projetos));
      let continuaTotal = 0;
      for (const p of continua.values()) continuaTotal += p;
      out.push({ cartas: n, board: b, analise, selecao, semSelecao, continua, continuaTotal });
      entrada = continua;
    }
    return out;
  }, [combos, cartasBoard, selecoes]);

  return {
    range,
    carregar,
    atualizarDados,
    editar,
    desfazer,
    podeDesfazer,
    alterado,
    board,
    setBoard,
    cartasBoard,
    selecoes,
    setSelecao,
    combos,
    totalCombos,
    ruas,
    ruaAtual: ruas.length ? ruas[ruas.length - 1] : null,
  };
}

export type Construtor = ReturnType<typeof useConstrutor>;
