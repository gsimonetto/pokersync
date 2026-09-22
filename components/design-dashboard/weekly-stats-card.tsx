"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Gauge, Minus } from "lucide-react";
import {
  PREFLOP_REFERENCE,
  POSTFLOP_REFERENCE,
  computePostflopMetrics,
  computePreflopMetrics,
  computeReferenceProfile,
  fetchAnalysisHandRows,
  type MetricRange,
} from "@/lib/services/analysis-service";
import type { AnalysisHandRow, PostflopMetrics, PreflopMetrics, ReferenceProfile } from "@/types/analysis";
import { CardHint, GlassCard } from "./glass-card";

const RAIO = 58;
const PERIMETRO = 2 * Math.PI * RAIO;
const TROCA_MS = 6000;

type Leitura = { pre: PreflopMetrics; post: PostflopMetrics };

type Metrica = {
  id: string;
  rotulo: string;
  grupo: "Pré-flop" | "Pós-flop";
  unidade: "%" | "x";
  explicacao: string;
  ler: (l: Leitura) => number | null;
  faixa: (perfil: ReferenceProfile) => MetricRange;
};

// Só entram métricas que têm faixa de referência conhecida (as mesmas
// de PREFLOP_REFERENCE/POSTFLOP_REFERENCE, usadas pelo módulo
// Performance). Sem faixa não dá pra dizer se a semana foi melhor — só
// se o número subiu ou desceu, o que sozinho não quer dizer nada.
const METRICAS: Metrica[] = [
  { id: "vpip", rotulo: "VPIP", grupo: "Pré-flop", unidade: "%", explicacao: "quanto você entra em pote", ler: (l) => l.pre.vpip_pct, faixa: (p) => PREFLOP_REFERENCE[p].vpip },
  { id: "pfr", rotulo: "PFR", grupo: "Pré-flop", unidade: "%", explicacao: "quanto você abre com agressão", ler: (l) => l.pre.pfr_pct, faixa: (p) => PREFLOP_REFERENCE[p].pfr },
  { id: "3bet", rotulo: "3-Bet", grupo: "Pré-flop", unidade: "%", explicacao: "quanto você reaumenta", ler: (l) => l.pre.three_bet_pct, faixa: (p) => PREFLOP_REFERENCE[p].threeBet },
  { id: "fold3bet", rotulo: "Fold ao 3-Bet", grupo: "Pré-flop", unidade: "%", explicacao: "quanto você desiste ao levar 3-bet", ler: (l) => l.pre.fold_to_3bet_pct, faixa: (p) => PREFLOP_REFERENCE[p].foldTo3bet },
  { id: "steal", rotulo: "Steal", grupo: "Pré-flop", unidade: "%", explicacao: "quanto você ataca os blinds", ler: (l) => l.pre.steal_pct, faixa: (p) => PREFLOP_REFERENCE[p].steal },
  { id: "cbetflop", rotulo: "C-Bet flop", grupo: "Pós-flop", unidade: "%", explicacao: "quanto você continua a agressão no flop", ler: (l) => l.post.cbet_flop_pct, faixa: (p) => POSTFLOP_REFERENCE[p].cbetFlop },
  { id: "foldcbet", rotulo: "Fold ao C-Bet", grupo: "Pós-flop", unidade: "%", explicacao: "quanto você desiste da c-bet do vilão", ler: (l) => l.post.fold_to_cbet_flop_pct, faixa: (p) => POSTFLOP_REFERENCE[p].foldToCbetFlop },
  { id: "cbetturn", rotulo: "C-Bet turn", grupo: "Pós-flop", unidade: "%", explicacao: "quanto você aposta de novo no turn", ler: (l) => l.post.cbet_turn_pct, faixa: (p) => POSTFLOP_REFERENCE[p].cbetTurn },
  { id: "donk", rotulo: "Donk bet", grupo: "Pós-flop", unidade: "%", explicacao: "quanto você aposta fora de posição contra o agressor", ler: (l) => l.post.donk_bet_pct, faixa: (p) => POSTFLOP_REFERENCE[p].donkBet },
  { id: "wsd", rotulo: "WTSD", grupo: "Pós-flop", unidade: "%", explicacao: "quanto das mãos chega ao showdown", ler: (l) => l.post.wsd_pct, faixa: (p) => POSTFLOP_REFERENCE[p].wsd },
  { id: "wsdwon", rotulo: "W$SD", grupo: "Pós-flop", unidade: "%", explicacao: "quanto você ganha quando chega ao showdown", ler: (l) => l.post.wsd_won_pct, faixa: (p) => POSTFLOP_REFERENCE[p].wsdWon },
  { id: "af", rotulo: "Agressão", grupo: "Pós-flop", unidade: "x", explicacao: "quantas apostas/aumentos para cada pagamento", ler: (l) => l.post.aggression_factor, faixa: (p) => POSTFLOP_REFERENCE[p].aggFactor },
];

// Distância até a faixa ideal: 0 quando está dentro dela. É isso que
// define "melhor ou pior" -- subir não é bom nem ruim por si só, o que
// importa é chegar mais perto do intervalo saudável.
function distancia(valor: number, faixa: MetricRange): number {
  if (valor < faixa.min) return faixa.min - valor;
  if (valor > faixa.max) return valor - faixa.max;
  return 0;
}

type Veredito = "melhor" | "pior" | "igual" | null;

function compara(agora: number | null, antes: number | null, faixa: MetricRange, unidade: "%" | "x"): Veredito {
  if (agora == null || antes == null) return null;
  const d = distancia(agora, faixa) - distancia(antes, faixa);
  // Tolerância proporcional: 0,5 ponto percentual, ou 0,1 no fator de
  // agressão (que anda numa escala de 1 a 4, não de 0 a 100).
  const minimo = unidade === "x" ? 0.1 : 0.5;
  if (Math.abs(d) < minimo) return "igual";
  return d < 0 ? "melhor" : "pior";
}

const COR: Record<Exclude<Veredito, null>, string> = {
  melhor: "text-positive",
  pior: "text-negative",
  igual: "text-white/45",
};

function formata(valor: number | null, unidade: "%" | "x"): string {
  if (valor == null) return "—";
  return unidade === "x" ? `${valor.toFixed(2)}x` : `${valor.toFixed(1)}%`;
}

function dentroDaJanela(r: AnalysisHandRow, deDias: number, ateDias: number): boolean {
  const dias = (Date.now() - new Date(r.playedAt).getTime()) / 86400000;
  return dias >= deDias && dias < ateDias;
}

// Trilha fina de cada indicador: a parte clara é a faixa saudável, o
// ponto é onde você está. Dá pra ler "estou dentro?" sem precisar do
// número.
function Trilha({ valor, faixa, dentro }: { valor: number | null; faixa: MetricRange; dentro: boolean }) {
  const escala = Math.max(faixa.max * 1.8, valor ?? 0, 1);
  const pos = valor == null ? null : Math.min(100, (valor / escala) * 100);
  return (
    <div className="relative mt-2 h-1 rounded-full bg-white/8">
      <div
        className="absolute inset-y-0 rounded-full bg-white/25"
        style={{ left: `${(faixa.min / escala) * 100}%`, width: `${((faixa.max - faixa.min) / escala) * 100}%` }}
      />
      {pos != null && (
        <div
          className="absolute -top-0.5 h-2 w-2 -translate-x-1/2 rounded-full"
          style={{ left: `${pos}%`, background: dentro ? "#22c55e" : "#c084fc" }}
        />
      )}
    </div>
  );
}

// Como vai a semana: todos os indicadores que o app calcula, sempre
// comparando os últimos 7 dias com os 7 anteriores. O anel destaca um
// por vez (girando sozinho ou no clique) e o mosaico mostra o resto de
// uma vez só.
export function WeeklyStatsCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [linhas, setLinhas] = useState<AnalysisHandRow[] | null>(null);
  const [selecionada, setSelecionada] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const dados = await fetchAnalysisHandRows().catch(() => [] as AnalysisHandRow[]);
      if (vivo) setLinhas(dados);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const dados = useMemo(() => {
    if (!linhas) return null;
    const semana = linhas.filter((r) => dentroDaJanela(r, 0, 7));
    const anterior = linhas.filter((r) => dentroDaJanela(r, 7, 14));
    return {
      semana: { pre: computePreflopMetrics(semana), post: computePostflopMetrics(semana) },
      anterior: { pre: computePreflopMetrics(anterior), post: computePostflopMetrics(anterior) },
      perfil: computeReferenceProfile(linhas),
    };
  }, [linhas]);

  // Só gira entre as métricas que têm número nesta semana — não adianta
  // destacar um anel vazio.
  const comDados = useMemo(() => {
    if (!dados) return [];
    return METRICAS.filter((m) => m.ler(dados.semana) != null);
  }, [dados]);

  useEffect(() => {
    if (pausado || comDados.length < 2) return;
    const id = setInterval(() => setSelecionada((i) => (i + 1) % comDados.length), TROCA_MS);
    return () => clearInterval(id);
  }, [pausado, comDados.length]);

  const metrica = comDados[selecionada] ?? comDados[0] ?? null;
  const faixa = metrica && dados ? metrica.faixa(dados.perfil) : null;
  const agora = metrica && dados ? metrica.ler(dados.semana) : null;
  const antes = metrica && dados ? metrica.ler(dados.anterior) : null;
  const veredito = metrica && faixa ? compara(agora, antes, faixa, metrica.unidade) : null;
  const dentro = agora != null && faixa ? distancia(agora, faixa) === 0 : false;
  const delta = agora != null && antes != null ? agora - antes : null;

  const escalaAnel = faixa ? Math.max(faixa.max * 1.8, agora ?? 0) : 100;
  const fracao = agora != null ? Math.min(1, agora / escalaAnel) : 0;
  const bandaInicio = faixa ? Math.min(1, faixa.min / escalaAnel) : 0;
  const bandaTamanho = faixa ? Math.min(1, faixa.max / escalaAnel) - bandaInicio : 0;

  const semDados = dados != null && dados.semana.pre.hands === 0;

  return (
    <GlassCard
      title="Como vai a semana"
      icon={<Gauge size={13} />}
      action={
        dados && !semDados ? (
          <span className="flex items-center gap-3">
            <span className="tnum hidden text-[11px] text-white/35 sm:inline">
              {dados.semana.pre.hands} mãos · {dados.anterior.pre.hands} na semana anterior
            </span>
            <Link
              href="/performance"
              className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/55 transition-colors hover:border-[color:var(--psd-line-strong)] hover:text-white"
            >
              Ver análise
            </Link>
          </span>
        ) : null
      }
      style={style}
      className={className}
    >
      {!dados ? (
        <CardHint>Carregando suas mãos…</CardHint>
      ) : semDados || !metrica || !faixa ? (
        <CardHint>
          Nenhuma mão importada nos últimos 7 dias. Os indicadores usam as mãos que o Radar ou a importação trouxeram —{" "}
          <Link href="/radar" className="font-semibold text-[color:var(--psd-neon-soft)] underline underline-offset-2">
            ver como importar
          </Link>
          .
        </CardHint>
      ) : (
        <div
          className="flex flex-col gap-6 lg:flex-row lg:items-start"
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
        >
          {/* Destaque: um indicador por vez, em anel grande. */}
          <div className="flex shrink-0 flex-col items-center gap-3 lg:w-[230px]">
            <div className="relative grid place-items-center">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={RAIO} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
                <circle
                  cx="70"
                  cy="70"
                  r={RAIO}
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="9"
                  strokeDasharray={`${bandaTamanho * PERIMETRO} ${PERIMETRO}`}
                  strokeDashoffset={-bandaInicio * PERIMETRO}
                  transform="rotate(-90 70 70)"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={RAIO}
                  fill="none"
                  stroke={dentro ? "#22c55e" : "#c084fc"}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${fracao * PERIMETRO} ${PERIMETRO}`}
                  transform="rotate(-90 70 70)"
                  style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease" }}
                />
              </svg>
              <div className="absolute text-center">
                <p className="tnum text-[26px] font-light leading-none">{formata(agora, metrica.unidade)}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45">{metrica.rotulo}</p>
              </div>
            </div>

            <p className="text-center text-[12px] text-white/50">{metrica.explicacao}</p>

            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                veredito === "melhor"
                  ? "border-positive/40 bg-positive/10 text-positive"
                  : veredito === "pior"
                    ? "border-negative/40 bg-negative/10 text-negative"
                    : "border-white/12 bg-white/5 text-white/55"
              }`}
            >
              {veredito === "melhor" ? <ArrowUpRight size={13} /> : veredito === "pior" ? <ArrowDownRight size={13} /> : <Minus size={13} />}
              {veredito === "melhor"
                ? "Melhor que a semana passada"
                : veredito === "pior"
                  ? "Pior que a semana passada"
                  : antes == null
                    ? "Sem semana anterior"
                    : "Igual à semana passada"}
            </div>

            <p className="text-center text-[11px] text-white/40">
              {dentro ? "Dentro da faixa saudável" : agora != null && agora > faixa.max ? "Acima da faixa" : "Abaixo da faixa"} ·{" "}
              antes {formata(antes, metrica.unidade)}
              {delta != null && (
                <span className={COR[veredito ?? "igual"]}>
                  {" "}
                  ({delta > 0 ? "+" : ""}
                  {metrica.unidade === "x" ? delta.toFixed(2) : `${delta.toFixed(1)} pp`})
                </span>
              )}
            </p>
          </div>

          {/* Mosaico com TODOS os indicadores da semana. Clicar troca o
              destaque do anel (e pausa o giro enquanto o mouse está por
              cima do card). */}
          <div className="min-w-0 flex-1">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {METRICAS.map((m) => {
                const f = m.faixa(dados.perfil);
                const v = m.ler(dados.semana);
                const vAntes = m.ler(dados.anterior);
                const vd = compara(v, vAntes, f, m.unidade);
                const d = v != null && vAntes != null ? v - vAntes : null;
                const ativo = metrica.id === m.id;
                const posicao = comDados.findIndex((x) => x.id === m.id);
                const temDado = v != null;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={!temDado}
                      onClick={() => posicao >= 0 && setSelecionada(posicao)}
                      className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                        ativo
                          ? "border-[color:var(--psd-line-strong)] bg-white/[0.07]"
                          : "border-white/8 bg-white/[0.03] hover:border-white/20"
                      } ${temDado ? "" : "opacity-40"}`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">{m.rotulo}</span>
                        <span className={`tnum shrink-0 text-[10px] font-semibold ${COR[vd ?? "igual"]}`}>
                          {d == null ? "—" : `${d > 0 ? "+" : ""}${m.unidade === "x" ? d.toFixed(2) : d.toFixed(1)}`}
                        </span>
                      </span>
                      <span className="tnum mt-1 block text-lg font-light leading-none">{formata(v, m.unidade)}</span>
                      <Trilha valor={v} faixa={f} dentro={v != null && distancia(v, f) === 0} />
                      <span className="mt-1.5 block text-[10px] text-white/30">
                        {m.grupo} · ideal {m.unidade === "x" ? `${f.min}–${f.max}x` : `${f.min}–${f.max}%`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-white/30">
              Comparação: últimos 7 dias contra os 7 anteriores. A faixa ideal segue o perfil{" "}
              {dados.perfil === "mtt8max" ? "de torneio (8-max)" : "de cash 6-max"}, escolhido pelo formato que você mais jogou.
            </p>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
