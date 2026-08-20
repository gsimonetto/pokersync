"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarCheck, CalendarPlus, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock, ListChecks, MessageCircleWarning, MessageSquare, Plus, Sparkles, Tag, Trash2, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Campo } from "@/components/time/campo";
import {
  addCardComment,
  addChecklistItem,
  deleteChecklistItem,
  fetchCardComments,
  fetchCardLabels,
  fetchCardLabelsForCards,
  fetchChecklist,
  fetchChecklistProgressForCards,
  fetchFunnelPhases,
  fetchPlayerCards,
  movePlayerCard,
  progressoPronto,
  seedDefaultPhases,
  setCardLabel,
  toggleChecklistItem,
  traduzErroFunil,
  updateCardDetails,
  STAT_METRIC_LABEL,
  type CardComment,
  type CardLabel,
  type ChecklistItem,
  type FunnelPhase,
  type PlayerCard,
  type StatMetric,
} from "@/lib/services/team-funnel-service";
import {
  fetchTeamAlerts,
  fetchTeamLabels,
  ALERTA_LABEL,
  type TeamAlert,
  type TeamDashboardRow,
  type TeamLabel,
} from "@/lib/services/team-service";

// Kanban estilo Trello: arrastar o card entre colunas move de fase (drag
// nativo HTML5, sem lib extra); o card tambem pode ser aberto pra editar
// meta, checklist, etiquetas e comentarios. Presenca/drills/reviews sao
// so leitura (vem do banco).

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
  const [labelsDoTime, setLabelsDoTime] = useState<TeamLabel[]>([]);
  const [labelsPorCard, setLabelsPorCard] = useState<Map<string, CardLabel[]>>(new Map());
  const [checklistPorCard, setChecklistPorCard] = useState<Map<string, { done: number; total: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [cardAberto, setCardAberto] = useState<PlayerCard | null>(null);
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [criandoFases, setCriandoFases] = useState(false);
  const [faseArrastando, setFaseArrastando] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const [f, c, al, tl] = await Promise.all([
        fetchFunnelPhases(teamId),
        fetchPlayerCards(),
        fetchTeamAlerts(14).catch(() => []),
        fetchTeamLabels(teamId).catch(() => []),
      ]);
      setFases(f);
      setCards(c);
      setAlertas(al);
      setLabelsDoTime(tl);
      const cardIds = c.map((card) => card.cardId);
      const [lbl, chk] = await Promise.all([
        fetchCardLabelsForCards(cardIds).catch(() => new Map()),
        fetchChecklistProgressForCards(cardIds).catch(() => new Map()),
      ]);
      setLabelsPorCard(lbl);
      setChecklistPorCard(chk);
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setLoading(false);
    }
  };

  async function moverParaFase(playerId: string, phaseId: string) {
    try {
      await movePlayerCard(playerId, phaseId);
      await carregar();
    } catch (e) {
      onErro(traduzErroFunil(e));
    }
  }

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
        {fases.map((fase, faseIdx) => {
          const lista = (cardsPorFase.get(fase.id) ?? []).sort((a, b) => a.movedAt.localeCompare(b.movedAt));
          const recebendoDrop = faseArrastando === fase.id;
          const faseAnterior = fases[faseIdx - 1];
          const faseSeguinte = fases[faseIdx + 1];
          return (
            <div
              key={fase.id}
              className="w-72 shrink-0"
              onDragOver={(e) => {
                e.preventDefault();
                setFaseArrastando(fase.id);
              }}
              onDragLeave={() => setFaseArrastando((cur) => (cur === fase.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                setFaseArrastando(null);
                const playerId = e.dataTransfer.getData("text/player-id");
                const faseOrigem = e.dataTransfer.getData("text/fase-origem");
                if (playerId && faseOrigem !== fase.id) moverParaFase(playerId, fase.id);
              }}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fase.color }} />
                <h3 className="text-[13px] font-semibold">{fase.name}</h3>
                <span className="text-xs text-muted">{lista.length}</span>
              </div>

              <div
                className={`space-y-2 rounded-xl p-1 transition-colors ${
                  recebendoDrop ? "bg-ink/5 ring-2 ring-ink/20" : ""
                }`}
              >
                {lista.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-hairline p-3 text-center text-xs text-muted">
                    {recebendoDrop ? "Solte aqui" : "Vazio"}
                  </p>
                ) : (
                  lista.map((card) => {
                    const j = porNome.get(card.playerId);
                    const pronto = progressoPronto(card);
                    const labels = labelsPorCard.get(card.cardId) ?? [];
                    const chk = checklistPorCard.get(card.cardId);
                    return (
                      <div
                        key={card.cardId}
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/player-id", card.playerId);
                          e.dataTransfer.setData("text/fase-origem", card.phaseId);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onClick={() => setCardAberto(card)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardAberto(card); }
                        }}
                        className="block w-full cursor-grab rounded-xl border border-hairline bg-surface p-3 text-left transition-colors hover:border-ink/30 active:cursor-grabbing"
                      >
                        {labels.length > 0 && (
                          <div className="mb-1.5 flex flex-wrap gap-1">
                            {labels.map((l) => (
                              <span
                                key={l.id}
                                className="rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
                                style={{ backgroundColor: `${l.color}22`, color: l.color, border: `1px solid ${l.color}55` }}
                              >
                                {l.name}
                              </span>
                            ))}
                          </div>
                        )}

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

                        {chk && chk.total > 0 && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                            <ListChecks size={11} />
                            {chk.done}/{chk.total}
                          </p>
                        )}

                        {/* Mover de fase por toque — drag-and-drop e' so' mouse
                            (HTML5 drag nao funciona em touch), essas setas
                            sao o caminho equivalente pra celular/tablet. */}
                        {(faseAnterior || faseSeguinte) && (
                          <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
                            <button
                              type="button"
                              disabled={!faseAnterior}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (faseAnterior) moverParaFase(card.playerId, faseAnterior.id);
                              }}
                              aria-label={faseAnterior ? `Mover pra ${faseAnterior.name}` : undefined}
                              className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-0"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={!faseSeguinte}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (faseSeguinte) moverParaFase(card.playerId, faseSeguinte.id);
                              }}
                              aria-label={faseSeguinte ? `Mover pra ${faseSeguinte.name}` : undefined}
                              className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-0"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                      </div>
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
          labelsDoTime={labelsDoTime}
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
  const [aberto, setAberto] = useState(false);
  const total = prontos.length + estagnados.length + comFaltas.length + alertas.length;
  const nada = total === 0;
  if (nada) return null;

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-[15px] font-semibold"
      >
        <Sparkles size={16} />
        Assistente do coach
        <span className="rounded-full bg-elevated px-2 py-0.5 text-[11px] font-bold text-muted">{total}</span>
        <ChevronDown size={16} className={`ml-auto text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
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
      )}
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
  labelsDoTime,
  onFechar,
  onChange,
  onErro,
  onAgendarConversa,
}: {
  card: PlayerCard;
  fases: FunnelPhase[];
  jogador?: TeamDashboardRow;
  labelsDoTime: TeamLabel[];
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

  const [labelsAtivas, setLabelsAtivas] = useState<Set<string>>(new Set());
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [comentarios, setComentarios] = useState<CardComment[]>([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [carregandoExtras, setCarregandoExtras] = useState(true);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [lbl, chk, com] = await Promise.all([
          fetchCardLabels(card.cardId).catch(() => []),
          fetchChecklist(card.cardId).catch(() => []),
          fetchCardComments(card.cardId).catch(() => []),
        ]);
        if (!ativo) return;
        setLabelsAtivas(new Set(lbl.map((l) => l.id)));
        setChecklist(chk);
        setComentarios(com);
      } finally {
        if (ativo) setCarregandoExtras(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [card.cardId]);

  async function alternarLabel(labelId: string) {
    const ativa = labelsAtivas.has(labelId);
    const prev = new Set(labelsAtivas);
    const next = new Set(labelsAtivas);
    ativa ? next.delete(labelId) : next.add(labelId);
    setLabelsAtivas(next);
    try {
      await setCardLabel(card.cardId, labelId, !ativa);
    } catch (e) {
      setLabelsAtivas(prev);
      onErro(traduzErroFunil(e));
    }
  }

  async function adicionarItem() {
    if (!novoItem.trim()) return;
    const texto = novoItem.trim();
    setNovoItem("");
    try {
      await addChecklistItem(card.cardId, texto, checklist.length);
      setChecklist(await fetchChecklist(card.cardId));
    } catch (e) {
      onErro(traduzErroFunil(e));
    }
  }

  async function alternarItem(item: ChecklistItem) {
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)));
    try {
      await toggleChecklistItem(item.id, !item.done);
    } catch (e) {
      setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)));
      onErro(traduzErroFunil(e));
    }
  }

  async function removerItem(itemId: string) {
    const prev = checklist;
    setChecklist((cur) => cur.filter((i) => i.id !== itemId));
    try {
      await deleteChecklistItem(itemId);
    } catch (e) {
      setChecklist(prev);
      onErro(traduzErroFunil(e));
    }
  }

  async function enviarComentario() {
    if (!novoComentario.trim()) return;
    const texto = novoComentario.trim();
    setNovoComentario("");
    try {
      await addCardComment(card.cardId, texto);
      setComentarios(await fetchCardComments(card.cardId));
    } catch (e) {
      onErro(traduzErroFunil(e));
    }
  }

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

          {labelsDoTime.length > 0 && (
            <Campo label="Etiquetas">
              <div className="flex flex-wrap gap-1.5">
                {labelsDoTime.map((l) => {
                  const ativa = labelsAtivas.has(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => alternarLabel(l.id)}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        ativa ? "" : "border-hairline text-muted hover:text-ink"
                      }`}
                      style={ativa ? { backgroundColor: `${l.color}22`, color: l.color, borderColor: `${l.color}55` } : undefined}
                    >
                      <Tag size={11} />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </Campo>
          )}

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              <ListChecks size={12} /> Checklist
              {checklist.length > 0 && (
                <span className="normal-case tracking-normal text-muted/80">
                  {checklist.filter((i) => i.done).length}/{checklist.length}
                </span>
              )}
            </label>
            {!carregandoExtras && checklist.length > 0 && (
              <ul className="mb-2 space-y-1">
                {checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5">
                    <button type="button" onClick={() => alternarItem(item)} className="shrink-0 text-muted hover:text-ink" aria-label={item.done ? "Desmarcar" : "Marcar"}>
                      {item.done ? <CheckCircle2 size={16} className="text-positive" /> : <Circle size={16} />}
                    </button>
                    <span className={`min-w-0 flex-1 text-[13px] ${item.done ? "text-muted line-through" : "text-ink"}`}>{item.text}</span>
                    <button type="button" onClick={() => removerItem(item.id)} className="shrink-0 text-muted hover:text-negative" aria-label="Remover item">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={novoItem}
                onChange={(e) => setNovoItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), adicionarItem())}
                placeholder="Adicionar item…"
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted/50"
              />
              <button type="button" onClick={adicionarItem} disabled={!novoItem.trim()}
                className="shrink-0 rounded-lg border border-hairline px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 disabled:opacity-40">
                <Plus size={14} />
              </button>
            </div>
          </div>

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

          <div className="border-t border-hairline pt-4">
            <label className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              <MessageSquare size={12} /> Atividade
            </label>
            {!carregandoExtras && comentarios.length > 0 && (
              <ul className="mb-2 max-h-40 space-y-2 overflow-y-auto pr-1">
                {comentarios.map((c) => (
                  <li key={c.id} className="rounded-lg border border-hairline bg-elevated px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-ink">{c.authorName}</span>
                      <span className="text-[10px] text-muted">
                        {new Date(c.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-ink/85">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), enviarComentario())}
                placeholder="Deixar um comentário…"
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink outline-none placeholder:text-muted/50"
              />
              <button type="button" onClick={enviarComentario} disabled={!novoComentario.trim()}
                className="shrink-0 rounded-lg border border-hairline px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 disabled:opacity-40">
                <MessageSquare size={14} />
              </button>
            </div>
          </div>

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

