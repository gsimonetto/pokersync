import { SLA_PADRAO_DIAS, type FunnelPhase, type PlayerCard } from "@/lib/services/team-funnel-service";

// Regras do funil do time, sem nada de tela: o que conta como "pronto
// pra subir", quando um cartão esfria e em que estado está o próximo
// passo. Quadro, planilha, relatórios e o cartão aberto leem daqui --
// um lugar só pra regra, pra que as quatro telas nunca discordem.

const DIA_MS = 86_400_000;

export function diasNaFase(card: Pick<PlayerCard, "movedAt">, agora = Date.now()): number {
  return Math.max(0, Math.floor((agora - new Date(card.movedAt).getTime()) / DIA_MS));
}

// ------------------------------------------------------------
// Requisitos de subida
// Drills e reviews sempre contam quando a meta é maior que zero (como já
// era). Sessões, ROI, score e presença só contam se a fase definir.
// ------------------------------------------------------------

export type ChaveRequisito = "drills" | "reviews" | "sessoes" | "roi" | "score" | "presenca";

export interface Requisito {
  chave: ChaveRequisito;
  rotulo: string;
  atual: string;
  alvo: string;
  ok: boolean;
  /** 0-1, pra barra de progresso. */
  progresso: number;
}

const frac = (feito: number, alvo: number) => (alvo <= 0 ? 1 : Math.max(0, Math.min(1, feito / alvo)));

export function requisitosDoCard(card: PlayerCard, fase: FunnelPhase | undefined, score: number | null): Requisito[] {
  const lista: Requisito[] = [];

  if (card.drillsTarget > 0) {
    lista.push({
      chave: "drills",
      rotulo: "Drills",
      atual: String(card.drillsDone),
      alvo: String(card.drillsTarget),
      ok: card.drillsDone >= card.drillsTarget,
      progresso: frac(card.drillsDone, card.drillsTarget),
    });
  }
  if (card.reviewsTarget > 0) {
    lista.push({
      chave: "reviews",
      rotulo: "Reviews",
      atual: String(card.reviewsDone),
      alvo: String(card.reviewsTarget),
      ok: card.reviewsDone >= card.reviewsTarget,
      progresso: frac(card.reviewsDone, card.reviewsTarget),
    });
  }
  if (!fase) return lista;

  if (fase.reqSessoes != null && fase.reqSessoes > 0) {
    const feito = card.sessoesFase ?? 0;
    lista.push({
      chave: "sessoes",
      rotulo: "Sessões na fase",
      atual: String(feito),
      alvo: String(fase.reqSessoes),
      ok: feito >= fase.reqSessoes,
      progresso: frac(feito, fase.reqSessoes),
    });
  }
  if (fase.reqRoiPct != null) {
    const roi = card.roiPct;
    lista.push({
      chave: "roi",
      rotulo: "ROI",
      atual: roi == null ? "—" : `${roi > 0 ? "+" : ""}${roi.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
      alvo: `${fase.reqRoiPct.toLocaleString("pt-BR")}%`,
      ok: roi != null && roi >= fase.reqRoiPct,
      // Sem escala natural pra ROI: barra cheia quando bate, vazia quando não.
      progresso: roi != null && roi >= fase.reqRoiPct ? 1 : 0,
    });
  }
  if (fase.reqScore != null && fase.reqScore > 0) {
    lista.push({
      chave: "score",
      rotulo: "Score de evolução",
      atual: score == null ? "—" : String(score),
      alvo: String(fase.reqScore),
      ok: score != null && score >= fase.reqScore,
      progresso: score == null ? 0 : frac(score, fase.reqScore),
    });
  }
  if (fase.reqPresencaPct != null && fase.reqPresencaPct > 0) {
    // Sem evento na fase ainda não há falta pra cobrar: conta como ok,
    // mas o texto deixa claro que não houve evento.
    const semEvento = card.eventosTotal === 0;
    const pct = semEvento ? null : Math.round((card.eventosPresente / card.eventosTotal) * 100);
    lista.push({
      chave: "presenca",
      rotulo: "Presença",
      atual: pct == null ? "sem eventos" : `${pct}%`,
      alvo: `${fase.reqPresencaPct}%`,
      ok: pct == null || pct >= fase.reqPresencaPct,
      progresso: pct == null ? 1 : frac(pct, fase.reqPresencaPct),
    });
  }
  return lista;
}

export interface Prontidao {
  total: number;
  cumpridos: number;
  /** true só quando existe ao menos 1 requisito e todos foram cumpridos. */
  pronto: boolean;
}

export function prontidao(reqs: Requisito[]): Prontidao {
  const cumpridos = reqs.filter((r) => r.ok).length;
  return { total: reqs.length, cumpridos, pronto: reqs.length > 0 && cumpridos === reqs.length };
}

// ------------------------------------------------------------
// Temperatura (cartão parado esfria) -- o "negócio apodrecendo" do
// Pipedrive: passou o prazo da fase sem mudar de fase, esfria; passou o
// dobro, congela.
// ------------------------------------------------------------

export type Temperatura = "em_dia" | "esfriando" | "parado";

export const TEMPERATURA_LABEL: Record<Temperatura, string> = {
  em_dia: "Em dia",
  esfriando: "Esfriando",
  parado: "Parado",
};

export const TEMPERATURA_COR: Record<Temperatura, string> = {
  em_dia: "#22c55e",
  esfriando: "#f59e0b",
  parado: "#e0555a",
};

/** Prazo da fase; sem prazo próprio, vale o padrão do funil (configurável pelo admin). */
export function slaDaFase(fase: FunnelPhase | undefined, padrao = SLA_PADRAO_DIAS): number {
  return fase?.slaDias ?? padrao;
}

export function temperatura(
  card: PlayerCard,
  fase: FunnelPhase | undefined,
  agora = Date.now(),
  padrao = SLA_PADRAO_DIAS
): Temperatura {
  const dias = diasNaFase(card, agora);
  const sla = slaDaFase(fase, padrao);
  if (dias >= sla * 2) return "parado";
  if (dias >= sla) return "esfriando";
  return "em_dia";
}

// ------------------------------------------------------------
// Próximo passo -- regra de ouro de CRM: todo cartão tem um próximo
// passo com data. Sem isso, o jogador fica esquecido no quadro.
// ------------------------------------------------------------

export type EstadoPasso = "sem" | "atrasado" | "hoje" | "em_breve" | "agendado";

export const ESTADO_PASSO_COR: Record<EstadoPasso, string> = {
  sem: "#e0555a",
  atrasado: "#e0555a",
  hoje: "#f59e0b",
  em_breve: "#e6c763",
  agendado: "#c4c7c8",
};

function inicioDoDia(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function estadoPasso(card: Pick<PlayerCard, "nextStep" | "nextStepAt">, agora = Date.now()): EstadoPasso {
  if (!card.nextStep?.trim()) return "sem";
  if (!card.nextStepAt) return "agendado";
  const quando = new Date(card.nextStepAt).getTime();
  const hoje = inicioDoDia(agora);
  if (quando < hoje) return "atrasado";
  if (quando < hoje + DIA_MS) return "hoje";
  if (quando < hoje + 3 * DIA_MS) return "em_breve";
  return "agendado";
}

/** "hoje", "amanhã", "ontem", "há 3 dias", "em 5 dias", "12/10". */
export function quandoRelativo(iso: string, agora = Date.now()): string {
  const alvo = inicioDoDia(new Date(iso).getTime());
  const dif = Math.round((alvo - inicioDoDia(agora)) / DIA_MS);
  if (dif === 0) return "hoje";
  if (dif === 1) return "amanhã";
  if (dif === -1) return "ontem";
  if (dif < 0) return `há ${-dif} dias`;
  if (dif <= 6) return `em ${dif} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ------------------------------------------------------------
// Faixa de buy-in da fase ("R$ 5–22", "até R$ 11", "R$ 109+")
// ------------------------------------------------------------

const brlInteiro = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function faixaBuyin(fase: Pick<FunnelPhase, "buyinMin" | "buyinMax">): string | null {
  const { buyinMin: min, buyinMax: max } = fase;
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${brlInteiro.format(min)}–${brlInteiro.format(max).replace("R$", "").trim()}`;
  if (min != null) return `${brlInteiro.format(min)}+`;
  return `até ${brlInteiro.format(max as number)}`;
}

/** Buy-in médio do jogador fora da faixa da fase atual? (sinal pro coach). */
export function foraDaFaixa(abi: number | null, fase: FunnelPhase | undefined): "acima" | "abaixo" | null {
  if (abi == null || !fase) return null;
  if (fase.buyinMax != null && abi > fase.buyinMax) return "acima";
  if (fase.buyinMin != null && abi < fase.buyinMin) return "abaixo";
  return null;
}
