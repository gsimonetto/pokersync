import { Gauge } from "lucide-react";
import { nivelDoScore, type PlayerPerformance } from "@/lib/services/performance-service";

// Score de Evolução consolidado (MAIN-011): resume os 5 componentes já
// calculados no banco (view player_performance_snapshot, ver
// lib/services/performance-service.ts) num card único, com o hover
// explicando de onde cada pedaço vem -- pedido explícito: "intuitivo,
// que ao passar o mouse mostre o que contempla aquele valor". Usa o
// atributo title nativo (mesmo padrão do ScoreRing em components/ui),
// não uma lib de tooltip nova.
export interface ScoreComponent {
  key: keyof Pick<
    PlayerPerformance,
    "score_tecnica" | "score_conhecimento" | "score_disciplina" | "score_performance" | "score_consistencia"
  >;
  label: string;
  peso: string;
  explicacao: string;
}

export const COMPONENTES: ScoreComponent[] = [
  {
    key: "score_tecnica",
    label: "Técnica",
    peso: "25%",
    explicacao: "Quanto você acerta nas suas próprias avaliações de mão no Revisor (quando você marca se acertou ou errou a decisão).",
  },
  {
    key: "score_conhecimento",
    label: "Conhecimento",
    peso: "20%",
    explicacao: "Taxa de acerto nos treinos do Modo Treino (decisões comparadas com o GTO).",
  },
  {
    key: "score_disciplina",
    label: "Disciplina",
    peso: "20%",
    explicacao: "Sua sequência de dias ativos (streak) — 14 dias seguidos ou mais já vale o máximo desse pedaço.",
  },
  {
    key: "score_performance",
    label: "Performance",
    peso: "20%",
    explicacao: "Seu ROI (retorno sobre investimento) nas sessões registradas na Gestão de Banca.",
  },
  {
    key: "score_consistencia",
    label: "Consistência",
    peso: "15%",
    explicacao: "Quantas sessões por semana você registra — 3 ou mais por semana já vale o máximo desse pedaço.",
  },
];

function corDoScore(valor: number): { texto: string; barra: string; fundo: string } {
  if (valor < 40) return { texto: "text-negative", barra: "bg-negative", fundo: "bg-negative/10" };
  if (valor < 70) return { texto: "text-evolution", barra: "bg-evolution", fundo: "bg-evolution/10" };
  return { texto: "text-positive", barra: "bg-positive", fundo: "bg-positive/10" };
}

// Quando falta dado, o componente já vem 50 (neutro) direto da view —
// não é tratado como "sem dado" aqui, é um valor real e válido.
export function EvolutionScoreCard({ perf }: { perf: PlayerPerformance | null }) {
  if (!perf || perf.score_geral === null) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Gauge size={16} />
          Score de evolução aparece assim que você tiver as primeiras mãos, sessões ou treinos registrados.
        </div>
      </div>
    );
  }

  const score = perf.score_geral;
  const cor = corDoScore(score);
  const nivel = nivelDoScore(score);

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch">
        <div
          title={`Score de evolução: ${score}/100 — soma ponderada dos 5 componentes ao lado.`}
          className={`flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 px-6 py-4 ${cor.fundo} ${cor.texto}`}
          style={{ borderColor: "currentColor" }}
        >
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
            <Gauge size={12} /> Score de evolução
          </span>
          <span className="text-4xl font-black tabular-nums leading-none">{score}</span>
          <span className="text-xs font-bold uppercase tracking-wide">{nivel}</span>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-5">
          {COMPONENTES.map((c) => {
            const valor = perf[c.key] ?? 50;
            const corComponente = corDoScore(valor);
            return (
              <div
                key={c.key}
                title={`${c.label} (peso ${c.peso}): ${c.explicacao}`}
                className="flex flex-col justify-between rounded-lg border border-hairline bg-elevated p-2.5"
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{c.label}</span>
                  <span className={`text-xs font-extrabold tabular-nums ${corComponente.texto}`}>{valor}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${corComponente.barra}`}
                    style={{ width: `${Math.min(100, Math.max(0, valor))}%` }}
                  />
                </div>
                <span className="mt-1 text-[9px] text-muted">peso {c.peso}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
