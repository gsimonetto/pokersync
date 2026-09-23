"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArchiveRestore,
  ArrowUpRight,
  CalendarCheck,
  CalendarPlus,
  Check,
  CheckCircle2,
  Circle,
  CornerDownRight,
  Database,
  ExternalLink,
  ListChecks,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Campo } from "@/components/time/campo";
import { MetasCard } from "@/components/time/metas-card";
import { ModalPortal } from "@/components/modal-portal";
import { PlayerBadge } from "@/components/time/player-badge";
import { AbaInteracoes } from "@/components/time/funil/funil-interacoes";
import { crachaDoItem } from "@/components/time/funil/funil-card";
import {
  addChecklistItem,
  archiveCard,
  deleteChecklistItem,
  fetchCardLabels,
  fetchChecklist,
  movePlayerCard,
  setCardLabel,
  toggleChecklistItem,
  traduzErroFunil,
  updateCardDetails,
  ARCHIVE_REASON_LABEL,
  PRIORIDADE_LABEL,
  type ArchiveReason,
  type ChecklistItem,
  type FunnelPhase,
  type Prioridade,
  type StatMetric,
} from "@/lib/services/team-funnel-service";
import type { TeamLabel } from "@/lib/services/team-service";
import { TEMPERATURA_COR, TEMPERATURA_LABEL, faixaBuyin, foraDaFaixa, slaDaFase } from "@/lib/time/funil-regras";
import type { ItemFunil } from "@/components/time/funil/tipos";

// Cartão aberto. Esquerda = o que o coach decide/edita, na ordem de
// uso: próximo passo -> pode subir? -> fase/prioridade/prazo ->
// etiquetas, checklist, metas, anotação. Direita = linha do tempo de
// interações, sempre visível (registrar uma conversa sem perder o resto
// de vista).

const INPUT = "w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none focus:border-white/25";

// <input type="datetime-local"> fala horário local sem fuso.
function isoParaLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function localParaIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function daquiA(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  // "Hoje" = próxima hora cheia; os outros atalhos = 10h do dia.
  if (dias === 0) d.setHours(Math.min(d.getHours() + 1, 23), 0, 0, 0);
  else d.setHours(10, 0, 0, 0);
  return isoParaLocal(d.toISOString());
}

const ATALHOS_DATA = [
  { rotulo: "Hoje", dias: 0 },
  { rotulo: "Amanhã", dias: 1 },
  { rotulo: "+3 dias", dias: 3 },
  { rotulo: "+1 semana", dias: 7 },
];

export function FunilModalCard({
  item,
  fases,
  labelsDoTime,
  podeGerenciarMetas,
  crmDisponivel,
  onFechar,
  onChange,
  onErro,
  onAgendarConversa,
  onPromover,
}: {
  item: ItemFunil;
  fases: FunnelPhase[];
  labelsDoTime: TeamLabel[];
  /** Admin ou o coach do jogador -- único lugar que cria/remove metas com prazo. */
  podeGerenciarMetas: boolean;
  /** false = banco sem a migração: esconde próximo passo e prioridade. */
  crmDisponivel: boolean;
  onFechar: () => void;
  onChange: () => void;
  onErro: (s: string) => void;
  onAgendarConversa: () => void;
  /** Sobe pra próxima fase (quem chama confirma quando faltar requisito). */
  onPromover: () => Promise<void> | void;
}) {
  const { card, fase: faseAtual } = item;
  const idx = fases.findIndex((f) => f.id === card.phaseId);
  const proxima = idx >= 0 ? fases[idx + 1] : undefined;

  const [fase, setFase] = useState(card.phaseId);
  const [passo, setPasso] = useState(card.nextStep ?? "");
  const [passoEm, setPassoEm] = useState(isoParaLocal(card.nextStepAt));
  const [prioridade, setPrioridade] = useState<Prioridade>(card.prioridade);
  const [prazo, setPrazo] = useState(card.deadline ?? "");
  const [notas, setNotas] = useState(card.notes ?? "");
  const [drillsAlvo, setDrillsAlvo] = useState(card.drillsTarget);
  const [reviewsAlvo, setReviewsAlvo] = useState(card.reviewsTarget);
  const [statMetric, setStatMetric] = useState<StatMetric | "">(card.statMetric ?? "");
  const [statAlvo, setStatAlvo] = useState<number | "">(card.statTarget ?? "");
  const [salvando, setSalvando] = useState(false);

  const [labelsAtivas, setLabelsAtivas] = useState<Set<string>>(new Set());
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const [carregandoExtras, setCarregandoExtras] = useState(true);

  const [confirmarArquivar, setConfirmarArquivar] = useState(false);
  const [arquivando, setArquivando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [lbl, chk] = await Promise.all([
          fetchCardLabels(card.cardId).catch(() => []),
          fetchChecklist(card.cardId).catch(() => []),
        ]);
        if (!ativo) return;
        setLabelsAtivas(new Set(lbl.map((l) => l.id)));
        setChecklist(chk);
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
    if (ativa) next.delete(labelId);
    else next.add(labelId);
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

  async function alternarItem(ck: ChecklistItem) {
    setChecklist((prev) => prev.map((i) => (i.id === ck.id ? { ...i, done: !i.done } : i)));
    try {
      await toggleChecklistItem(ck.id, !ck.done);
    } catch (e) {
      setChecklist((prev) => prev.map((i) => (i.id === ck.id ? { ...i, done: ck.done } : i)));
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

  async function gravarDetalhes() {
    // Metas só viram "fixas" do jogador quando o coach mexeu nelas. Antes
    // o cartão sempre regravava -- e ao trocar de fase pelo cartão, a
    // meta da fase ANTIGA ficava presa no jogador.
    const statNova = statMetric === "" ? null : statMetric;
    const statAlvoNovo = statAlvo === "" ? null : Number(statAlvo);
    const statMudou = statNova !== card.statMetric || statAlvoNovo !== card.statTarget;
    await updateCardDetails(card.playerId, {
      notes: notas,
      ...(drillsAlvo !== card.drillsTarget ? { drillsTargetOverride: drillsAlvo } : {}),
      ...(reviewsAlvo !== card.reviewsTarget ? { reviewsTargetOverride: reviewsAlvo } : {}),
      ...(statMudou ? { statMetricOverride: statNova, statTargetOverride: statAlvoNovo } : {}),
      nextStep: passo,
      nextStepAt: passo.trim() ? localParaIso(passoEm) : null,
      deadline: prazo || null,
      prioridade,
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      if (fase !== card.phaseId) await movePlayerCard(card.playerId, fase);
      await gravarDetalhes();
      onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setSalvando(false);
    }
  }

  // Subir não pode perder o que foi digitado: grava antes de mover.
  async function subir() {
    setSalvando(true);
    try {
      await gravarDetalhes();
      await onPromover();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setSalvando(false);
    }
  }

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

  const faixa = faseAtual ? faixaBuyin(faseAtual) : null;
  const acimaDaFaixa = foraDaFaixa(card.abiTorneio ?? item.jogador?.abiTorneio ?? null, faseAtual);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Cartão de ${item.nome}`}
          className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-hairline bg-surface p-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho: crachá + onde está + há quanto tempo */}
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-[220px] flex-1">
              <PlayerBadge dados={crachaDoItem(item)} variante="compacto" />
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-[11.5px] font-medium">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: card.phaseColor }} />
                {card.phaseName}
                {faixa && <span className="text-muted">· {faixa}</span>}
              </span>
              <span
                className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium tabular-nums"
                style={{ color: TEMPERATURA_COR[item.temperatura], borderColor: `${TEMPERATURA_COR[item.temperatura]}55` }}
                title={`Esfria com ${slaDaFase(faseAtual)} dias parado nesta fase`}
              >
                {TEMPERATURA_LABEL[item.temperatura]} · {item.diasNaFase}d
              </span>
              <Link
                href={`/time/jogador/${card.playerId}`}
                title="Abrir ficha completa"
                className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-white/25 hover:text-ink"
              >
                <ExternalLink size={14} />
              </Link>
              <button onClick={onFechar} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
            <div className="space-y-5">
              {/* 1) Próximo passo */}
              {crmDisponivel ? (
                <section className={`rounded-xl border p-3.5 ${passo.trim() ? "border-hairline bg-elevated/40" : "border-negative/40 bg-negative/[0.06]"}`}>
                  <label htmlFor="funil-passo" className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    <CornerDownRight size={12} /> Próximo passo
                  </label>
                  <input
                    id="funil-passo"
                    value={passo}
                    onChange={(e) => setPasso(e.target.value)}
                    maxLength={140}
                    placeholder="Ex.: revisar 10 mãos de ICM juntos, subir pro R$ 33…"
                    className={INPUT}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <input
                      type="datetime-local"
                      value={passoEm}
                      onChange={(e) => setPassoEm(e.target.value)}
                      aria-label="Quando"
                      className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[12.5px] text-ink outline-none [color-scheme:dark]"
                    />
                    {ATALHOS_DATA.map((a) => (
                      <button
                        key={a.rotulo}
                        type="button"
                        onClick={() => setPassoEm(daquiA(a.dias))}
                        className="rounded-lg border border-hairline px-2.5 py-1.5 text-[12px] text-muted transition-colors hover:border-white/25 hover:text-ink"
                      >
                        {a.rotulo}
                      </button>
                    ))}
                  </div>
                  {!passo.trim() && (
                    <p className="mt-2 text-[11.5px] text-[#f08a8e]">Todo jogador precisa de um próximo passo — é o que impede ele de ficar esquecido no quadro.</p>
                  )}
                </section>
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[12px] text-muted">
                  <Database size={13} className="shrink-0" />
                  Próximo passo, prioridade e requisitos de subida aparecem depois da atualização do banco do funil.
                </p>
              )}

              {/* 2) Pode subir? */}
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {proxima ? <>Requisitos para subir para {proxima.name}</> : "Requisitos da fase"}
                  </label>
                  {item.prontidao.total > 0 && (
                    <span className={`text-[12px] font-semibold tabular-nums ${item.prontidao.pronto ? "text-positive" : "text-muted"}`}>
                      {item.prontidao.cumpridos}/{item.prontidao.total}
                    </span>
                  )}
                </div>
                {item.requisitos.length === 0 ? (
                  <p className="text-[12.5px] text-muted">Esta fase não tem requisitos. O admin define em Configurações do funil.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {item.requisitos.map((r) => (
                      <li key={r.chave} className="flex items-center gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2">
                        {r.ok ? <Check size={14} className="shrink-0 text-positive" /> : <Circle size={14} className="shrink-0 text-muted/60" />}
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink/90 sm:w-32 sm:flex-none">{r.rotulo}</span>
                        <span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07] sm:block" aria-hidden>
                          <span className={`block h-full rounded-full ${r.ok ? "bg-positive" : "bg-white/45"}`} style={{ width: `${r.progresso * 100}%` }} />
                        </span>
                        <span className="shrink-0 text-right text-[12px] tabular-nums text-muted sm:w-24">
                          <span className={r.ok ? "font-semibold text-positive" : "font-semibold text-ink"}>{r.atual}</span> / {r.alvo}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {acimaDaFaixa && (
                  <p className="mt-2 text-[11.5px] text-[#f59e0b]">
                    Buy-in médio {acimaDaFaixa === "acima" ? "acima" : "abaixo"} da faixa desta fase ({faixa}).
                  </p>
                )}
                {proxima && (
                  <button
                    type="button"
                    onClick={subir}
                    disabled={salvando}
                    className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      item.prontidao.pronto
                        ? "bg-positive text-void hover:opacity-90"
                        : "border border-hairline text-muted hover:border-white/25 hover:text-ink"
                    }`}
                  >
                    <ArrowUpRight size={15} />
                    {item.prontidao.pronto ? `Subir para ${proxima.name}` : `Subir para ${proxima.name} mesmo assim`}
                  </button>
                )}
              </section>

              {/* 3) Fase, prioridade, prazo */}
              <div className={`grid gap-3 ${crmDisponivel ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
                <Campo label="Fase">
                  <select value={fase} onChange={(e) => setFase(e.target.value)} className={INPUT}>
                    {fases.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </Campo>
                {crmDisponivel && (
                  <Campo label="Prioridade">
                    <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)} className={INPUT}>
                      {(["alta", "normal", "baixa"] as Prioridade[]).map((p) => (
                        <option key={p} value={p}>{PRIORIDADE_LABEL[p]}</option>
                      ))}
                    </select>
                  </Campo>
                )}
                <Campo label="Prazo da fase">
                  <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={`${INPUT} [color-scheme:dark]`} />
                </Campo>
              </div>

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
                          aria-pressed={ativa}
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
                    {checklist.map((ck) => (
                      <li key={ck.id} className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5">
                        <button type="button" onClick={() => alternarItem(ck)} className="shrink-0 text-muted hover:text-ink" aria-label={ck.done ? "Desmarcar" : "Marcar"}>
                          {ck.done ? <CheckCircle2 size={16} className="text-positive" /> : <Circle size={16} />}
                        </button>
                        <span className={`min-w-0 flex-1 text-[13px] ${ck.done ? "text-muted line-through" : "text-ink"}`}>{ck.text}</span>
                        <button type="button" onClick={() => removerItem(ck.id)} className="shrink-0 text-muted hover:text-negative" aria-label="Remover item">
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
                  <button type="button" onClick={adicionarItem} disabled={!novoItem.trim()} aria-label="Adicionar item"
                    className="shrink-0 rounded-lg border border-hairline px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 disabled:opacity-40">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="Meta de drills">
                  <input type="number" min={0} value={drillsAlvo} onChange={(e) => setDrillsAlvo(Number(e.target.value))} className={INPUT} />
                </Campo>
                <Campo label="Meta de reviews">
                  <input type="number" min={0} value={reviewsAlvo} onChange={(e) => setReviewsAlvo(Number(e.target.value))} className={INPUT} />
                </Campo>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Campo label="Stat (opcional)">
                  <select value={statMetric} onChange={(e) => setStatMetric(e.target.value as StatMetric | "")} className={INPUT}>
                    <option value="">Nenhuma</option>
                    <option value="vpip">VPIP</option>
                    <option value="pfr">PFR</option>
                    <option value="three_bet">3-bet</option>
                  </select>
                </Campo>
                <Campo label="Meta (%)">
                  <input type="number" min={0} max={100} value={statAlvo} onChange={(e) => setStatAlvo(e.target.value === "" ? "" : Number(e.target.value))}
                    disabled={!statMetric} className={`${INPUT} disabled:opacity-40`} />
                </Campo>
              </div>
              {card.statMetric && (
                <p className="-mt-3 text-[11.5px] text-muted">
                  Hoje: {card.statValue ?? "—"}%. Se a meta é subir ou descer esse número é leitura do coach.
                </p>
              )}

              {/* Metas com prazo -- continua sendo o único lugar do produto que cria/edita. */}
              <MetasCard playerId={card.playerId} podeGerenciar={podeGerenciarMetas} />

              <Campo label="Anotação de evolução">
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} maxLength={500}
                  placeholder="Feedback, próximos passos, combinados com o jogador…"
                  className={`${INPUT} resize-none placeholder:text-muted/50`} />
              </Campo>

              {card.eventosTotal > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <CalendarCheck size={13} />
                  {card.eventosPresente} presenças e {card.eventosAusente} faltas em {card.eventosTotal} eventos desde que entrou nesta fase.
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={onAgendarConversa} type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/40">
                  <CalendarPlus size={16} />
                  Agendar conversa
                </button>
                <button onClick={salvar} disabled={salvando}
                  className="flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50">
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </div>

              {/* Sair do funil ativo sem perder histórico (vai pra Arquivados). */}
              <div className="border-t border-hairline pt-4">
                {!confirmarArquivar ? (
                  <button onClick={() => setConfirmarArquivar(true)} type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-hairline px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-ink/40 hover:text-ink">
                    <ArchiveRestore size={15} />
                    Sair do funil
                  </button>
                ) : (
                  <div className="rounded-lg border border-hairline bg-elevated p-3">
                    <p className="text-[13px] text-ink/85">O que fazer com {item.nome}?</p>
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
                      <button onClick={() => setConfirmarArquivar(false)} type="button" className="rounded-lg px-3 py-1.5 text-[12px] text-muted hover:text-ink">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-0">
              <AbaInteracoes cardId={card.cardId} playerId={card.playerId} onErro={onErro} />
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
