"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Plus, Clock, Flame, Target, BookOpen, CalendarDays, Check, X, Video, Dumbbell, UserRound, Route, ShieldCheck, SunMoon } from "lucide-react";
import { motion } from "framer-motion";
import { PainelVisual } from "@/components/dashboard/kit";
import { EASE } from "@/components/painel/painel-card";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { PainelCard } from "@/components/time/painel-card";
import { Chip } from "@/components/chip";
import { AppShell } from "@/components/app-shell";
import { ACCENT } from "@/lib/modules-data";
import { TeamBanner } from "@/components/time/team-banner";
import { fetchDrillFacets } from "@/lib/services/drill-service";
import {
  createTeam,
  fetchMeuPerfilVisivelTime,
  fetchMyMembership,
  fetchMyPlan,
  fetchMyTeam,
  planoPermiteCriarTime,
  setPerfilVisivelTime,
  traduzErroTime,
  type MyMembership,
  type MyTeam,
} from "@/lib/services/team-service";
import {
  fetchTeamEvents,
  updateMyParticipantStatus,
  traduzErroCalendario,
  type TeamEvent,
} from "@/lib/services/team-calendar-service";
import {
  fetchPlayerCards,
  fetchWorstThreeBetPosition,
  STAT_METRIC_LABEL,
  type PlayerCard,
} from "@/lib/services/team-funnel-service";

// Porta de entrada do modulo. Nao e' uma tela de conteudo: decide para
// onde o usuario vai e sai da frente.
//   admin/coach ativo -> vai direto pro painel (sem clique extra);
//   jogador ativo     -> visao simples do proprio vinculo;
//   pendente          -> aguardando aprovacao;
//   sem time          -> criar (se tiver plano) ou explicacao.

export default function TimePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [data, setData] = useState<MyTeam | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const m = await fetchMyMembership();
      setMembership(m);

      // Quem gerencia entra direto no painel — o modulo "Meu Time" e' o
      // painel, nao uma tela intermediaria de membros.
      if (m?.status === "ativo" && (m.role === "admin" || m.role === "coach")) {
        router.replace("/time/painel");
        return;
      }

      if (m?.status === "ativo") {
        setData(await fetchMyTeam());
      } else if (!m) {
        setPlan(await fetchMyPlan());
      }
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <AppShell>
      {/* Mesmo visual do painel do time e da Performance (vidro, brilho
          suave de fundo) -- vale pra todas as telas daqui (aluno,
          aguardando aprovação, criar time). */}
      <PainelVisual value="vidro">
      <main className="perf w-full px-4 pb-12 pt-6 text-ink md:px-6">
        <PerfEstilos />
        {erro && (
          <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
        )}

        {loading ? (
          <div className="grid max-w-5xl gap-3.5">
            <div className="painel-esqueleto h-[180px] rounded-3xl" />
            <div className="grid gap-3.5 md:grid-cols-2">
              <div className="painel-esqueleto h-[220px] rounded-3xl" />
              <div className="painel-esqueleto h-[220px] rounded-3xl" />
            </div>
          </div>
        ) : membership?.status === "pendente" ? (
          <AguardandoAprovacao membership={membership} />
        ) : data ? (
          <VisaoJogador data={data} />
        ) : planoPermiteCriarTime(plan) ? (
          <CriarTimeCard onCriado={carregar} onErro={setErro} />
        ) : (
          <SemPlanoCard />
        )}
      </main>
      </PainelVisual>
    </AppShell>
  );
}

// ------------------------------------------------------------
function AguardandoAprovacao({ membership }: { membership: MyMembership }) {
  return (
    <section className="painel-vidro max-w-xl rounded-3xl border border-evolution/40 p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-evolution/15 text-evolution">
          <Clock size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold">Pedido enviado para {membership.teamName}</h2>
          <p className="mt-1 text-sm text-muted">
            Um administrador do time precisa aprovar sua entrada. Você recebe uma notificação assim que isso acontecer —
            até lá, nenhum dado seu é compartilhado com o time.
          </p>
        </div>
      </div>
    </section>
  );
}

// Jogador nao gerencia nada: ve o vinculo, o coach, a meta do funil e
// os eventos. Mesmo visual do painel do coach (vidro), em duas colunas no
// computador: o que fazer agora (meta + eventos) à esquerda, o vínculo e
// o que o time enxerga à direita.
function VisaoJogador({ data }: { data: MyTeam }) {
  const eu = data.members.find((m) => m.isMe);
  const meuCoach = data.members.find((m) => m.userId === eu?.coachId);
  const coaches = data.members.filter((m) => m.isCoach);
  // Rotina de treino visível ao coach (LGPD): null = ainda não escolheu
  // (fica oculta e mostramos o aviso); undefined = banco ainda sem a
  // coluna, então nem aviso nem chave aparecem.
  const [rotinaVisivel, setRotinaVisivel] = useState<boolean | null | undefined>(undefined);
  const [salvandoRotina, setSalvandoRotina] = useState(false);

  useEffect(() => {
    fetchMeuPerfilVisivelTime()
      .then(setRotinaVisivel)
      .catch(() => setRotinaVisivel(undefined));
  }, []);

  async function escolherRotina(v: boolean) {
    setSalvandoRotina(true);
    try {
      await setPerfilVisivelTime(v);
      setRotinaVisivel(v);
    } catch {
      // Mantém a escolha anterior na tela se não salvou.
    } finally {
      setSalvandoRotina(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-3.5">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <TeamBanner
          name={data.team.name}
          accent={data.team.accent}
          logoUrl={data.team.logoUrl}
          bannerUrl={data.team.bannerUrl}
        />
      </motion.div>

      {rotinaVisivel === null && <AvisoRotina salvando={salvandoRotina} onEscolher={escolherRotina} />}

      <div className="grid gap-3.5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3.5">
          <MetaDoFunil />
          <EventosDoJogador />
        </div>

        <div className="space-y-3.5">
          <PainelCard titulo="Seu vínculo" icone={<UserRound size={15} />}>
            <dl className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Entrou em</dt>
                <dd className="font-semibold tabular-nums">{eu ? new Date(eu.joinedAt).toLocaleDateString("pt-BR") : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Seu coach</dt>
                <dd className="font-semibold">{meuCoach?.name ?? "ainda sem coach"}</dd>
              </div>
              {coaches.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                  <dt className="text-muted">Coach{coaches.length > 1 ? "es" : ""} do time</dt>
                  <dd className="flex flex-wrap justify-end gap-1">
                    {coaches.map((c) => (
                      <Chip key={c.userId} color={data.team.accent} size="sm">{c.name}</Chip>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </PainelCard>

          <PainelCard titulo="O que o time enxerga" icone={<ShieldCheck size={15} />}>
            <ul className="space-y-2.5 text-[13px] text-muted">
              <li className="flex gap-2.5"><Target size={15} className="mt-0.5 shrink-0 text-training" />
                Sua frequência de estudo, treinos e evolução de nível.</li>
              <li className="flex gap-2.5"><BookOpen size={15} className="mt-0.5 shrink-0 text-review" />
                As mãos que <strong className="text-ink/85">você escolher</strong> compartilhar com seu coach — nenhuma outra.</li>
              <li className="flex gap-2.5"><Flame size={15} className="mt-0.5 shrink-0 text-evolution" />
                Volume de jogos e o resultado total (ganhos menos buy-ins), contados a partir da sua entrada no time — nunca a sua banca pessoal.</li>
              {rotinaVisivel !== undefined && (
                <li className="flex gap-2.5"><SunMoon size={15} className="mt-0.5 shrink-0 text-[#d4af37]" />
                  <span>
                    Sua rotina de treino (experiência, turno, horas por dia e dias), se você deixar.
                    <span className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.04] px-3 py-2">
                      <span className="text-[12.5px] text-ink">{rotinaVisivel ? "Visível para o time" : "Privada"}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(rotinaVisivel)}
                        aria-label="Mostrar minha rotina de treino ao time"
                        disabled={salvandoRotina}
                        onClick={() => escolherRotina(!rotinaVisivel)}
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                          rotinaVisivel ? "bg-[#d4af37]" : "bg-white/15"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
                            rotinaVisivel ? "translate-x-[18px]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </span>
                  </span>
                </li>
              )}
            </ul>
            <p className="mt-3 border-t border-white/[0.06] pt-2.5 text-[11.5px] text-muted/80">
              Data de nascimento e contato nunca aparecem para o time.
            </p>
          </PainelCard>
        </div>
      </div>
    </div>
  );
}

// Aviso único pra quem já estava no time antes da rotina de treino
// aparecer na ficha: explica o que é, pra que serve, e pede a escolha.
// Enquanto não escolher, a rotina fica PRIVADA.
function AvisoRotina({ salvando, onEscolher }: { salvando: boolean; onEscolher: (v: boolean) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
      className="painel-vidro flex flex-col gap-3 rounded-3xl border border-[#d4af37]/30 p-4 sm:flex-row sm:items-center sm:p-5"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d4af37]/12 text-[#d4af37] ring-1 ring-[#d4af37]/30">
        <ShieldCheck size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold tracking-tight">Mostrar sua rotina de treino ao coach?</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
          Experiência, turno preferido, horas por dia e dias de treino do seu perfil aparecem na sua ficha, para o
          coach organizar a agenda com você. Nunca data de nascimento nem contato. Você muda isso quando quiser.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={salvando}
          onClick={() => onEscolher(false)}
          className="rounded-xl border border-white/10 px-3.5 py-2 text-[12.5px] font-medium text-muted transition-colors hover:border-white/25 hover:text-ink disabled:opacity-50"
        >
          Deixar privada
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={() => onEscolher(true)}
          className="rounded-xl bg-[#d4af37] px-3.5 py-2 text-[12.5px] font-semibold text-black transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          Mostrar ao coach
        </button>
      </div>
    </motion.div>
  );
}

// So mostra treino direto quando a meta tem correspondencia honesta no
// banco de drills hoje: 3-bet -> action "3-Bet" (spots pos-flop de pote
// de 3-bet). VPIP e PFR sao estatisticas de pre-flop e o banco de
// drills so tem Flop/Turn/River — link inventado seria pior que nenhum.
function MetaDoFunil() {
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [piorPosicao, setPiorPosicao] = useState<string | null>(null);
  const [temDrillsTresBet, setTemDrillsTresBet] = useState(false);

  useEffect(() => {
    fetchPlayerCards()
      .then((cards) => setCard(cards[0] ?? null))
      .catch(() => setCard(null));
    fetchWorstThreeBetPosition()
      .then(setPiorPosicao)
      .catch(() => setPiorPosicao(null));
    fetchDrillFacets()
      .then((facets) => setTemDrillsTresBet(facets.some((f) => f.action === "3-Bet" && f.n > 0)))
      .catch(() => setTemDrillsTresBet(false));
  }, []);

  if (!card) return null;

  // "vs Open" nao tem correspondencia clara com PFR/VPIP (sao stats de
  // pre-flop puro, banco de drills so tem pos-flop). "3-Bet" so entra
  // se realmente existir spot solvado — hoje a base e' 100% SRP.
  const temTreino = card.statMetric === "three_bet" && temDrillsTresBet;
  // So passa "pos" quando a posicao vier de dado real do jogador (Revisor)
  // e for uma das posicoes que os spots realmente cobrem.
  const posValida = piorPosicao && ["UTG", "CO", "BTN", "SB"].includes(piorPosicao) ? piorPosicao : null;
  const linkTreino = posValida ? `/treino?action=3-Bet&pos=${posValida}` : "/treino?action=3-Bet";

  // Metas que o PRÓPRIO coach definiu na fase do funil (não é faixa
  // inventada): treinos e revisões desde que o jogador entrou na fase.
  const metas = [
    { rotulo: "Treinos", feito: card.drillsDone, alvo: card.drillsTarget, href: "/treino" },
    { rotulo: "Mãos revisadas", feito: card.reviewsDone, alvo: card.reviewsTarget, href: "/revisor" },
  ].filter((m) => m.alvo > 0);

  return (
    <PainelCard
      titulo="Sua fase no time"
      icone={<Route size={15} />}
      acao={
        <span
          className="rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold"
          style={{ color: card.phaseColor, borderColor: `${card.phaseColor}66`, background: `${card.phaseColor}14` }}
        >
          {card.phaseName}
        </span>
      }
    >
      <p className="text-[12px] text-muted">
        Desde {new Date(card.movedAt).toLocaleDateString("pt-BR")} nesta fase. Metas definidas pelo seu coach:
      </p>

      {metas.length > 0 && (
        <ul className="mt-3 space-y-3">
          {metas.map((m, i) => {
            const pct = Math.min(100, Math.round((m.feito / m.alvo) * 100));
            const pronto = m.feito >= m.alvo;
            return (
              <li key={m.rotulo}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <Link href={m.href} className="text-[13px] font-medium text-ink hover:underline">{m.rotulo}</Link>
                  <span className="text-[12px] tabular-nums text-muted">
                    <b className="text-[15px] font-bold text-ink">{m.feito}</b> de {m.alvo}
                    {pronto && <span className="ml-1.5 text-positive">✓ meta batida</span>}
                  </span>
                </div>
                <span className="block h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: pronto ? "#22c55e" : "#d4af37" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.1 }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {card.statMetric && (
        <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <Target size={13} /> Meta de jogo do seu coach
          </p>
          <p className="mt-1 text-[13px]">
            {STAT_METRIC_LABEL[card.statMetric]} atual: <strong className="text-[15px] text-ink">{card.statValue ?? "—"}%</strong>
            {card.statTarget != null && <span className="text-muted"> · meta: {card.statTarget}%</span>}
          </p>
          {temTreino ? (
            <Link href={linkTreino}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-[#e2c35a] active:scale-[0.98]">
              <Dumbbell size={15} />
              {posValida ? `Treinar 3-bet (${posValida})` : "Treinar 3-bet"}
            </Link>
          ) : (
            <p className="mt-2 text-xs text-muted">Ainda não há drills específicos pra esse número na base atual — foco em revisar suas mãos por enquanto.</p>
          )}
        </div>
      )}
    </PainelCard>
  );
}

const TIPO_LABEL: Record<string, string> = { aula: "Aula", reuniao: "Reunião", outro: "Outro" };

// Eventos onde o jogador foi convidado. RLS ja devolve so a linha de
// participante do proprio usuario (nao ve status de outros jogadores) —
// por isso "meuStatus" e' sempre o primeiro item de participants.
function EventosDoJogador() {
  const [eventos, setEventos] = useState<TeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [destaqueId, setDestaqueId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const ev = await fetchTeamEvents();
      setEventos(ev.filter((e) => e.participants.length > 0));
    } catch (e) {
      setErro(traduzErroCalendario(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const params = new URLSearchParams(window.location.search);
    setDestaqueId(params.get("eventId"));
  }, [carregar]);

  async function responder(eventId: string, status: "confirmado" | "recusado") {
    setProcessando(eventId);
    try {
      await updateMyParticipantStatus(eventId, status);
      await carregar();
    } catch (e) {
      setErro(traduzErroCalendario(e));
    } finally {
      setProcessando(null);
    }
  }

  if (loading || eventos.length === 0) return null;

  return (
    <PainelCard titulo="Próximos eventos" icone={<CalendarDays size={15} />}>
      {erro && <p className="mt-2 text-xs text-negative">{erro}</p>}

      <ul className="divide-y divide-white/[0.06]">
        {eventos.map((ev) => {
          const meuStatus = ev.participants[0]?.status ?? "pendente";
          const destacado = ev.id === destaqueId;
          return (
            <li key={ev.id} className={`py-3 ${destacado ? "rounded-xl bg-[#d4af37]/[0.06] px-2" : ""}`}>
              <p className="text-sm font-medium">{TIPO_LABEL[ev.eventType] ?? ev.eventType} · {ev.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <Clock size={12} />
                {new Date(ev.startsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {ev.locationUrl && (
                  <>
                    <span className="text-hairline">·</span>
                    <a href={ev.locationUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-ink/80 hover:underline">
                      <Video size={12} /> link
                    </a>
                  </>
                )}
              </p>

              {meuStatus === "pendente" ? (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => responder(ev.id, "confirmado")} disabled={processando === ev.id}
                    className="flex items-center gap-1.5 rounded-lg bg-[#d4af37] px-3 py-1.5 text-[12px] font-semibold text-black transition hover:bg-[#e2c35a] active:scale-[0.98] disabled:opacity-50">
                    <Check size={13} /> Confirmar presença
                  </button>
                  <button onClick={() => responder(ev.id, "recusado")} disabled={processando === ev.id}
                    className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-negative/50 hover:text-negative disabled:opacity-50">
                    <X size={13} /> Não vou
                  </button>
                </div>
              ) : (
                <span className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] ${
                  meuStatus === "confirmado" ? "border-positive/40 text-positive" : "border-negative/40 text-negative"
                }`}>
                  {meuStatus === "confirmado" ? "Presença confirmada" : "Você recusou"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </PainelCard>
  );
}

function SemPlanoCard() {
  return (
    <section className="painel-vidro max-w-xl rounded-3xl border border-white/10 p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
          <Lock size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold">Criar um time exige o plano Team</h2>
          <p className="mt-1 text-sm text-muted">
            A Licença Team é um produto próprio, para organizações que querem gerenciar jogadores e coaches dentro do
            PokerSync. Se você foi convidado para um time, não precisa dela: basta abrir o link de convite que recebeu.
          </p>
        </div>
      </div>
    </section>
  );
}

function CriarTimeCard({ onCriado, onErro }: { onCriado: () => void; onErro: (s: string) => void }) {
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<"admin" | "coach">("admin");
  const [cor, setCor] = useState(ACCENT.blue);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return onErro("Dê um nome ao time.");
    setSalvando(true);
    try {
      await createTeam(nome.trim(), papel, cor);
      onCriado();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="painel-vidro max-w-xl rounded-3xl border border-white/10 p-6">
      <h2 className="text-base font-semibold">Criar seu time</h2>
      <p className="mt-1 text-sm text-muted">Depois você convida coaches e jogadores por link.</p>

      <div className="mt-5 space-y-5">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Nome do time</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40}
            placeholder="Ex.: Curitiba Poker Team"
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-ink/40" />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Sua função no time</label>
          <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
            {(["admin", "coach"] as const).map((r) => (
              <button key={r} onClick={() => setPapel(r)}
                className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                  papel === r ? "bg-ink text-void" : "text-muted hover:text-ink"
                }`}>
                {r === "admin" ? "Administrador" : "Coach"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Administrador gerencia membros, convites e aprovações, mas não recebe mãos para revisar. Coach acompanha os
            jogadores e revisa as mãos compartilhadas. Depois de criar, o administrador pode acumular as duas funções.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Cor do time</label>
          <div className="flex gap-2">
            {Object.values(ACCENT).map((c) => (
              <button key={c} onClick={() => setCor(c)} aria-label={`Cor ${c}`}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                  cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <button onClick={salvar} disabled={salvando}
          className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50">
          <Plus size={16} strokeWidth={2.5} />
          {salvando ? "Criando…" : "Criar time"}
        </button>
      </div>
    </section>
  );
}
