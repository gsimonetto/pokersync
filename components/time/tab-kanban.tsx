"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarCheck, CalendarPlus, CheckCircle2, Clock, MessageCircleWarning, Plus, Sparkles, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  fetchFunnelPhases,
  fetchPlayerCards,
  movePlayerCard,
  progressoPronto,
  seedDefaultPhases,
  traduzErroFunil,
  updateCardDetails,
  STAT_METRIC_LABEL,
  type FunnelPhase,
  type PlayerCard,
  type StatMetric,
} from "@/lib/services/team-funnel-service";
import {
  fetchTeamAlerts,
  ALERTA_LABEL,
  type TeamAlert,
  type TeamDashboardRow,
} from "@/lib/services/team-service";

// Kanban simples (sem drag-and-drop — mobile-first): mover fase e' um
// select dentro do proprio card. Coach abre o card pra editar meta e
// deixar anotacao; presenca/drills/reviews sao so leitura (vem do banco).

export function TabKanban({
  teamId,
  jogadores,
  onErro,
  onAgendarConversa,
}: {
  teamId: string;
  jogadores: TeamDashboardRow[];
  onErro: (s: string) => void;
  onAgendarConversa: (playerId: string) => void;
}) {
  const [fases, setFases] = useState<FunnelPhase[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [alertas, setAlertas] = useState<TeamAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardAberto, setCardAberto] = useState<PlayerCard | null>(null);
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [criandoFases, setCriandoFases] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [f, c, al] = await Promise.all([
        fetchFunnelPhases(teamId),
        fetchPlayerCards(),
        fetchTeamAlerts(14).catch(() => []),
      ]);
      setFases(f);
      setCards(c);
      setAlertas(al);
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const porNome = useMemo(() => {
    const m = new Map<string, TeamDashboardRow>();
    jogadores.forEach((j) => m.set(j.userId, j));
    return m;
  }, [jogadores]);

  const jogadoresSemCard = useMemo(() => {
    const comCard = new Set(cards.map((c) => c.playerId));
    return jogadores.filter((j) => !comCard.has(j.userId));
  }, [jogadores, cards]);

  const cardsPorFase = useMemo(() => {
    const m = new Map<string, PlayerCard[]>();
    fases.forEach((f) => m.set(f.id, []));
    cards.forEach((c) => {
      const arr = m.get(c.phaseId) ?? [];
      arr.push(c);
      m.set(c.phaseId, arr);
    });
    return m;
  }, [fases, cards]);

  const prontos = useMemo(() => cards.filter(progressoPronto), [cards]);
  const estagnados = useMemo(() => {
    const limite = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return cards.filter((c) => !progressoPronto(c) && new Date(c.movedAt).getTime() < limite && c.drillsDone === 0 && c.reviewsDone === 0);
  }, [cards]);
  const comFaltas = useMemo(() => cards.filter((c) => c.eventosAusente >= 2), [cards]);

  async function moverProximaFase(card: PlayerCard) {
    const idx = fases.findIndex((f) => f.id === card.phaseId);
    const proxima = fases[idx + 1];
    if (!proxima) return;
    try {
      await movePlayerCard(card.playerId, proxima.id);
      await carregar();
    } catch (e) {
      onErro(traduzErroFunil(e));
    }
  }

  async function criarFasesPadrao() {
    setCriandoFases(true);
    try {
      await seedDefaultPhases(teamId);
      await carregar();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setCriandoFases(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Carregando funil…</p>;

  if (fases.length === 0) {
    return (
      <section className="rounded-xl border border-hairline bg-surface p-6 text-center">
        <Sparkles size={22} className="mx-auto text-muted" />
        <h2 className="mt-2 text-base font-semibold">Nenhuma fase criada ainda</h2>
        <p className="mt-1 text-sm text-muted">Comece com o funil padrão (Prospecção → Base → Desenvolvimento → Elite) e ajuste depois.</p>
        <button
          onClick={criarFasesPadrao}
          disabled={criandoFases}
          className="mt-4 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {criandoFases ? "Criando…" : "Criar fases padrão"}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <AssistenteResumo
        prontos={prontos}
        estagnados={estagnados}
        comFaltas={comFaltas}
        alertas={alertas}
        porNome={porNome}
        fases={fases}
        onMoverProximaFase={moverProximaFase}
        onAbrirCard={setCardAberto}
      />

      <div className="flex justify-end">
        <button
          onClick={() => setModalAdicionar(true)}
          className="flex items-center gap-2 rounded-xl border border-hairline bg-elevated px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink/40"
        >
          <UserPlus size={15} />
          Adicionar ao funil
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {fases.map((fase) => {
          const lista = (cardsPorFase.get(fase.id) ?? []).sort((a, b) => a.movedAt.localeCompare(b.movedAt));
          return (
            <div key={fase.id} className="w-72 shrink-0">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fase.color }} />
                <h3 className="text-[13px] font-semibold">{fase.name}</h3>
                <span className="text-xs text-muted">{lista.length}</span>
              </div>

              <div className="space-y-2">
                {lista.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-hairline p-3 text-center text-xs text-muted">Vazio</p>
                ) : (
                  lista.map((card) => {
                    const j = porNome.get(card.playerId);
                    const pronto = progressoPronto(card);
                    return (
                      <button
                        key={card.cardId}
                        onClick={() => setCardAberto(card)}
                        className="block w-full rounded-xl border border-hairline bg-surface p-3 text-left transition-colors hover:border-ink/30"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar id={j?.avatarId ?? 1} url={j?.avatarUrl} size={26} />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{j?.nome ?? "Jogador"}</span>
                          {pronto && <CheckCircle2 size={14} className="shrink-0 text-positive" />}
                        </div>

                        <div className="mt-2 space-y-1">
                          <BarraProgresso label="Drills" done={card.drillsDone} target={card.drillsTarget} />
                          <BarraProgresso label="Reviews" done={card.reviewsDone} target={card.reviewsTarget} />
                        </div>

                        {card.statMetric && (
                          <p className="mt-1.5 text-[11px] text-muted">
                            {STAT_METRIC_LABEL[card.statMetric]}: {card.statValue ?? "—"}%
                            {card.statTarget != null && ` (meta ${card.statTarget}%)`}
                          </p>
                        )}

                        {card.eventosTotal > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                            <CalendarCheck size={11} />
                            {card.eventosPresente}/{card.eventosTotal} presenças
                            {card.eventosAusente >= 2 && <AlertTriangle size={11} className="text-negative" />}
                          </p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cardAberto && (
        <ModalCard
          card={cardAberto}
          fases={fases}
          jogador={porNome.get(cardAberto.playerId)}
          onFechar={() => setCardAberto(null)}
          onChange={async () => {
            await carregar();
            setCardAberto(null);
          }}
          onErro={onErro}
          onAgendarConversa={() => {
            setCardAberto(null);
            onAgendarConversa(cardAberto.playerId);
          }}
        />
      )}

      {modalAdicionar && (
        <ModalAdicionar
          jogadores={jogadoresSemCard}
          fases={fases}
          onFechar={() => setModalAdicionar(false)}
          onChange={async () => {
            await carregar();
            setModalAdicionar(false);
          }}
          onErro={onErro}
        />
      )}
    </div>
  );
}

const ALERTA_ICON: Record<string, typeof AlertTriangle> = {
  faltas_consecutivas: CalendarCheck,
  rsvp_sem_resposta: MessageCircleWarning,
  inatividade: Clock,
  queda_frequencia: AlertTriangle,
  sem_revisao: AlertTriangle,
  mao_sem_resposta: MessageCircleWarning,
  lembrete_estudo: Clock,
};

// Resumo do coach: o que precisa de decisao agora. So aparece o que
// existe (secoes vazias somem) — nada de placeholder vazio ocupando
// espaco em tela pequena.
function AssistenteResumo({
  prontos,
  estagnados,
  comFaltas,
  alertas,
  porNome,
  fases,
  onMoverProximaFase,
  onAbrirCard,
}: {
  prontos: PlayerCard[];
  estagnados: PlayerCard[];
  comFaltas: PlayerCard[];
  alertas: TeamAlert[];
  porNome: Map<string, TeamDashboardRow>;
  fases: FunnelPhase[];
  onMoverProximaFase: (card: PlayerCard) => void;
  onAbrirCard: (card: PlayerCard) => void;
}) {
  const nada = prontos.length === 0 && estagnados.length === 0 && comFaltas.length === 0 && alertas.length === 0;
  if (nada) return null;

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <Sparkles size={16} />
        Assistente do coach
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {prontos.length > 0 && (
          <div className="rounded-lg border border-positive/30 bg-positive/5 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-positive">
              <CheckCircle2 size={13} /> Prontos pra subir de fase
            </p>
            <ul className="mt-2 space-y-1.5">
              {prontos.map((c) => {
                const j = porNome.get(c.playerId);
                const idx = fases.findIndex((f) => f.id === c.phaseId);
                const proxima = fases[idx + 1];
                return (
                  <li key={c.cardId} className="flex items-center justify-between gap-2 text-[13px]">
                    <button onClick={() => onAbrirCard(c)} className="min-w-0 truncate text-left hover:underline">{j?.nome ?? "Jogador"}</button>
                    {proxima && (
                      <button onClick={() => onMoverProximaFase(c)}
                        className="flex shrink-0 items-center gap-1 rounded-full border border-positive/40 px-2 py-0.5 text-[11px] text-positive transition-colors hover:bg-positive/10">
                        {proxima.name} <ArrowRight size={11} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {comFaltas.length > 0 && (
          <div className="rounded-lg border border-negative/30 bg-negative/5 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-negative">
              <AlertTriangle size={13} /> Faltando às reuniões
            </p>
            <ul className="mt-2 space-y-1.5">
              {comFaltas.map((c) => {
                const j = porNome.get(c.playerId);
                return (
                  <li key={c.cardId}>
                    <button onClick={() => onAbrirCard(c)} className="text-left text-[13px] hover:underline">
                      {j?.nome ?? "Jogador"} <span className="text-muted">· {c.eventosAusente} faltas</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {estagnados.length > 0 && (
          <div className="rounded-lg border border-evolution/30 bg-evolution/5 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-evolution">
              <Clock size={13} /> Sem progresso há 14+ dias na fase
            </p>
            <ul className="mt-2 space-y-1.5">
              {estagnados.map((c) => {
                const j = porNome.get(c.playerId);
                return (
                  <li key={c.cardId}>
                    <button onClick={() => onAbrirCard(c)} className="text-left text-[13px] hover:underline">{j?.nome ?? "Jogador"}</button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {alertas.length > 0 && (
          <div className="rounded-lg border border-hairline bg-elevated p-3">
            <p className="text-[12px] font-semibold text-muted">Últimos alertas do sistema</p>
            <ul className="mt-2 space-y-1.5">
              {alertas.slice(0, 6).map((a) => {
                const j = porNome.get(a.playerId);
                const Icon = ALERTA_ICON[a.kind] ?? AlertTriangle;
                return (
                  <li key={a.id} className="flex items-start gap-1.5 text-[12px] text-muted">
                    <Icon size={12} className="mt-0.5 shrink-0" />
                    <span><strong className="text-ink/80">{j?.nome ?? "Jogador"}</strong> · {ALERTA_LABEL[a.kind]}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function BarraProgresso({ label, done, target }: { label: string; done: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span className="tnum">{done}/{target}</span>
      </div>
      <div className="mt-0.5 h-1.5 rounded-full bg-elevated">
        <div className="h-1.5 rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ModalCard({
  card,
  fases,
  jogador,
  onFechar,
  onChange,
  onErro,
  onAgendarConversa,
}: {
  card: PlayerCard;
  fases: FunnelPhase[];
  jogador?: TeamDashboardRow;
  onFechar: () => void;
  onChange: () => void;
  onErro: (s: string) => void;
  onAgendarConversa: () => void;
}) {
  const [fase, setFase] = useState(card.phaseId);
  const [notas, setNotas] = useState(card.notes ?? "");
  const [drillsAlvo, setDrillsAlvo] = useState(card.drillsTarget);
  const [reviewsAlvo, setReviewsAlvo] = useState(card.reviewsTarget);
  const [statMetric, setStatMetric] = useState<StatMetric | "">(card.statMetric ?? "");
  const [statAlvo, setStatAlvo] = useState<number | "">(card.statTarget ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      if (fase !== card.phaseId) {
        await movePlayerCard(card.playerId, fase);
      }
      await updateCardDetails(card.playerId, {
        notes: notas,
        drillsTargetOverride: drillsAlvo,
        reviewsTargetOverride: reviewsAlvo,
        statMetricOverride: statMetric === "" ? null : statMetric,
        statTargetOverride: statAlvo === "" ? null : Number(statAlvo),
      });
      onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-hairline bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Avatar id={jogador?.avatarId ?? 1} url={jogador?.avatarUrl} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{jogador?.nome ?? "Jogador"}</p>
            <p className="text-xs text-muted">Card do funil</p>
          </div>
          <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <Campo label="Fase">
            <select value={fase} onChange={(e) => setFase(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none">
              {fases.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Meta de drills">
              <input type="number" min={0} value={drillsAlvo} onChange={(e) => setDrillsAlvo(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none" />
            </Campo>
            <Campo label="Meta de reviews">
              <input type="number" min={0} value={reviewsAlvo} onChange={(e) => setReviewsAlvo(Number(e.target.value))}
                className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none" />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Stat (opcional)">
              <select value={statMetric} onChange={(e) => setStatMetric(e.target.value as StatMetric | "")}
                className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none">
                <option value="">Nenhuma</option>
                <option value="vpip">VPIP</option>
                <option value="pfr">PFR</option>
                <option value="three_bet">3-bet</option>
              </select>
            </Campo>
            <Campo label="Meta (%)">
              <input type="number" min={0} max={100} value={statAlvo} onChange={(e) => setStatAlvo(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={!statMetric}
                className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none disabled:opacity-40" />
            </Campo>
          </div>
          <p className="-mt-2 text-[11px] text-muted">O valor atual só é mostrado no card — se a meta é subir ou descer esse número é você quem decide.</p>

          <Campo label="Anotação de evolução">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={500}
              placeholder="Feedback, próximos passos, combinados com o jogador…"
              className="w-full resize-none rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted/50" />
          </Campo>

          {card.eventosTotal > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <CalendarCheck size={13} />
              {card.eventosPresente} presenças e {card.eventosAusente} faltas em {card.eventosTotal} eventos desde que entrou nesta fase.
            </p>
          )}

          <button onClick={onAgendarConversa} type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/40">
            <CalendarPlus size={16} />
            Agendar conversa com {jogador?.nome ?? "jogador"}
          </button>

          <button onClick={salvar} disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50">
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalAdicionar({
  jogadores,
  fases,
  onFechar,
  onChange,
  onErro,
}: {
  jogadores: TeamDashboardRow[];
  fases: FunnelPhase[];
  onFechar: () => void;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [selecionado, setSelecionado] = useState<string>("");
  const [fase, setFase] = useState(fases[0]?.id ?? "");
  const [salvando, setSalvando] = useState(false);

  async function adicionar() {
    if (!selecionado || !fase) return onErro("Escolha o jogador e a fase.");
    setSalvando(true);
    try {
      await movePlayerCard(selecionado, fase);
      onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Adicionar ao funil</h2>
          <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {jogadores.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Todos os jogadores já estão no funil.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <Campo label="Jogador">
              <select value={selecionado} onChange={(e) => setSelecionado(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none">
                <option value="">Selecione…</option>
                {jogadores.map((j) => <option key={j.userId} value={j.userId}>{j.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Fase inicial">
              <select value={fase} onChange={(e) => setFase(e.target.value)}
                className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none">
                {fases.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Campo>
            <button onClick={adicionar} disabled={salvando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50">
              <Plus size={16} strokeWidth={2.5} />
              {salvando ? "Adicionando…" : "Adicionar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</label>
      {children}
    </div>
  );
}
