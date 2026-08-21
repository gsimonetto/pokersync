"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArchiveRestore, ArrowLeft, CalendarCheck, CalendarPlus, CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, Circle, GripVertical, ListChecks, MessageSquare, Plus, Settings2, Sparkles, Tag, Trash2, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Chip } from "@/components/chip";
import { Campo } from "@/components/time/campo";
import {
  addCardComment,
  addChecklistItem,
  archiveCard,
  createPhase,
  deleteChecklistItem,
  deletePhase,
  fetchArchivedCards,
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
  swapPhaseOrder,
  toggleChecklistItem,
  traduzErroFunil,
  updateCardDetails,
  updatePhase,
  ARCHIVE_REASON_LABEL,
  STAT_METRIC_LABEL,
  type ArchivedCard,
  type ArchiveReason,
  type CardComment,
  type CardLabel,
  type ChecklistItem,
  type FunnelPhase,
  type PlayerCard,
  type StatMetric,
} from "@/lib/services/team-funnel-service";
import {
  fetchTeamLabels,
  type TeamDashboardRow,
  type TeamLabel,
} from "@/lib/services/team-service";
import { ACCENT } from "@/lib/modules-data";
import { useConfirm } from "@/components/confirm-dialog";

// Kanban estilo Trello: arrastar o card entre colunas move de fase (drag
// nativo HTML5, sem lib extra); o card tambem pode ser aberto pra editar
// meta, checklist, etiquetas e comentarios. Presenca/drills/reviews sao
// so leitura (vem do banco).

export function TabKanban({
  teamId,
  jogadores,
  coaches,
  isAdmin,
  backHref,
  onErro,
  onAgendarConversa,
}: {
  teamId: string;
  jogadores: TeamDashboardRow[];
  coaches: { userId: string; nome: string }[];
  /** So' admin mexe em fases (mesma regra da RLS de team_funnel_phases). */
  isAdmin: boolean;
  /** Sem AppHeader nesta pagina — o voltar mora na propria barra de filtros. */
  backHref?: string;
  onErro: (s: string) => void;
  onAgendarConversa: (playerId: string) => void;
}) {
  const [fases, setFases] = useState<FunnelPhase[]>([]);
  const [cards, setCards] = useState<PlayerCard[]>([]);
  const [labelsDoTime, setLabelsDoTime] = useState<TeamLabel[]>([]);
  const [labelsPorCard, setLabelsPorCard] = useState<Map<string, CardLabel[]>>(new Map());
  const [checklistPorCard, setChecklistPorCard] = useState<Map<string, { done: number; total: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [cardAberto, setCardAberto] = useState<PlayerCard | null>(null);
  const [modalAdicionar, setModalAdicionar] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);
  const [criandoFases, setCriandoFases] = useState(false);
  const [faseArrastando, setFaseArrastando] = useState<string | null>(null);

  // Filtros: com 50 jogadores no funil, sem isso o board vira uma
  // parede de cards. "Tarefas pendentes" olha o checklist (item aberto).
  const [filtroLabel, setFiltroLabel] = useState<string>("todas");
  const [filtroCoach, setFiltroCoach] = useState<string>("todos");
  const [soTarefasPendentes, setSoTarefasPendentes] = useState(false);

  const [modo, setModo] = useState<"board" | "arquivados">("board");
  const [arquivados, setArquivados] = useState<ArchivedCard[]>([]);
  const [carregandoArquivados, setCarregandoArquivados] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [f, c, tl] = await Promise.all([
        fetchFunnelPhases(teamId),
        fetchPlayerCards(),
        fetchTeamLabels(teamId).catch(() => []),
      ]);
      setFases(f);
      setCards(c);
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

  async function carregarArquivados() {
    setCarregandoArquivados(true);
    try {
      setArquivados(await fetchArchivedCards());
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setCarregandoArquivados(false);
    }
  }

  useEffect(() => {
    if (modo === "arquivados") carregarArquivados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo]);

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

  const cardsFiltrados = useMemo(() => {
    return cards.filter((c) => {
      if (filtroLabel !== "todas") {
        const labels = labelsPorCard.get(c.cardId) ?? [];
        if (!labels.some((l) => l.id === filtroLabel)) return false;
      }
      if (filtroCoach !== "todos") {
        const j = porNome.get(c.playerId);
        if (j?.coachId !== filtroCoach) return false;
      }
      if (soTarefasPendentes) {
        const chk = checklistPorCard.get(c.cardId);
        if (!chk || chk.total === 0 || chk.done >= chk.total) return false;
      }
      return true;
    });
  }, [cards, filtroLabel, filtroCoach, soTarefasPendentes, labelsPorCard, checklistPorCard, porNome]);

  const cardsPorFase = useMemo(() => {
    const m = new Map<string, PlayerCard[]>();
    fases.forEach((f) => m.set(f.id, []));
    cardsFiltrados.forEach((c) => {
      const arr = m.get(c.phaseId) ?? [];
      arr.push(c);
      m.set(c.phaseId, arr);
    });
    return m;
  }, [fases, cardsFiltrados]);

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
      <div className="flex flex-wrap items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Voltar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
          >
            <ArrowLeft size={18} />
          </Link>
        )}

        <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
          <button
            onClick={() => setModo("board")}
            className={`rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${
              modo === "board" ? "bg-ink text-void" : "text-muted hover:text-ink"
            }`}
          >
            Board
          </button>
          <button
            onClick={() => setModo("arquivados")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-all ${
              modo === "arquivados" ? "bg-ink text-void" : "text-muted hover:text-ink"
            }`}
          >
            <ArchiveRestore size={13} />
            Arquivados
          </button>
        </div>

        {modo === "board" && (
          <>
            <select
              value={filtroLabel}
              onChange={(e) => setFiltroLabel(e.target.value)}
              className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[12px] text-ink outline-none"
            >
              <option value="todas">Todas as etiquetas</option>
              {labelsDoTime.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            {coaches.length > 0 && (
              <select
                value={filtroCoach}
                onChange={(e) => setFiltroCoach(e.target.value)}
                className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[12px] text-ink outline-none"
              >
                <option value="todos">Todos os coaches</option>
                {coaches.map((c) => (
                  <option key={c.userId} value={c.userId}>{c.nome}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => setSoTarefasPendentes((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                soTarefasPendentes ? "border-training/50 bg-training/10 text-training" : "border-hairline text-muted hover:text-ink"
              }`}
            >
              <CheckSquare size={13} />
              Com tarefas pendentes
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setModalConfig(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
              aria-label="Configurações do funil"
              title="Configurações do funil"
            >
              <Settings2 size={15} />
            </button>
          )}
          <button
            onClick={() => setModalAdicionar(true)}
            className="flex items-center gap-2 rounded-xl border border-hairline bg-elevated px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink/40"
          >
            <UserPlus size={15} />
            Adicionar ao funil
          </button>
        </div>
      </div>

      {modo === "arquivados" ? (
        <ListaArquivados
          arquivados={arquivados}
          carregando={carregandoArquivados}
          onRestaurar={async (playerId, phaseId) => {
            await moverParaFase(playerId, phaseId);
            await carregarArquivados();
          }}
          fases={fases}
          onErro={onErro}
        />
      ) : (
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
                        className="flex h-[228px] w-full cursor-grab flex-col overflow-hidden rounded-xl border border-hairline bg-surface p-3 text-left transition-colors hover:border-ink/30 active:cursor-grabbing"
                      >
                        <div className="mb-1.5 flex max-h-[20px] flex-wrap gap-1 overflow-hidden">
                          {labels.map((l) => (
                            <Chip key={l.id} color={l.color} size="sm">{l.name}</Chip>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <Avatar id={j?.avatarId ?? 1} url={j?.avatarUrl} size={26} />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{j?.nome ?? "Jogador"}</span>
                          {pronto && <CheckCircle2 size={14} className="shrink-0 text-positive" />}
                        </div>

                        <div className="mt-2 space-y-1">
                          <BarraProgresso label="Drills" done={card.drillsDone} target={card.drillsTarget} />
                          <BarraProgresso label="Reviews" done={card.reviewsDone} target={card.reviewsTarget} />
                        </div>

                        <div className="mt-1.5 flex-1 space-y-1 overflow-hidden">
                          {card.statMetric && (
                            <p className="text-[11px] text-muted">
                              {STAT_METRIC_LABEL[card.statMetric]}: {card.statValue ?? "—"}%
                              {card.statTarget != null && ` (meta ${card.statTarget}%)`}
                            </p>
                          )}

                          {card.eventosTotal > 0 && (
                            <p className="flex items-center gap-1 text-[11px] text-muted">
                              <CalendarCheck size={11} />
                              {card.eventosPresente}/{card.eventosTotal} presenças
                              {card.eventosAusente >= 2 && <AlertTriangle size={11} className="text-negative" />}
                            </p>
                          )}

                          {chk && chk.total > 0 && (
                            <p className="flex items-center gap-1 text-[11px] text-muted">
                              <ListChecks size={11} />
                              {chk.done}/{chk.total}
                            </p>
                          )}
                        </div>

                        {/* Mover de fase por toque — drag-and-drop e' so' mouse
                            (HTML5 drag nao funciona em touch), essas setas
                            sao o caminho equivalente pra celular/tablet. */}
                        {(faseAnterior || faseSeguinte) && (
                          <div className="mt-2 flex shrink-0 items-center justify-between border-t border-hairline pt-2">
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
      )}

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

      {modalConfig && (
        <ModalConfigFunil
          teamId={teamId}
          fases={fases}
          onFechar={() => setModalConfig(false)}
          onChange={carregar}
          onErro={onErro}
        />
      )}
    </div>
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

  const [confirmarArquivar, setConfirmarArquivar] = useState(false);
  const [arquivando, setArquivando] = useState(false);

  async function arquivar(motivo: ArchiveReason) {
    setArquivando(true);
    try {
      await archiveCard(card.playerId, motivo);
      onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
      setArquivando(false);
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

          {/* Sair do funil ativo — a pergunta "o que eu faco com esse
              lead na ultima fase?" vira essas duas opcoes, e o card some
              do board sem perder historico (fica em "Arquivados"). */}
          <div className="border-t border-hairline pt-4">
            {!confirmarArquivar ? (
              <button onClick={() => setConfirmarArquivar(true)} type="button"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-ink/40 hover:text-ink">
                <ArchiveRestore size={15} />
                Sair do funil
              </button>
            ) : (
              <div className="rounded-lg border border-hairline bg-elevated p-3">
                <p className="text-[13px] text-ink/85">O que fazer com {jogador?.nome ?? "esse jogador"}?</p>
                <div className="mt-2 flex flex-col gap-2">
                  <button onClick={() => arquivar("concluido")} disabled={arquivando} type="button"
                    className="flex items-center justify-center gap-2 rounded-lg border border-positive/40 px-3 py-2 text-[13px] font-semibold text-positive transition-colors hover:bg-positive/10 disabled:opacity-50">
                    <CheckCircle2 size={14} />
                    {ARCHIVE_REASON_LABEL.concluido}
                  </button>
                  <button onClick={() => arquivar("removido")} disabled={arquivando} type="button"
                    className="flex items-center justify-center gap-2 rounded-lg border border-negative/40 px-3 py-2 text-[13px] font-semibold text-negative transition-colors hover:bg-negative/10 disabled:opacity-50">
                    <X size={14} />
                    {ARCHIVE_REASON_LABEL.removido}
                  </button>
                  <button onClick={() => setConfirmarArquivar(false)} type="button"
                    className="rounded-lg px-3 py-1.5 text-[12px] text-muted hover:text-ink">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
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

// ------------------------------------------------------------
// Arquivados: quem saiu do funil ativo (formado ou removido do time),
// sem sumir da vista — restaurar manda de volta pra uma fase escolhida.
// ------------------------------------------------------------
function ListaArquivados({
  arquivados,
  carregando,
  fases,
  onRestaurar,
  onErro,
}: {
  arquivados: ArchivedCard[];
  carregando: boolean;
  fases: FunnelPhase[];
  onRestaurar: (playerId: string, phaseId: string) => Promise<void>;
  onErro: (s: string) => void;
}) {
  const [faseEscolhida, setFaseEscolhida] = useState<Record<string, string>>({});
  const [restaurando, setRestaurando] = useState<string | null>(null);

  async function restaurar(a: ArchivedCard) {
    const phaseId = faseEscolhida[a.playerId] ?? fases[0]?.id;
    if (!phaseId) return;
    setRestaurando(a.playerId);
    try {
      await onRestaurar(a.playerId, phaseId);
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setRestaurando(null);
    }
  }

  if (carregando) return <p className="text-sm text-muted">Carregando…</p>;

  if (arquivados.length === 0) {
    return (
      <section className="rounded-xl border border-hairline bg-surface p-6 text-center">
        <ArchiveRestore size={22} className="mx-auto text-muted" />
        <p className="mt-2 text-sm text-muted">Ninguém arquivado ainda — quem sai do funil (formado ou removido) aparece aqui.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <ul className="divide-y divide-hairline">
        {arquivados.map((a) => (
          <li key={a.cardId} className="flex flex-wrap items-center gap-3 py-3.5">
            <Avatar id={a.avatarId} url={a.avatarUrl} size={34} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{a.nome}</span>
                <Chip color={a.archivedReason === "concluido" ? "#2FB89A" : "#8b8b8b"} size="sm">
                  {ARCHIVE_REASON_LABEL[a.archivedReason]}
                </Chip>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Última fase: {a.phaseName} · saiu em {new Date(a.archivedAt).toLocaleDateString("pt-BR")}
              </p>
              {a.notes && <p className="mt-0.5 truncate text-xs text-muted">{a.notes}</p>}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <select
                value={faseEscolhida[a.playerId] ?? fases[0]?.id ?? ""}
                onChange={(e) => setFaseEscolhida((prev) => ({ ...prev, [a.playerId]: e.target.value }))}
                className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-[12px] text-ink outline-none"
              >
                {fases.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button
                onClick={() => restaurar(a)}
                disabled={restaurando === a.playerId}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
              >
                <ArchiveRestore size={13} />
                {restaurando === a.playerId ? "Restaurando…" : "Restaurar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------
// Configuracoes do funil: gerenciar fases (criar, renomear, cor, metas
// padrao, reordenar, excluir) — "todas as mudancas que podemos fazer"
// no funil, num so lugar em vez de espalhado. So' admin (mesma regra
// da RLS de team_funnel_phases).
// ------------------------------------------------------------
function ModalConfigFunil({
  teamId,
  fases,
  onFechar,
  onChange,
  onErro,
}: {
  teamId: string;
  fases: FunnelPhase[];
  onFechar: () => void;
  onChange: () => Promise<void> | void;
  onErro: (s: string) => void;
}) {
  const confirm = useConfirm();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(ACCENT.blue);
  const [drills, setDrills] = useState(0);
  const [reviews, setReviews] = useState(0);
  const [salvando, setSalvando] = useState(false);

  const [novaFase, setNovaFase] = useState("");
  const [criando, setCriando] = useState(false);

  function abrirEdicao(f: FunnelPhase) {
    setEditandoId(f.id);
    setNome(f.name);
    setCor(f.color);
    setDrills(f.defaultDrillsTarget);
    setReviews(f.defaultReviewsTarget);
  }

  async function salvarEdicao() {
    if (!editandoId || !nome.trim()) return;
    setSalvando(true);
    try {
      await updatePhase(editandoId, { name: nome, color: cor, defaultDrillsTarget: drills, defaultReviewsTarget: reviews });
      setEditandoId(null);
      await onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setSalvando(false);
    }
  }

  async function mover(f: FunnelPhase, direcao: -1 | 1) {
    const idx = fases.findIndex((x) => x.id === f.id);
    const vizinho = fases[idx + direcao];
    if (!vizinho) return;
    try {
      await swapPhaseOrder(f, vizinho);
      await onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    }
  }

  async function excluir(f: FunnelPhase) {
    if (!(await confirm({ title: "Excluir fase", message: `A fase "${f.name}" sai do funil. Só funciona se não houver ninguém nela.`, confirmLabel: "Excluir" }))) return;
    try {
      await deletePhase(f.id);
      await onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    }
  }

  async function criar() {
    if (!novaFase.trim()) return;
    setCriando(true);
    try {
      await createPhase(teamId, novaFase, ACCENT.blue, fases.length);
      setNovaFase("");
      await onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-hairline bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Settings2 size={17} />
            Configurações do funil
          </h2>
          <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <p className="mt-1 text-[13px] text-muted">Fases do funil, na ordem em que aparecem no board.</p>

        <ul className="mt-4 space-y-2">
          {fases.map((f, idx) => (
            <li key={f.id} className="rounded-lg border border-hairline bg-elevated p-3">
              {editandoId === f.id ? (
                <div className="space-y-2.5">
                  <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={30}
                    className="w-full rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm text-ink outline-none" />
                  <div className="flex gap-1.5">
                    {Object.values(ACCENT).map((c) => (
                      <button key={c} onClick={() => setCor(c)} aria-label={`Cor ${c}`}
                        className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-elevated" : ""}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-muted">
                      Meta drills
                      <input type="number" min={0} value={drills} onChange={(e) => setDrills(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink outline-none" />
                    </label>
                    <label className="text-[11px] text-muted">
                      Meta reviews
                      <input type="number" min={0} value={reviews} onChange={(e) => setReviews(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink outline-none" />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditandoId(null)} className="flex-1 rounded-lg border border-hairline px-3 py-1.5 text-[12px] text-ink hover:border-ink/40">Cancelar</button>
                    <button onClick={salvarEdicao} disabled={salvando} className="flex-1 rounded-lg bg-ink px-3 py-1.5 text-[12px] font-semibold text-void disabled:opacity-50">
                      {salvando ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <GripVertical size={14} className="shrink-0 text-muted/50" />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{f.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => mover(f, -1)} disabled={idx === 0} aria-label="Mover pra cima"
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-20">
                      <ChevronLeft size={13} className="rotate-90" />
                    </button>
                    <button onClick={() => mover(f, 1)} disabled={idx === fases.length - 1} aria-label="Mover pra baixo"
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-20">
                      <ChevronRight size={13} className="rotate-90" />
                    </button>
                    <button onClick={() => abrirEdicao(f)} aria-label={`Editar ${f.name}`}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
                      <Settings2 size={13} />
                    </button>
                    <button onClick={() => excluir(f)} aria-label={`Excluir ${f.name}`}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-negative">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex gap-2 border-t border-hairline pt-4">
          <input
            value={novaFase}
            onChange={(e) => setNovaFase(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criar()}
            placeholder="Nova fase…"
            maxLength={30}
            className="min-w-0 flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/50"
          />
          <button onClick={criar} disabled={criando || !novaFase.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 disabled:opacity-40">
            <Plus size={14} />
            {criando ? "Criando…" : "Fase"}
          </button>
        </div>
      </div>
    </div>
  );
}

