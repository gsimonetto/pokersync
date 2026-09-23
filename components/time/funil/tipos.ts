import type { CardLabel, FunnelPhase, PlayerCard } from "@/lib/services/team-funnel-service";
import type { TeamDashboardRow } from "@/lib/services/team-service";
import type { EstadoPasso, Prontidao, Requisito, Temperatura } from "@/lib/time/funil-regras";

// Um cartão do funil com tudo que as telas precisam já calculado uma vez
// (quadro, planilha, relatórios e o cartão aberto leem o mesmo objeto).
export interface ItemFunil {
  card: PlayerCard;
  jogador: TeamDashboardRow | undefined;
  fase: FunnelPhase | undefined;
  nome: string;
  score: number | null;
  requisitos: Requisito[];
  prontidao: Prontidao;
  temperatura: Temperatura;
  diasNaFase: number;
  /** null = banco sem a migração (não existe próximo passo pra cobrar). */
  passo: EstadoPasso | null;
  labels: CardLabel[];
  checklist: { done: number; total: number } | null;
}

/** Atalhos da barra de atenção -- cada um vira um filtro de um clique. */
export type Foco = "prontos" | "esfriando" | "sem_passo" | "atrasados" | "pendentes";

export type Agrupamento = "nenhum" | "coach" | "etiqueta" | "prioridade";
