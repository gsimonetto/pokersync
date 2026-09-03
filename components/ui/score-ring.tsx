// Indicador compacto do Score de evolução (0-100): resume atividade,
// estudo, consistência e progresso do jogador num número só, com a
// mesma linguagem de cor que o Assistente do coach já usa (positive =
// saudável, evolution = atenção, negative = risco alto) -- não é uma
// paleta nova, é a mesma semântica reaproveitada. Mesmo padrão visual
// do RankChip (círculo, borda + fundo na cor).
export type NivelRisco = "baixo" | "medio" | "alto";

const RISCO_CLASSES: Record<NivelRisco, string> = {
  baixo: "border-positive text-positive bg-positive/10",
  medio: "border-evolution text-evolution bg-evolution/10",
  alto: "border-negative text-negative bg-negative/10",
};

const RISCO_LABEL: Record<NivelRisco, string> = {
  baixo: "saudável",
  medio: "atenção",
  alto: "risco alto",
};

export type Tendencia = "subiu" | "caiu" | "estavel";

const TENDENCIA_LABEL: Record<Tendencia, string> = {
  subiu: "Subiu nos últimos 7 dias",
  caiu: "Caiu nos últimos 7 dias",
  estavel: "Estável nos últimos 7 dias",
};

export function ScoreRing({
  valor,
  risco,
  tendencia,
  className = "",
}: {
  valor: number;
  risco: NivelRisco;
  /** Opcional: só passa quando já tiver histórico carregado (Ficha do jogador) -- em lista, o custo de buscar histórico por linha não compensa. */
  tendencia?: Tendencia;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <span
        title={`Score de evolução: ${valor} — ${RISCO_LABEL[risco]}`}
        className={`inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full border-2 px-1 text-[10px] font-black tabular-nums ${RISCO_CLASSES[risco]}`}
      >
        {valor}
      </span>
      {tendencia && tendencia !== "estavel" && (
        <span
          title={TENDENCIA_LABEL[tendencia]}
          className={`text-[11px] font-bold ${tendencia === "subiu" ? "text-positive" : "text-negative"}`}
        >
          {tendencia === "subiu" ? "▲" : "▼"}
        </span>
      )}
    </span>
  );
}
