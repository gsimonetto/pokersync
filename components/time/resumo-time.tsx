"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, Crosshair, Gauge, Siren, Trophy, Wallet, type LucideIcon } from "lucide-react";
import { AvatarNivel } from "@/components/avatar-nivel";
import { EASE, Linha, Numero } from "@/components/painel/painel-card";
import { InfoHover, type Explicacao } from "@/components/painel/info-hover";
import { PainelCard } from "@/components/time/painel-card";
import { calcularScore, diasSemAtividade, type PeriodComparison, type TeamDashboardRow } from "@/lib/services/team-service";
import { BRL, variacao } from "@/lib/format";

// Topo da Visão geral do time, no MESMO padrão do resumo da tela inicial
// e da Performance: números grandes em negrito, centralizados, com a
// explicação ao passar o mouse e a direção em relação ao período
// anterior logo embaixo (cor neutra -- sem faixa "ideal" validada, subir
// não é automaticamente bom). Só o resultado em R$ ganha cor, porque ali
// a cor é o sinal (lucro/prejuízo).

type Bloco = {
  rotulo: string;
  icone: LucideIcon;
  valor: number | null;
  formatar: (n: number) => string;
  sufixo?: string;
  cor?: string;
  variacao?: string | null;
  detalhe: string;
  explicacao: Explicacao;
};

const COR_POSITIVO = "#22c55e";
const COR_NEGATIVO = "#e0555a";
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

function textoVariacao(v: number | null, unidade: "%" | "pp", periodo: string): string | null {
  if (v == null) return null;
  if (v === 0) return `estável vs ${periodo} antes`;
  return `${v > 0 ? "↑" : "↓"} ${Math.abs(v)}${unidade === "%" ? "%" : " pts"} vs ${periodo} antes`;
}

export function ResumoTime({
  jogadores,
  comparacao,
  tendenciaScore,
  dias,
  acao,
  pronto,
}: {
  jogadores: TeamDashboardRow[];
  comparacao: PeriodComparison | null;
  /** Diferença do score médio contra 7 dias atrás (null = sem histórico). */
  tendenciaScore: number | null;
  dias: number;
  acao?: React.ReactNode;
  pronto: boolean;
}) {
  const treinos = jogadores.reduce((a, j) => a + j.treinos, 0);
  const acertos = jogadores.reduce((a, j) => a + j.acertosGto, 0);
  const revisadas = jogadores.reduce((a, j) => a + j.maosRevisadas, 0);
  const jogos = jogadores.reduce((a, j) => a + j.jogosNoTime, 0);
  const lucro = jogadores.reduce((a, j) => a + j.lucroNoTime, 0);
  const scores = jogadores.map(calcularScore);
  const scoreMedio = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.valor, 0) / scores.length) : null;
  const acertoPct = treinos > 0 ? Math.round((acertos / treinos) * 100) : null;
  const acertoAnterior =
    comparacao && comparacao.treinosAnterior > 0 ? Math.round((comparacao.acertosAnterior / comparacao.treinosAnterior) * 100) : null;
  const periodo = `${dias}d`;

  const blocos: Bloco[] = [
    {
      rotulo: "Resultado no time",
      icone: Wallet,
      valor: lucro,
      formatar: (n) => BRL.format(n),
      cor: lucro > 0 ? COR_POSITIVO : lucro < 0 ? COR_NEGATIVO : undefined,
      detalhe: `${int(jogos)} jogo${jogos === 1 ? "" : "s"}`,
      explicacao: {
        titulo: "Resultado no time",
        oQueE: "Lucro somado de todos os jogadores desde a entrada de cada um no time.",
        origem: "Gestão de Banca dos jogadores",
        comoCalcula: "Soma do resultado das sessões registradas depois da data de entrada de cada jogador.",
      },
    },
    {
      rotulo: "Treinos",
      icone: Crosshair,
      valor: treinos,
      formatar: int,
      variacao: textoVariacao(variacao(comparacao?.treinosAtual, comparacao?.treinosAnterior), "%", periodo),
      detalhe: `nos últimos ${dias} dias`,
      explicacao: {
        titulo: "Treinos no período",
        oQueE: "Quantos exercícios do Modo Treino o time fez no período escolhido.",
        origem: "Modo Treino",
        comoCalcula: "Soma dos treinos de todos os jogadores no período, comparada com o período anterior de mesmo tamanho.",
      },
    },
    {
      rotulo: "Acerto GTO",
      icone: Gauge,
      valor: acertoPct,
      formatar: int,
      sufixo: "%",
      variacao: textoVariacao(acertoPct != null && acertoAnterior != null ? acertoPct - acertoAnterior : null, "pp", periodo),
      detalhe: acertoPct == null ? "sem treinos" : `${int(acertos)} de ${int(treinos)} treinos`,
      explicacao: {
        titulo: "Acerto GTO",
        oQueE: "Nos treinos do período, em quantos o jogador escolheu a jogada recomendada.",
        origem: "Modo Treino",
        comoCalcula: "Acertos ÷ treinos de todos os jogadores no período.",
      },
    },
    {
      rotulo: "Mãos revisadas",
      icone: BookOpenCheck,
      valor: revisadas,
      formatar: int,
      variacao: textoVariacao(variacao(comparacao?.revisadasAtual, comparacao?.revisadasAnterior), "%", periodo),
      detalhe: `nos últimos ${dias} dias`,
      explicacao: {
        titulo: "Mãos revisadas",
        oQueE: "Quantas mãos os jogadores revisaram no Revisor no período.",
        origem: "Revisor de Mãos",
        comoCalcula: "Soma das revisões de todos os jogadores no período, comparada com o período anterior.",
      },
    },
    {
      rotulo: "Score médio",
      icone: Trophy,
      valor: scoreMedio,
      formatar: int,
      sufixo: "/100",
      variacao:
        tendenciaScore == null ? null : tendenciaScore === 0 ? "estável em 7 dias" : `${tendenciaScore > 0 ? "↑" : "↓"} ${Math.abs(tendenciaScore)} pts em 7 dias`,
      detalhe: `${jogadores.length} jogador${jogadores.length === 1 ? "" : "es"}`,
      explicacao: {
        titulo: "Score de evolução do time",
        oQueE: "Média do score de evolução dos jogadores (0 a 100): atividade recente, acerto nos treinos, sequência de dias e volume de estudo.",
        origem: "Time · Score de evolução",
        comoCalcula: "Média simples do score de cada jogador. A variação compara com a média de 7 dias atrás.",
      },
    },
  ];

  return (
    <PainelCard titulo="Resumo do time" icone={<Trophy size={15} />} acao={acao}>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {blocos.map((b, i) => {
          const Icone = b.icone;
          return (
            <motion.li
              key={b.rotulo}
              className={`min-w-0 ${i === 0 ? "col-span-2 sm:col-span-1" : ""}`}
              initial={{ opacity: 0, y: 8 }}
              animate={pronto ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.45, ease: EASE, delay: 0.1 + i * 0.06 }}
            >
              <InfoHover explicacao={b.explicacao} className="h-full">
                <Linha className="flex h-full min-h-[128px] flex-col !p-3">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[12px] leading-tight text-muted/80">{b.rotulo}</span>
                    <Icone size={15} className="shrink-0 text-muted" aria-hidden />
                  </span>
                  <span className="flex flex-1 flex-col items-center justify-center pt-1.5 text-center">
                    <span
                      className="tnum flex max-w-full items-baseline justify-center text-[26px] font-bold leading-none tracking-[-0.02em] sm:text-[28px]"
                      style={{ color: b.cor ?? "#ffffff" }}
                    >
                      {b.valor == null ? "—" : <Numero valor={b.valor} formatar={b.formatar} />}
                      {b.valor != null && b.sufixo && <span className="ml-0.5 text-[0.5em] font-semibold text-muted/70">{b.sufixo}</span>}
                    </span>
                    {b.variacao && <span className="mt-1.5 text-[11px] font-semibold tabular-nums text-ink/85">{b.variacao}</span>}
                    <span className="mt-1 max-w-full truncate text-[11px] text-muted/70">{b.detalhe}</span>
                  </span>
                </Linha>
              </InfoHover>
            </motion.li>
          );
        })}
      </ul>
    </PainelCard>
  );
}

// "Precisa de atenção": os jogadores que mais pedem o olhar do coach
// agora, com o MOTIVO escrito (não só uma cor). Ordem: menor score
// primeiro. Entra quem está com score baixo, parado há 7+ dias ou sem
// treino no período. Clique abre a ficha.
type Motivo = { texto: string; grave: boolean };

function motivos(j: TeamDashboardRow, dias: number): Motivo[] {
  const m: Motivo[] = [];
  const parado = diasSemAtividade(j.lastActivityAt);
  if (parado == null) m.push({ texto: "nunca registrou atividade", grave: true });
  else if (parado >= 7) m.push({ texto: `${parado} dias sem atividade`, grave: parado >= 14 });
  if (j.treinos === 0) m.push({ texto: `nenhum treino em ${dias} dias`, grave: false });
  if ((j.streakDays ?? 0) === 0 && parado != null && parado < 7) m.push({ texto: "sequência zerada", grave: false });
  return m;
}

export function PrecisaAtencao({ jogadores, dias, pronto }: { jogadores: TeamDashboardRow[]; dias: number; pronto: boolean }) {
  const lista = jogadores
    .map((j) => ({ j, score: calcularScore(j), motivos: motivos(j, dias) }))
    .filter((x) => x.score.risco === "alto" || x.motivos.some((m) => m.grave) || x.motivos.length >= 2)
    .sort((a, b) => a.score.valor - b.score.valor);
  const top = lista.slice(0, 3);

  return (
    <PainelCard
      titulo="Precisa de atenção"
      icone={<Siren size={15} />}
      acao={lista.length > 3 ? <span className="text-[11px] text-muted">+{lista.length - 3} na aba Jogadores</span> : undefined}
    >
      {top.length === 0 ? (
        <p className="text-sm text-muted">Ninguém parado nem com score baixo agora. Bom sinal.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {top.map(({ j, motivos: ms }, i) => (
            <motion.li
              key={j.userId}
              initial={{ opacity: 0, x: -8 }}
              animate={pronto ? { opacity: 1, x: 0 } : undefined}
              transition={{ duration: 0.4, ease: EASE, delay: 0.2 + i * 0.07 }}
            >
              <Link
                href={`/time/jogador/${j.userId}`}
                className="painel-bloco group flex items-center gap-3 rounded-2xl border border-white/5 p-3 transition hover:border-white/15"
              >
                <AvatarNivel userId={j.userId} avatarId={j.avatarId} avatarUrl={j.avatarUrl} tamanho={42} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{j.nome}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {ms.length === 0 ? (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-muted">score baixo</span>
                    ) : (
                      ms.map((m) => (
                        <span
                          key={m.texto}
                          className={`rounded-full px-2 py-0.5 text-[10.5px] ${m.grave ? "bg-[#e0555a]/12 text-[#f08a8e]" : "bg-white/[0.06] text-muted"}`}
                        >
                          {m.texto}
                        </span>
                      ))
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[#d4af37] opacity-80 transition-opacity group-hover:opacity-100">
                  <span className="hidden sm:inline">Abrir ficha</span>
                  <ArrowRight size={13} />
                </span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </PainelCard>
  );
}
