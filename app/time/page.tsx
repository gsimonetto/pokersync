"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Plus, Clock, Flame, Target, BookOpen, CalendarDays, Check, X, Video, Dumbbell } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { Chip } from "@/components/chip";
import { ACCENT } from "@/lib/modules-data";
import { TeamBanner } from "@/components/time/team-banner";
import { fetchDrillFacets } from "@/lib/services/drill-service";
import {
  createTeam,
  fetchMyMembership,
  fetchMyPlan,
  fetchMyTeam,
  planoPermiteCriarTime,
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
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      {/* Quando o time carregou, o banner (dentro de VisaoJogador) vira o
          header — leva o voltar embutido, sem repetir nome/subtitulo. */}
      {!data && <AppHeader backHref="/modulos" />}

      {erro && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
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
  );
}

// ------------------------------------------------------------
function AguardandoAprovacao({ membership }: { membership: MyMembership }) {
  return (
    <section className="max-w-xl rounded-xl border border-evolution/40 bg-surface p-6">
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

// Jogador nao gerencia nada: ve o vinculo, o coach e onde estudar.
function VisaoJogador({ data }: { data: MyTeam }) {
  const eu = data.members.find((m) => m.isMe);
  const meuCoach = data.members.find((m) => m.userId === eu?.coachId);
  const coaches = data.members.filter((m) => m.isCoach);

  return (
    <div className="max-w-2xl space-y-5">
      {coaches.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Coach{coaches.length > 1 ? "es" : ""}
          </span>
          {coaches.map((c) => (
            <Chip key={c.userId} color={data.team.accent} size="sm">{c.name}</Chip>
          ))}
        </div>
      )}
      <TeamBanner
        name={data.team.name}
        accent={data.team.accent}
        logoUrl={data.team.logoUrl}
        bannerUrl={data.team.bannerUrl}
        backHref="/modulos"
      />

      <section className="rounded-xl border border-hairline bg-surface p-6">
        <p className="text-xs text-muted">
          Você entrou em {eu ? new Date(eu.joinedAt).toLocaleDateString("pt-BR") : "—"}
          {meuCoach ? ` · seu coach é ${meuCoach.name}` : " · ainda sem coach atribuído"}
        </p>
      </section>

      <section className="rounded-xl border border-hairline bg-surface p-6">
        <h2 className="text-base font-semibold">O que o time acompanha</h2>
        <ul className="mt-3 space-y-2.5 text-[13px] text-muted">
          <li className="flex gap-2.5"><Target size={15} className="mt-0.5 shrink-0 text-training" />
            Sua frequência de estudo, treinos e evolução de nível.</li>
          <li className="flex gap-2.5"><BookOpen size={15} className="mt-0.5 shrink-0 text-review" />
            As mãos que <strong className="text-ink/85">você escolher</strong> compartilhar com seu coach — nenhuma outra.</li>
          <li className="flex gap-2.5"><Flame size={15} className="mt-0.5 shrink-0 text-evolution" />
            Volume de jogos e resultado, contados a partir da sua entrada no time.</li>
        </ul>
      </section>

      <MetaDoFunil />
      <EventosDoJogador />
    </div>
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

  if (!card || !card.statMetric) return null;

  // "vs Open" nao tem correspondencia clara com PFR/VPIP (sao stats de
  // pre-flop puro, banco de drills so tem pos-flop). "3-Bet" so entra
  // se realmente existir spot solvado — hoje a base e' 100% SRP.
  const temTreino = card.statMetric === "three_bet" && temDrillsTresBet;
  // So passa "pos" quando a posicao vier de dado real do jogador (Revisor)
  // e for uma das posicoes que os spots realmente cobrem.
  const posValida = piorPosicao && ["UTG", "CO", "BTN", "SB"].includes(piorPosicao) ? piorPosicao : null;
  const linkTreino = posValida ? `/treino?action=3-Bet&pos=${posValida}` : "/treino?action=3-Bet";

  return (
    <section className="rounded-xl border border-hairline bg-surface p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Target size={16} />
        Meta do seu coach
      </h2>
      <p className="mt-1 text-sm text-muted">
        {STAT_METRIC_LABEL[card.statMetric]} atual: <strong className="text-ink/85">{card.statValue ?? "—"}%</strong>
        {card.statTarget != null && <> · meta: {card.statTarget}%</>}
      </p>

      {temTreino ? (
        <Link href={linkTreino}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02]">
          <Dumbbell size={16} />
          {posValida ? `Treinar 3-bet (${posValida})` : "Treinar 3-bet"}
        </Link>
      ) : (
        <p className="mt-2 text-xs text-muted">Ainda não há drills específicos pra esse número na base atual — foco em revisar suas mãos por enquanto.</p>
      )}
    </section>
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
    <section className="rounded-xl border border-hairline bg-surface p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <CalendarDays size={17} />
        Próximos eventos
      </h2>
      {erro && <p className="mt-2 text-xs text-negative">{erro}</p>}

      <ul className="mt-3 divide-y divide-hairline">
        {eventos.map((ev) => {
          const meuStatus = ev.participants[0]?.status ?? "pendente";
          const destacado = ev.id === destaqueId;
          return (
            <li key={ev.id} className={`py-3.5 ${destacado ? "rounded-lg bg-ink/5 px-2" : ""}`}>
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
                    className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-void transition-transform hover:scale-[1.03] disabled:opacity-50">
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
    </section>
  );
}

function SemPlanoCard() {
  return (
    <section className="max-w-xl rounded-xl border border-hairline bg-surface p-6">
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
    <section className="max-w-xl rounded-xl border border-hairline bg-surface p-6">
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
