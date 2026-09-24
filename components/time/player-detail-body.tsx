"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare,
  Eye,
  ChevronRight,
  BookOpen,
  BarChart3,
  UserRound,
  CalendarDays,
  Activity,
  Flame,
  Lock,
  ShieldCheck,
  GraduationCap,
  SunMoon,
  Clock,
  CalendarCheck,
  Wallet,
  Dumbbell,
  Crosshair,
  FileSearch,
  Hexagon,
  LineChart,
  History,
  BellRing,
} from "lucide-react";
import { Chip } from "@/components/chip";
import { AvatarNivel } from "@/components/avatar-nivel";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { EASE } from "@/components/painel/painel-card";
import { ScoreHistoryChart } from "@/components/time/score-history-chart";
import { MetasCard } from "@/components/time/metas-card";
import { Kpi } from "@/components/time/kpi";
import { PentagonoCircuito, type EixoCircuito } from "@/components/time/pentagono-circuito";
import { BRL, variacao } from "@/lib/format";
import {
  DIA_SEMANA_LABEL,
  HORARIO_TREINO_LABEL,
  TEMPO_EXPERIENCIA_LABEL,
  type DiaSemana,
} from "@/lib/services/profile-service";
import {
  ALERTA_LABEL,
  calcularScore,
  calcularTendencia,
  diasSemAtividade,
  type PlayerActivityDay,
  type PlayerEvolutionStats,
  type PlayerScoreHistoryPoint,
  type PlayerTeamHistoryItem,
  type PlayerTeamProfile,
  type TeamAlert,
  type TeamRole,
  type PlayerDetail,
  type PlayerSharedHand,
} from "@/lib/services/team-service";

type Aba = "estatisticas" | "estudo";

const TABS: { value: Aba; label: string; icon: typeof BookOpen }[] = [
  { value: "estatisticas", label: "Estatísticas", icon: BarChart3 },
  { value: "estudo", label: "Estudo", icon: BookOpen },
];

const DIAS: DiaSemana[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

const PAPEL: Record<TeamRole, string> = { admin: "Administrador", coach: "Coach", player: "Jogador" };

// Ficha do jogador no formato de perfil (tipo LinkedIn), em duas metades:
// 1) QUEM é -- capa (banner que o jogador escolhe no menu de perfil),
//    foto com o anel do score, coach, desde quando está no time, rotina
//    de treino (se liberou) e os times por onde passou no PokerSync;
// 2) COMO está indo -- resultado no time, estudo, o perfil de jogo em
//    pentágono, a tendência do score e as estatísticas detalhadas.
// Reusada na página cheia (/time/jogador/[id]) e no modal da aba Jogadores.
//
// LGPD/privacidade:
// - dinheiro: só o resultado agregado no time ATUAL (ganhos - buy-ins),
//   nunca o detalhamento diário, staking nem resultado de times antigos;
// - rotina de treino: só se o jogador liberou (o banco já devolve vazio);
// - histórico de times: só time, função e período;
// - data de nascimento e contato nunca entram aqui.
export function PlayerDetailBody({
  id,
  p,
  perfil,
  historico = [],
  atividade,
  maos,
  alertas,
  historicoScore,
  evolutionStats,
  podeGerenciarMetas,
  emModal = false,
  hrefMaoCompartilhada = (reviewId) => `/revisor?shared=${reviewId}`,
}: {
  id: string;
  p: PlayerDetail;
  /** null = banco ainda sem a função de perfil: o bloco de rotina some. */
  perfil: PlayerTeamProfile | null;
  historico?: PlayerTeamHistoryItem[];
  atividade: PlayerActivityDay[];
  maos: PlayerSharedHand[];
  alertas: TeamAlert[];
  historicoScore: PlayerScoreHistoryPoint[];
  evolutionStats: PlayerEvolutionStats | null;
  podeGerenciarMetas: boolean;
  /** Dentro do modal as abas não usam atalho de teclado (1, 2), pra não
   *  trocar junto as abas do painel que fica por trás. */
  emModal?: boolean;
  hrefMaoCompartilhada?: (reviewId: string) => string;
}) {
  const [aba, setAba] = useState<Aba>("estatisticas");

  const acertoPct = p.treinos === 0 ? null : Math.round((p.acertosGto / p.treinos) * 100);
  const varTreinos = variacao(p.treinos, p.treinosPeriodoAnterior);
  const acertoAnteriorPct =
    p.treinosPeriodoAnterior > 0 ? Math.round((100 * (p.acertosGtoPeriodoAnterior ?? 0)) / p.treinosPeriodoAnterior) : null;
  const varAcerto = acertoPct !== null && acertoAnteriorPct !== null ? acertoPct - acertoAnteriorPct : null;

  return (
    <div className="space-y-4">
      <CapaJogador p={p} perfil={perfil} historicoScore={historicoScore} />

      {(perfil || historico.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {perfil && <RotinaTreino perfil={perfil} />}
          <HistoricoTimes historico={historico} />
        </div>
      )}

      <Secao>Informações técnicas</Secao>

      {/* "Resultado no time" é o ÚNICO número de dinheiro da ficha (ver
          LGPD acima). Acerto GTO fica neutro: não existe uma faixa
          validada do que é "bom" aqui, então não pinta de verde/vermelho. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 sm:col-span-1 [&>div]:h-full">
          <Kpi
            icon={Wallet}
            label="Resultado no time"
            value={p.jogosNoTime > 0 ? BRL.format(p.lucroNoTime) : "—"}
            tom={p.jogosNoTime > 0 && p.lucroNoTime > 0 ? "positivo" : p.jogosNoTime > 0 && p.lucroNoTime < 0 ? "negativo" : undefined}
            hint={`${p.jogosNoTime} jogo${p.jogosNoTime === 1 ? "" : "s"} desde que entrou`}
            destaque
          />
        </div>
        <Kpi icon={Dumbbell} label="Treinos" value={String(p.treinos)} hint={`${p.xpPeriodo} XP no período`} tendencia={varTreinos} />
        <Kpi
          icon={Crosshair}
          label="Acerto GTO"
          value={acertoPct === null ? "—" : `${acertoPct}%`}
          hint={p.errosGraves > 0 ? `${p.errosGraves} erro${p.errosGraves === 1 ? "" : "s"} grave${p.errosGraves === 1 ? "" : "s"}` : undefined}
          tendencia={varAcerto}
          tendenciaSufixo="pp"
        />
        <Kpi
          icon={FileSearch}
          label="Mãos revisadas"
          value={String(p.maosRevisadas)}
          hint={p.maosPendentes > 0 ? `${p.maosPendentes} na fila` : "fila zerada"}
        />
        <Kpi
          icon={Flame}
          label="Ofensiva"
          value={p.streakDays ? `${p.streakDays}d` : "—"}
          hint={p.streakBest ? `recorde ${p.streakBest}d` : "dias seguidos com atividade"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Cartao titulo="Perfil de jogo" icone={<Hexagon size={15} />} ordem={1} extra={evolutionStats && evolutionStats.hands > 0 ? <Amostra n={evolutionStats.hands} /> : undefined}>
          <PentagonoCircuito eixos={eixosDoPerfil(evolutionStats)} amostra={evolutionStats?.hands ?? 0} />
          <p className="mt-2 text-center text-[11px] text-muted/70">
            Cada ponta tem a própria escala. Passe o mouse no número para ver o que ele mede.
          </p>
        </Cartao>
        <Cartao titulo="Score de evolução" icone={<LineChart size={15} />} ordem={2}>
          <p className="-mt-1 mb-3 text-[12.5px] text-muted">Atividade, acerto GTO, consistência e progresso num número só, dia a dia.</p>
          <ResumoScore historicoScore={historicoScore} atual={calcularScore(p).valor} />
          <ScoreHistoryChart dados={historicoScore} />
          {alertas.length > 0 && (
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                <BellRing size={13} /> Alertas recentes
              </p>
              <ul className="space-y-1.5">
                {alertas.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                    <Chip color={a.kind === "lembrete_estudo" ? "#8b8b8b" : "#F59E0B"} size="sm">
                      {ALERTA_LABEL[a.kind]}
                    </Chip>
                    <span className="min-w-0 flex-1 text-ink/85">{a.detail}</span>
                    <span className="text-[11px] text-muted">{new Date(a.createdAt).toLocaleDateString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Cartao>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
        className="painel-vidro rounded-3xl border border-white/10 p-4 sm:p-5 print:border-0 print:bg-transparent print:p-0"
      >
        <div className="print:hidden">
          <AbasAnimadas value={aba} onChange={setAba} options={TABS} rotulo="Seções da ficha" atalhos={!emModal} />
        </div>
        <div className="mt-4">
          {aba === "estatisticas" && <AbaEstatisticas stats={evolutionStats} />}
          {aba === "estudo" && (
            <AbaEstudo id={id} atividade={atividade} maos={maos} podeGerenciarMetas={podeGerenciarMetas} hrefMaoCompartilhada={hrefMaoCompartilhada} />
          )}
        </div>
      </motion.section>
    </div>
  );
}

function Secao({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted">{children}</h2>
      <span className="h-px flex-1 bg-gradient-to-r from-white/[0.1] to-transparent" />
    </div>
  );
}

function Cartao({
  titulo,
  icone,
  extra,
  ordem = 0,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  extra?: React.ReactNode;
  ordem?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.05 + ordem * 0.06 }}
      className="painel-vidro relative overflow-hidden rounded-3xl border border-white/10 p-4 sm:p-5"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-[#d4af37]">{icone}</span>
          {titulo}
        </h3>
        {extra}
      </header>
      {children}
    </motion.section>
  );
}

// Três números acima do gráfico: onde está, onde começou o período e
// quanto mudou -- a leitura que o coach faz do gráfico, já pronta.
function ResumoScore({ historicoScore, atual }: { historicoScore: PlayerScoreHistoryPoint[]; atual: number }) {
  const inicio = historicoScore.length > 1 ? historicoScore[0].score : null;
  const delta = inicio == null ? null : atual - inicio;
  const itens = [
    { rotulo: "Hoje", valor: String(atual), cor: corDoScore(atual) },
    { rotulo: "Início", valor: inicio == null ? "—" : String(inicio), cor: undefined },
    {
      rotulo: "Variação",
      valor: delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}`,
      cor: delta == null || delta === 0 ? undefined : delta > 0 ? "#22c55e" : "#e0555a",
    },
  ];
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      {itens.map((i) => (
        <div key={i.rotulo} className="painel-bloco rounded-2xl border border-white/5 px-3 py-2">
          <p className="truncate text-[11px] text-muted">{i.rotulo}</p>
          <p className="text-[18px] font-bold tabular-nums" style={{ color: i.cor }}>
            {i.valor}
          </p>
        </div>
      ))}
    </div>
  );
}

function Amostra({ n }: { n: number }) {
  return (
    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] tabular-nums text-muted">
      {n.toLocaleString("pt-BR")} mão{n === 1 ? "" : "s"}
    </span>
  );
}

// As 5 pontas do pentágono: 3 de pré-flop e 2 de pós-flop, as mais usadas
// pra descrever o estilo de um jogador. Tetos = escala de cada ponta.
function eixosDoPerfil(s: PlayerEvolutionStats | null): EixoCircuito[] {
  return [
    {
      chave: "vpip",
      curto: "VPIP",
      titulo: "Entra no pote (VPIP)",
      oQueE: "Em quantas mãos coloca dinheiro por vontade própria antes do flop. Mais alto = jogo mais solto.",
      comoCalcula: "Mãos com call ou raise voluntário ÷ mãos jogadas.",
      teto: 50,
      valor: s?.vpipPct ?? null,
    },
    {
      chave: "pfr",
      curto: "PFR",
      titulo: "Aumenta antes do flop (PFR)",
      oQueE: "Em quantas mãos entra aumentando. Perto do VPIP = joga agressivo; longe = paga muito.",
      comoCalcula: "Mãos com raise antes do flop ÷ mãos jogadas.",
      teto: 40,
      valor: s?.pfrPct ?? null,
    },
    {
      chave: "3bet",
      curto: "3-Bet",
      titulo: "3-Bet",
      oQueE: "Das vezes em que alguém abriu o pote antes dele, quantas re-aumentou.",
      comoCalcula: "Re-aumentos ÷ vezes com exatamente 1 raise na mesa na vez dele.",
      teto: 20,
      valor: s?.threeBetPct ?? null,
    },
    {
      chave: "cbet",
      curto: "C-Bet flop",
      titulo: "C-Bet no flop",
      oQueE: "Quando foi o último a aumentar antes do flop, quantas vezes apostou no flop.",
      comoCalcula: "C-bets ÷ flops vistos como agressor que teve a chance de apostar.",
      teto: 100,
      valor: s?.cbetFlopPct ?? null,
    },
    {
      chave: "wtsd",
      curto: "WTSD",
      titulo: "Vai ao showdown (WTSD)",
      oQueE: "Dos flops que viu, em quantos foi até mostrar as cartas. Alto = paga até o fim com frequência.",
      comoCalcula: "Mãos que chegaram ao showdown ÷ flops vistos.",
      teto: 50,
      valor: s?.wsdPct ?? null,
    },
  ];
}

// Faixas do PRÓPRIO score de evolução (as mesmas do selo de risco e do
// cartão da lista), não uma referência externa de jogo.
function corDoScore(v: number) {
  return v < 40 ? "#e0555a" : v < 70 ? "#f59e0b" : "#22c55e";
}

function mesAno(iso: string): string {
  const s = new Date(iso).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function duracao(de: string, ate: string | null): string {
  const a = new Date(de);
  const b = ate ? new Date(ate) : new Date();
  const meses = Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
  if (meses < 1) return "menos de 1 mês";
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return `${anos} ano${anos === 1 ? "" : "s"}${resto ? ` e ${resto} ${resto === 1 ? "mês" : "meses"}` : ""}`;
}

function textoAtividade(iso: string | null): string {
  const d = diasSemAtividade(iso);
  if (d == null) return "Sem atividade ainda";
  if (d === 0) return "Ativo hoje";
  if (d === 1) return "Ativo ontem";
  return `Última atividade há ${d} dias`;
}

// ------------------------------------------------------------
// Capa: banner + foto com anel do score + identidade.
// ------------------------------------------------------------
function CapaJogador({
  p,
  perfil,
  historicoScore,
}: {
  p: PlayerDetail;
  perfil: PlayerTeamProfile | null;
  historicoScore: PlayerScoreHistoryPoint[];
}) {
  const score = calcularScore(p);
  const tendencia = calcularTendencia(historicoScore);
  const cor = corDoScore(score.valor);
  const parado = diasSemAtividade(p.lastActivityAt);
  const banner = perfil?.bannerUrl ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="painel-vidro relative overflow-hidden rounded-3xl border border-white/10"
    >
      {/* Capa na proporção do banner (5:1, 1500×300) a partir do tablet;
          no celular fica mais baixa e corta as laterais. Sem banner: o
          dourado da marca + o azul/roxo do fundo, com trama de pontos. */}
      <div aria-hidden className="relative h-28 overflow-hidden sm:h-auto sm:aspect-[5/1]">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(30rem 12rem at 10% 0%, rgba(212,175,55,0.45), transparent 70%), radial-gradient(28rem 14rem at 90% 30%, rgba(74,144,217,0.3), transparent 70%), linear-gradient(120deg, rgba(212,175,55,0.16), rgba(168,85,247,0.14))",
              }}
            />
            <div
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage: "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)",
                backgroundSize: "14px 14px",
              }}
            />
          </>
        )}
        {/* Esmaece a base da capa no vidro do card: a foto "sai" dela. */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#111111]/85 to-transparent" />
      </div>

      <div className="relative px-4 pb-5 sm:px-7">
        <div className="-mt-14 flex flex-col items-start gap-x-5 gap-y-2 sm:-mt-16 sm:flex-row sm:items-end">
          {/* Foto com o anel de nível (padrão de toda foto de jogador). O
              score de evolução fica como selo ao lado, só aqui na ficha. */}
          <span className="relative shrink-0 rounded-full bg-[#111111] p-1 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]">
            <AvatarNivel userId={p.userId} avatarId={p.avatarId} avatarUrl={p.avatarUrl} tamanho={120} animar brilho />
          </span>

          <div className="w-full min-w-0 flex-1 pb-1.5">
            <h2 className="flex items-center gap-2 text-[22px] font-bold tracking-tight sm:text-[26px]">
              <span className="truncate">{p.nome}</span>
            </h2>
            <p className="truncate text-[13px] text-muted">
              {perfil?.apelido && <span>@{perfil.apelido} · </span>}
              {PAPEL[p.role] ?? "Jogador"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:mb-2">
            <span
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold tabular-nums"
              style={{ color: cor, borderColor: `${cor}59`, background: `${cor}1a` }}
              title="Score de evolução (0 a 100)"
            >
              Score {score.valor}
              {tendencia !== "estavel" && <span className="text-[10px]">{tendencia === "subiu" ? "▲" : "▼"}</span>}
            </span>
            {(p.streakDays ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-[#f59e0b]/35 bg-[#f59e0b]/10 px-2.5 py-1 text-[12px] font-semibold text-[#f5b544]">
                <Flame size={13} />
                {p.streakDays} dias seguidos
              </span>
            )}
          </div>
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted">
          <li className="flex items-center gap-1.5">
            <UserRound size={13} />
            {p.coachNome ? (
              <>
                Coach <span className="text-ink">{p.coachNome}</span>
              </>
            ) : (
              "Sem coach atribuído"
            )}
          </li>
          <li className="flex items-center gap-1.5">
            <CalendarDays size={13} />
            No time desde <span className="text-ink">{mesAno(p.joinedAt)}</span>
          </li>
          <li className={`flex items-center gap-1.5 ${parado != null && parado >= 7 ? "text-[#f08a8e]" : ""}`}>
            <Activity size={13} />
            {textoAtividade(p.lastActivityAt)}
          </li>
          {p.level != null && (
            <li className="flex items-center gap-1.5">
              <GraduationCap size={13} />
              Nível <span className="text-ink">{p.level}</span>
              {p.xpTotal != null && <span>· {p.xpTotal.toLocaleString("pt-BR")} XP</span>}
            </li>
          )}
        </ul>
      </div>
    </motion.section>
  );
}

function RotinaTreino({ perfil }: { perfil: PlayerTeamProfile }) {
  const dias = new Set(perfil.diasTreinoSemana ?? []);
  const vazio = !perfil.tempoExperiencia && !perfil.horarioTreino && perfil.horasTreinoDia == null && dias.size === 0;

  return (
    <Cartao
      titulo="Rotina de treino"
      icone={<SunMoon size={15} />}
      extra={
        perfil.visivel ? (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <ShieldCheck size={12} className="text-[#22c55e]" />
            <span className="hidden sm:inline">Compartilhado pelo jogador</span>
          </span>
        ) : undefined
      }
    >
      {!perfil.visivel ? (
        <p className="painel-bloco flex items-start gap-2.5 rounded-2xl border border-white/5 p-3 text-[12.5px] text-muted">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>A rotina de treino é privada até o jogador liberar. Ele escolhe isso na tela do Time, em “O que o time enxerga”.</span>
        </p>
      ) : vazio ? (
        <p className="text-[12.5px] text-muted">O jogador liberou, mas ainda não preencheu a rotina no perfil.</p>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-2">
            <InfoRotina icon={GraduationCap} rotulo="Experiência" valor={perfil.tempoExperiencia ? TEMPO_EXPERIENCIA_LABEL[perfil.tempoExperiencia] : "—"} />
            <InfoRotina icon={SunMoon} rotulo="Turno" valor={perfil.horarioTreino ? HORARIO_TREINO_LABEL[perfil.horarioTreino] : "—"} />
            <InfoRotina icon={Clock} rotulo="Horas por dia" valor={perfil.horasTreinoDia == null ? "—" : `${perfil.horasTreinoDia}h`} />
          </div>
          <div className="painel-bloco rounded-2xl border border-white/5 p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <CalendarCheck size={12} />
              Dias de treino {dias.size > 0 && <span>· {dias.size} por semana</span>}
            </p>
            <div className="mt-2 grid grid-cols-7 gap-1">
              {DIAS.map((d) => {
                const ativo = dias.has(d);
                return (
                  <span
                    key={d}
                    className={`rounded-lg py-1.5 text-center text-[11px] font-semibold ${
                      ativo ? "bg-[#d4af37]/15 text-[#e6c763] ring-1 ring-[#d4af37]/40" : "bg-white/[0.03] text-muted/50"
                    }`}
                  >
                    {DIA_SEMANA_LABEL[d]}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Cartao>
  );
}

function InfoRotina({ icon: Icon, rotulo, valor }: { icon: typeof Clock; rotulo: string; valor: string }) {
  return (
    <div className="painel-bloco rounded-2xl border border-white/5 p-2.5 sm:p-3">
      <span className="flex items-center gap-1.5 text-[11px] text-muted">
        <Icon size={12} className="hidden text-[#d4af37] sm:block" />
        {rotulo}
      </span>
      <span className="mt-0.5 block truncate text-[13.5px] font-semibold sm:text-[14.5px]">{valor}</span>
    </div>
  );
}

// ------------------------------------------------------------
// Times no PokerSync: linha do tempo estilo "Experiência" do LinkedIn.
// ------------------------------------------------------------
function HistoricoTimes({ historico }: { historico: PlayerTeamHistoryItem[] }) {
  return (
    <Cartao titulo="Times no PokerSync" icone={<History size={15} />} ordem={1}>
      {historico.length === 0 ? (
        <p className="text-[12.5px] text-muted">A passagem por times começa a ser registrada a partir de agora.</p>
      ) : (
        <ol className="relative space-y-3">
          {historico.length > 1 && <span aria-hidden className="absolute bottom-5 left-[19px] top-5 w-px bg-white/10" />}
          {historico.map((h, i) => {
            const atual = h.leftAt == null;
            const cor = h.teamAccent || "#d4af37";
            return (
              <li key={`${h.teamName}-${h.joinedAt}-${i}`} className="relative flex items-start gap-3">
                <span
                  className="relative z-10 grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl text-[14px] font-bold"
                  style={{ background: `${cor}22`, color: cor, boxShadow: `inset 0 0 0 1px ${cor}55` }}
                >
                  {h.teamLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.teamLogoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    h.teamName.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                    <span className="truncate">{h.teamName}</span>
                    {atual && (
                      <span className="rounded-full bg-[#22c55e]/12 px-2 py-px text-[10.5px] font-semibold text-[#4ade80] ring-1 ring-[#22c55e]/30">
                        atual
                      </span>
                    )}
                  </p>
                  <p className="text-[12.5px] text-ink/80">{PAPEL[h.role] ?? h.role}</p>
                  <p className="text-[11.5px] text-muted">
                    {mesAno(h.joinedAt)} – {atual ? "hoje" : mesAno(h.leftAt!)} · {duracao(h.joinedAt, h.leftAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Cartao>
  );
}

// ------------------------------------------------------------
// Estatísticas: as mesmas contas do Performance, só com as mãos deste
// jogador no período (team_player_evolution_stats). A barra é só a
// porcentagem em si (0 a 100%) -- sem faixa de referência.
// ------------------------------------------------------------
function fmtPct(v: number | null): string {
  return v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function AbaEstatisticas({ stats }: { stats: PlayerEvolutionStats | null }) {
  if (!stats || stats.hands === 0) {
    return (
      <p className="text-sm text-muted">
        Sem mãos importadas no período selecionado — as estatísticas aparecem aqui assim que o jogador importar o histórico de mãos.
      </p>
    );
  }

  const grupos: { titulo: string; cor: string; linhas: { label: string; valor: number | null; hint: string; numero?: string }[] }[] = [
    {
      titulo: "Antes do flop",
      cor: "#d4af37",
      linhas: [
        { label: "VPIP", valor: stats.vpipPct, hint: "entra no pote por vontade própria" },
        { label: "PFR", valor: stats.pfrPct, hint: "entra aumentando" },
        { label: "3-Bet", valor: stats.threeBetPct, hint: "re-aumenta quando tem a chance" },
        { label: "Fold to 3-Bet", valor: stats.foldTo3betPct, hint: "desiste quando recebe re-aumento" },
      ],
    },
    {
      titulo: "Depois do flop",
      cor: "#4a90d9",
      linhas: [
        { label: "C-Bet flop", valor: stats.cbetFlopPct, hint: "aposta no flop depois de agredir antes" },
        { label: "Fold to C-Bet", valor: stats.foldToCbetFlopPct, hint: "desiste contra essa aposta" },
        { label: "AFq", valor: stats.aggressionFrequencyPct, hint: "ações agressivas no total" },
        { label: "WTSD", valor: stats.wsdPct, hint: "dos flops vistos, vai até o showdown" },
        { label: "W$SD", valor: stats.wsdWonPct, hint: "ganha quando chega ao showdown" },
      ],
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-muted">Mesmas contas da tela Performance, só com as mãos deste jogador.</p>
        <div className="flex items-center gap-2">
          {stats.aggressionFactor !== null && (
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11.5px] text-muted" title="Apostas e aumentos para cada pagamento depois do flop">
              AF <strong className="tabular-nums text-ink">{stats.aggressionFactor.toFixed(2)}</strong>
            </span>
          )}
          <Amostra n={stats.hands} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {grupos.map((g, gi) => (
          <div key={g.titulo} className="painel-bloco rounded-2xl border border-white/5 p-4">
            <h3 className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">
              <span className="size-1.5 rounded-full" style={{ background: g.cor, boxShadow: `0 0 8px ${g.cor}` }} />
              {g.titulo}
            </h3>
            <ul className="mt-3 space-y-3.5">
              {g.linhas.map((l, li) => (
                <li key={l.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="text-[13px] font-semibold text-ink">{l.label}</span>
                      <span className="block text-[11.5px] text-muted sm:ml-2 sm:inline">{l.hint}</span>
                    </span>
                    <span className="shrink-0 text-[15px] font-bold tabular-nums">{fmtPct(l.valor)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${g.cor}55, ${g.cor})`, boxShadow: `0 0 10px ${g.cor}55` }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, l.valor ?? 0))}%` }}
                      transition={{ duration: 0.8, ease: EASE, delay: 0.1 + gi * 0.15 + li * 0.05 }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Estudo: frequência (treino/revisão), metas definidas pelo coach e as
// mãos que o jogador compartilhou -- tudo que é rotina de aprendizado.
// ------------------------------------------------------------
function AbaEstudo({
  id,
  atividade,
  maos,
  podeGerenciarMetas,
  hrefMaoCompartilhada,
}: {
  id: string;
  atividade: PlayerActivityDay[];
  maos: PlayerSharedHand[];
  podeGerenciarMetas: boolean;
  hrefMaoCompartilhada: (reviewId: string) => string;
}) {
  const maxDia = Math.max(1, ...atividade.map((d) => d.treinos + d.revisoes));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Frequência de estudo</h2>
        <p className="mt-1 text-sm text-muted">Treinos e revisões concluídas por dia.</p>

        <div className="mt-4 flex h-28 items-end gap-[3px]">
          {atividade.map((d) => {
            const total = d.treinos + d.revisoes;
            const alturaTreino = (d.treinos / maxDia) * 100;
            const alturaRevisao = (d.revisoes / maxDia) * 100;
            return (
              <div
                key={d.dia}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                title={`${new Date(d.dia).toLocaleDateString("pt-BR")}: ${d.treinos} treino(s), ${d.revisoes} revisão(ões)`}
              >
                {total === 0 ? (
                  <div className="h-[2px] w-full rounded-sm bg-white/10" />
                ) : (
                  <>
                    <div className="w-full rounded-t-sm bg-review" style={{ height: `${alturaRevisao}%` }} />
                    <div className="w-full rounded-b-sm bg-training" style={{ height: `${alturaTreino}%` }} />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-training" /> Treinos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-review" /> Revisões
          </span>
        </div>
      </div>

      <div className="border-t border-white/[0.06] pt-5">
        <MetasCard playerId={id} podeGerenciar={podeGerenciarMetas} />
      </div>

      <div className="border-t border-white/[0.06] pt-5">
        <h2 className="text-base font-semibold">Mãos enviadas para você</h2>
        {maos.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhuma mão compartilhada até agora.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {maos.map((m) => (
              <li key={m.shareId}>
                <Link href={hrefMaoCompartilhada(m.reviewId)} className="flex items-center gap-3 py-3 transition-colors hover:text-ink">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.titulo}</p>
                    <p className="text-xs text-muted">
                      {new Date(m.compartilhadaEm).toLocaleDateString("pt-BR")}
                      {m.comentarios > 0 && ` · ${m.comentarios} comentário(s)`}
                    </p>
                  </div>
                  {!m.vistaEm ? (
                    <span className="rounded-full bg-evolution px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void">
                      Nova
                    </span>
                  ) : m.comentarios === 0 ? (
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <Eye size={12} /> vista
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-training">
                      <MessageSquare size={12} /> respondida
                    </span>
                  )}
                  <ChevronRight size={15} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

