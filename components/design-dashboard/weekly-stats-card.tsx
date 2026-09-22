"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Gauge, Minus } from "lucide-react";
import {
  PREFLOP_REFERENCE,
  computePreflopMetrics,
  computeReferenceProfile,
  fetchAnalysisHandRows,
  type MetricRange,
} from "@/lib/services/analysis-service";
import type { AnalysisHandRow, PreflopMetrics } from "@/types/analysis";
import { CardHint, GlassCard } from "./glass-card";

const RAIO = 62;
const PERIMETRO = 2 * Math.PI * RAIO;
const TROCA_MS = 6000;

type Metrica = {
  chave: keyof typeof PREFLOP_REFERENCE.cash6max;
  rotulo: string;
  explicacao: string;
  ler: (m: PreflopMetrics) => number | null;
};

// Só métricas de pré-flop com faixa de referência conhecida (as mesmas
// que o módulo Performance usa) -- sem faixa não dá pra dizer se a
// semana foi "melhor", só se o número subiu ou desceu.
const METRICAS: Metrica[] = [
  { chave: "vpip", rotulo: "VPIP", explicacao: "quanto você entra em pote", ler: (m) => m.vpip_pct },
  { chave: "pfr", rotulo: "PFR", explicacao: "quanto você abre com agressão", ler: (m) => m.pfr_pct },
  { chave: "threeBet", rotulo: "3-Bet", explicacao: "quanto você reaumenta", ler: (m) => m.three_bet_pct },
  { chave: "foldTo3bet", rotulo: "Fold ao 3-Bet", explicacao: "quanto você desiste ao levar 3-bet", ler: (m) => m.fold_to_3bet_pct },
  { chave: "steal", rotulo: "Steal", explicacao: "quanto você ataca os blinds", ler: (m) => m.steal_pct },
];

// Distância até a faixa ideal: 0 quando está dentro dela. É isso que
// define "melhor ou pior" -- subir não é bom nem ruim por si só, o que
// importa é chegar mais perto do intervalo saudável.
function distancia(valor: number, faixa: MetricRange): number {
  if (valor < faixa.min) return faixa.min - valor;
  if (valor > faixa.max) return valor - faixa.max;
  return 0;
}

function dentroDaJanela(r: AnalysisHandRow, deDias: number, ateDias: number): boolean {
  const dias = (Date.now() - new Date(r.playedAt).getTime()) / 86400000;
  return dias >= deDias && dias < ateDias;
}

// Contador de giro: uma métrica por vez, girando sozinho, sempre
// comparando os últimos 7 dias com os 7 anteriores. Responde a pergunta
// "essa semana eu joguei melhor que a passada?" em vez de só mostrar um
// número solto.
export function WeeklyStatsCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [linhas, setLinhas] = useState<AnalysisHandRow[] | null>(null);
  const [indice, setIndice] = useState(0);
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

  useEffect(() => {
    if (pausado) return;
    const id = setInterval(() => setIndice((i) => (i + 1) % METRICAS.length), TROCA_MS);
    return () => clearInterval(id);
  }, [pausado]);

  const dados = useMemo(() => {
    if (!linhas) return null;
    const semana = linhas.filter((r) => dentroDaJanela(r, 0, 7));
    const anterior = linhas.filter((r) => dentroDaJanela(r, 7, 14));
    return {
      semana: computePreflopMetrics(semana),
      anterior: computePreflopMetrics(anterior),
      referencia: PREFLOP_REFERENCE[computeReferenceProfile(linhas)],
    };
  }, [linhas]);

  const metrica = METRICAS[indice];
  const faixa = dados?.referencia[metrica.chave] ?? null;
  const agora = dados ? metrica.ler(dados.semana) : null;
  const antes = dados ? metrica.ler(dados.anterior) : null;

  // Escala do anel: o dobro do topo da faixa ideal, arredondado -- assim
  // a faixa saudável cai sempre na metade do anel, fácil de ler de longe.
  const escala = faixa ? Math.max(faixa.max * 2, 10) : 100;
  const fracao = agora != null ? Math.min(1, agora / escala) : 0;
  const bandaInicio = faixa ? Math.min(1, faixa.min / escala) : 0;
  const bandaTamanho = faixa ? Math.min(1, faixa.max / escala) - bandaInicio : 0;

  const delta = agora != null && antes != null ? agora - antes : null;
  const veredito =
    agora != null && antes != null && faixa
      ? (() => {
          const d = distancia(agora, faixa) - distancia(antes, faixa);
          if (Math.abs(d) < 0.5) return "igual" as const;
          return d < 0 ? ("melhor" as const) : ("pior" as const);
        })()
      : null;

  const CORES = {
    melhor: { texto: "text-positive", borda: "border-positive/40", fundo: "bg-positive/10" },
    pior: { texto: "text-negative", borda: "border-negative/40", fundo: "bg-negative/10" },
    igual: { texto: "text-white/55", borda: "border-white/12", fundo: "bg-white/5" },
  };
  const estilo = veredito ? CORES[veredito] : CORES.igual;
  const dentro = agora != null && faixa ? distancia(agora, faixa) === 0 : false;

  const semDados = dados != null && dados.semana.hands === 0;

  return (
    <GlassCard
      title="Como vai a semana"
      icon={<Gauge size={13} />}
      action={
        <Link
          href="/performance"
          className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/55 transition-colors hover:border-[color:var(--psd-line-strong)] hover:text-white"
        >
          Ver análise
        </Link>
      }
      style={style}
      className={className}
    >
      {!dados ? (
        <CardHint>Carregando suas mãos…</CardHint>
      ) : semDados ? (
        <CardHint>
          Nenhuma mão importada nos últimos 7 dias. O contador usa as mãos que o Radar ou a importação trouxeram —{" "}
          <Link href="/radar" className="font-semibold text-[color:var(--psd-neon-soft)] underline underline-offset-2">
            ver como importar
          </Link>
          .
        </CardHint>
      ) : (
        <div
          className="flex flex-1 flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8"
          onMouseEnter={() => setPausado(true)}
          onMouseLeave={() => setPausado(false)}
        >
          {/* Anel: a faixa clara é o intervalo saudável da referência, o
              traço colorido é onde você está nos últimos 7 dias. */}
          <div className="relative grid shrink-0 place-items-center">
            <svg width="150" height="150" viewBox="0 0 150 150">
              <circle cx="75" cy="75" r={RAIO} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
              {faixa && (
                <circle
                  cx="75"
                  cy="75"
                  r={RAIO}
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="9"
                  strokeDasharray={`${bandaTamanho * PERIMETRO} ${PERIMETRO}`}
                  strokeDashoffset={-bandaInicio * PERIMETRO}
                  transform="rotate(-90 75 75)"
                />
              )}
              <circle
                cx="75"
                cy="75"
                r={RAIO}
                fill="none"
                stroke={dentro ? "#22c55e" : "#c084fc"}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${fracao * PERIMETRO} ${PERIMETRO}`}
                transform="rotate(-90 75 75)"
                style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.6s ease" }}
              />
            </svg>
            <div className="absolute text-center">
              <p className="tnum text-3xl font-light leading-none">{agora == null ? "—" : `${agora.toFixed(1)}%`}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">{metrica.rotulo}</p>
            </div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm text-white/60">
              <span className="font-semibold text-white">{metrica.rotulo}</span> — {metrica.explicacao}.
            </p>

            <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${estilo.borda} ${estilo.fundo} ${estilo.texto}`}>
              {veredito === "melhor" ? <ArrowUpRight size={14} /> : veredito === "pior" ? <ArrowDownRight size={14} /> : <Minus size={14} />}
              {veredito === "melhor"
                ? "Melhor que a semana passada"
                : veredito === "pior"
                  ? "Pior que a semana passada"
                  : antes == null
                    ? "Sem semana anterior pra comparar"
                    : "Igual à semana passada"}
            </div>

            <p className="mt-2 text-[12px] text-white/45">
              {agora == null || !faixa
                ? ""
                : dentro
                  ? "Você está dentro da faixa saudável."
                  : agora > faixa.max
                    ? `Ainda acima da faixa (${faixa.min}–${faixa.max}%).`
                    : `Ainda abaixo da faixa (${faixa.min}–${faixa.max}%).`}
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-3 text-left">
              <div>
                <dt className="text-[10px] uppercase tracking-[0.1em] text-white/35">7 dias antes</dt>
                <dd className="tnum text-sm">{antes == null ? "—" : `${antes.toFixed(1)}%`}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.1em] text-white/35">Variação</dt>
                <dd className={`tnum text-sm ${estilo.texto}`}>
                  {delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} pp`}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-[0.1em] text-white/35">Faixa saudável</dt>
                <dd className="tnum text-sm text-white/60">{faixa ? `${faixa.min}–${faixa.max}%` : "—"}</dd>
              </div>
            </dl>

            <p className="mt-3 text-[11px] text-white/35">
              {dados.semana.hands} mãos nos últimos 7 dias · {dados.anterior.hands} nos 7 anteriores
            </p>

            {/* Bolinhas: trocam a métrica na mão e mostram em qual o giro está. */}
            <div className="mt-3 flex items-center justify-center gap-1.5 sm:justify-start">
              {METRICAS.map((m, i) => (
                <button
                  key={m.chave}
                  type="button"
                  onClick={() => setIndice(i)}
                  aria-label={`Ver ${m.rotulo}`}
                  aria-current={i === indice}
                  className={`h-1.5 rounded-full transition-all ${
                    i === indice ? "w-6 bg-[color:var(--psd-neon-soft)]" : "w-1.5 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
              <ArrowRight size={12} className="ml-1 text-white/20" />
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
