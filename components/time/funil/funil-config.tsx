"use client";

import { useState } from "react";
import { ArchiveRestore, ChevronDown, ChevronUp, Database, Pencil, Plus, Settings, Trash2, X } from "lucide-react";
import { AvatarNivel } from "@/components/avatar-nivel";
import { Chip } from "@/components/chip";
import { Campo } from "@/components/time/campo";
import { ModalPortal } from "@/components/modal-portal";
import { useConfirm } from "@/components/confirm-dialog";
import { ACCENT } from "@/lib/modules-data";
import {
  createPhase,
  deletePhase,
  movePlayerCard,
  swapPhaseOrder,
  traduzErroFunil,
  updateFunilSlaPadrao,
  updatePhase,
  ARCHIVE_REASON_LABEL,
  type ArchivedCard,
  type FunnelPhase,
  type PhasePatch,
} from "@/lib/services/team-funnel-service";
import type { TeamDashboardRow } from "@/lib/services/team-service";
import { faixaBuyin } from "@/lib/time/funil-regras";

const INPUT = "w-full rounded-lg border border-hairline bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-white/25";

function Modal({ titulo, icone, largura = "max-w-lg", onFechar, children }: {
  titulo: string;
  icone?: React.ReactNode;
  largura?: string;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 grid place-items-center bg-void/70 p-4" onClick={onFechar}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className={`max-h-[90vh] w-full ${largura} overflow-y-auto rounded-2xl border border-hairline bg-surface p-5`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              {icone}
              {titulo}
            </h2>
            <button onClick={onFechar} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}

// ------------------------------------------------------------
// Configurações do funil (só admin -- mesma regra da RLS das fases)
// ------------------------------------------------------------

// Campo numérico opcional: vazio = "não usa".
function NumOpcional({ label, valor, onChange, sufixo, min = 0, max, ajuda }: {
  label: string;
  valor: number | null;
  onChange: (v: number | null) => void;
  sufixo?: string;
  min?: number;
  max?: number;
  ajuda?: string;
}) {
  return (
    <label className="block text-[11px] text-muted" title={ajuda}>
      {label}
      <span className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={valor ?? ""}
          placeholder="—"
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={`${INPUT} py-1.5 placeholder:text-muted/40`}
        />
        {sufixo && <span className="shrink-0 text-[11px] text-muted/70">{sufixo}</span>}
      </span>
    </label>
  );
}

function resumoFase(f: FunnelPhase): string {
  const partes: string[] = [];
  const faixa = faixaBuyin(f);
  if (faixa) partes.push(faixa);
  if (f.wipLimit != null) partes.push(`cap. ${f.wipLimit}`);
  if (f.slaDias != null) partes.push(`esfria em ${f.slaDias}d`);
  const reqs = [f.defaultDrillsTarget > 0, f.defaultReviewsTarget > 0, f.reqSessoes, f.reqRoiPct != null, f.reqScore, f.reqPresencaPct].filter(Boolean).length;
  if (reqs > 0) partes.push(`${reqs} requisito${reqs === 1 ? "" : "s"}`);
  if (f.playbook.length > 0) partes.push(`playbook ${f.playbook.length}`);
  return partes.join(" · ");
}

function EditorFase({ fase, crmDisponivel, slaPadrao, onCancelar, onSalvar }: {
  fase: FunnelPhase;
  crmDisponivel: boolean;
  slaPadrao: number;
  onCancelar: () => void;
  onSalvar: (patch: PhasePatch) => Promise<void>;
}) {
  const [d, setD] = useState({
    name: fase.name,
    color: fase.color,
    defaultDrillsTarget: fase.defaultDrillsTarget,
    defaultReviewsTarget: fase.defaultReviewsTarget,
    descricao: fase.descricao ?? "",
    buyinMin: fase.buyinMin,
    buyinMax: fase.buyinMax,
    wipLimit: fase.wipLimit,
    slaDias: fase.slaDias,
    reqSessoes: fase.reqSessoes,
    reqRoiPct: fase.reqRoiPct,
    reqScore: fase.reqScore,
    reqPresencaPct: fase.reqPresencaPct,
    playbook: fase.playbook.join("\n"),
  });
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const faixaInvalida = d.buyinMin != null && d.buyinMax != null && d.buyinMin > d.buyinMax;

  async function salvar() {
    if (!d.name.trim() || faixaInvalida) return;
    setSalvando(true);
    try {
      await onSalvar({
        name: d.name,
        color: d.color,
        defaultDrillsTarget: d.defaultDrillsTarget,
        defaultReviewsTarget: d.defaultReviewsTarget,
        ...(crmDisponivel
          ? {
              descricao: d.descricao,
              buyinMin: d.buyinMin,
              buyinMax: d.buyinMax,
              wipLimit: d.wipLimit && d.wipLimit > 0 ? d.wipLimit : null,
              slaDias: d.slaDias && d.slaDias > 0 ? d.slaDias : null,
              reqSessoes: d.reqSessoes,
              reqRoiPct: d.reqRoiPct,
              reqScore: d.reqScore,
              reqPresencaPct: d.reqPresencaPct,
              playbook: d.playbook.split("\n"),
            }
          : {}),
      });
    } finally {
      setSalvando(false);
    }
  }

  const secao = "text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted/70";

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <input value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={30} aria-label="Nome da fase" className={INPUT} />
        <div className="flex gap-1.5">
          {Object.values(ACCENT).map((c) => (
            <button key={c} type="button" onClick={() => set("color", c)} aria-label={`Cor ${c}`} aria-pressed={d.color === c}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${d.color === c ? "ring-2 ring-ink ring-offset-2 ring-offset-elevated" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        {crmDisponivel && (
          <input value={d.descricao} onChange={(e) => set("descricao", e.target.value)} maxLength={120}
            placeholder="Para que serve esta fase (aparece ao passar o mouse no quadro)"
            className={`${INPUT} placeholder:text-muted/40`} />
        )}
      </div>

      {crmDisponivel && (
        <div className="space-y-2">
          <p className={secao}>Nível e capacidade</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <NumOpcional label="Buy-in mín." valor={d.buyinMin} onChange={(v) => set("buyinMin", v)} sufixo="R$" />
            <NumOpcional label="Buy-in máx." valor={d.buyinMax} onChange={(v) => set("buyinMax", v)} sufixo="R$" />
            <NumOpcional label="Capacidade" valor={d.wipLimit} onChange={(v) => set("wipLimit", v)} min={1} ajuda="Quantos jogadores cabem nesta fase" />
            <NumOpcional label="Esfria em" valor={d.slaDias} onChange={(v) => set("slaDias", v)} min={1} sufixo="dias" ajuda={`Dias parado até o cartão esfriar (vazio = padrão do funil, ${slaPadrao} dias)`} />
          </div>
          {faixaInvalida && <p className="text-[11.5px] text-negative">O buy-in mínimo está maior que o máximo.</p>}
        </div>
      )}

      <div className="space-y-2">
        <p className={secao}>Requisitos para subir</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <NumOpcional label="Drills" valor={d.defaultDrillsTarget} onChange={(v) => set("defaultDrillsTarget", v ?? 0)} />
          <NumOpcional label="Reviews" valor={d.defaultReviewsTarget} onChange={(v) => set("defaultReviewsTarget", v ?? 0)} />
          {crmDisponivel && (
            <>
              <NumOpcional label="Sessões na fase" valor={d.reqSessoes} onChange={(v) => set("reqSessoes", v)} ajuda="Sessões registradas na Banca desde que entrou na fase" />
              <NumOpcional label="ROI mínimo" valor={d.reqRoiPct} onChange={(v) => set("reqRoiPct", v)} min={-100} sufixo="%" ajuda="ROI de carreira" />
              <NumOpcional label="Score mínimo" valor={d.reqScore} onChange={(v) => set("reqScore", v)} max={100} ajuda="Score de evolução (0-100)" />
              <NumOpcional label="Presença mín." valor={d.reqPresencaPct} onChange={(v) => set("reqPresencaPct", v)} max={100} sufixo="%" ajuda="Presença nos eventos do time desde que entrou na fase" />
            </>
          )}
        </div>
        <p className="text-[11px] text-muted/70">Vazio ou zero = não conta. O cartão acende “pronto pra subir” quando bate todos.</p>
      </div>

      {crmDisponivel && (
        <div className="space-y-2">
          <p className={secao}>Playbook da fase</p>
          <textarea value={d.playbook} onChange={(e) => set("playbook", e.target.value)} rows={3}
            placeholder={"Um item por linha. Viram checklist quando o jogador entra na fase.\nEx.: Conversa de boas-vindas\nDefinir grade de torneios"}
            className={`${INPUT} resize-y placeholder:text-muted/40`} />
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="flex-1 rounded-lg border border-hairline px-3 py-2 text-[12.5px] text-ink hover:border-ink/40">Cancelar</button>
        <button type="button" onClick={salvar} disabled={salvando || !d.name.trim() || faixaInvalida}
          className="flex-1 rounded-lg bg-ink px-3 py-2 text-[12.5px] font-semibold text-void disabled:opacity-50">
          {salvando ? "Salvando…" : "Salvar fase"}
        </button>
      </div>
    </div>
  );
}

export function ModalConfigFunil({ teamId, fases, crmDisponivel, slaPadrao, onFechar, onChange, onErro }: {
  teamId: string;
  fases: FunnelPhase[];
  crmDisponivel: boolean;
  /** Prazo padrão do funil (teams.funil_sla_dias). */
  slaPadrao: number;
  onFechar: () => void;
  onChange: () => Promise<void> | void;
  onErro: (s: string) => void;
}) {
  const confirm = useConfirm();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaFase, setNovaFase] = useState("");
  const [criando, setCriando] = useState(false);
  const [sla, setSla] = useState<number | null>(slaPadrao);
  const [salvandoSla, setSalvandoSla] = useState(false);
  const slaValido = sla != null && sla >= 1 && sla <= 365;

  async function salvarSla() {
    if (!slaValido || sla === slaPadrao) return;
    setSalvandoSla(true);
    try {
      await updateFunilSlaPadrao(teamId, sla);
      await onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setSalvandoSla(false);
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
      // sort_order depois da última fase (não o tamanho da lista: pode haver buraco).
      const ordem = fases.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
      await createPhase(teamId, novaFase, ACCENT.blue, ordem);
      setNovaFase("");
      await onChange();
    } catch (e) {
      onErro(traduzErroFunil(e));
    } finally {
      setCriando(false);
    }
  }

  return (
    <Modal titulo="Configurações do funil" icone={<Settings size={17} />} largura="max-w-2xl" onFechar={onFechar}>
      <p className="mt-1 text-[13px] text-muted">Fases na ordem do quadro. Cada fase pode ter faixa de buy-in, capacidade, requisitos de subida e um playbook.</p>
      {!crmDisponivel && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[12px] text-muted">
          <Database size={13} className="shrink-0" />
          Faixa de buy-in, capacidade, requisitos avançados e playbook aparecem depois da atualização do banco do funil.
        </p>
      )}

      {crmDisponivel && (
        <section className="mt-4 rounded-xl border border-hairline bg-elevated p-3">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted/70">Padrão do funil</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink/90">
            <label htmlFor="funil-sla-padrao">Cartão esfria depois de</label>
            <input
              id="funil-sla-padrao"
              type="number"
              min={1}
              max={365}
              value={sla ?? ""}
              onChange={(e) => setSla(e.target.value === "" ? null : Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && salvarSla()}
              className="w-20 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm tabular-nums text-ink outline-none focus:border-white/25"
            />
            <span>dias parado na fase</span>
            <button
              type="button"
              onClick={salvarSla}
              disabled={salvandoSla || !slaValido || sla === slaPadrao}
              className="ml-auto rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-void disabled:opacity-30"
            >
              {salvandoSla ? "Salvando…" : "Salvar"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted/70">
            {slaValido
              ? `Vale para as fases sem prazo próprio. Com o dobro (${(sla as number) * 2} dias), o cartão passa de “esfriando” para “parado”.`
              : "Use um número entre 1 e 365."}
          </p>
        </section>
      )}

      <ul className="mt-4 space-y-2">
        {fases.map((f, idx) => (
          <li key={f.id} className="rounded-xl border border-hairline bg-elevated p-3">
            {editandoId === f.id ? (
              <EditorFase
                fase={f}
                crmDisponivel={crmDisponivel}
                slaPadrao={slaPadrao}
                onCancelar={() => setEditandoId(null)}
                onSalvar={async (patch) => {
                  try {
                    await updatePhase(f.id, patch);
                    setEditandoId(null);
                    await onChange();
                  } catch (e) {
                    onErro(traduzErroFunil(e));
                  }
                }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{f.name}</span>
                  {resumoFase(f) && <span className="block truncate text-[11px] tabular-nums text-muted">{resumoFase(f)}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button onClick={() => mover(f, -1)} disabled={idx === 0} aria-label={`Subir ${f.name} na ordem`}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-20">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => mover(f, 1)} disabled={idx === fases.length - 1} aria-label={`Descer ${f.name} na ordem`}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-20">
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => setEditandoId(f.id)} aria-label={`Editar ${f.name}`}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-ink">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => excluir(f)} aria-label={`Excluir ${f.name}`}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-negative">
                    <Trash2 size={13} />
                  </button>
                </span>
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
    </Modal>
  );
}

// ------------------------------------------------------------
// Adicionar ao funil -- vários de uma vez (time novo entra inteiro)
// ------------------------------------------------------------

export function ModalAdicionar({ jogadores, fases, onFechar, onChange, onErro }: {
  jogadores: TeamDashboardRow[];
  fases: FunnelPhase[];
  onFechar: () => void;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [fase, setFase] = useState(fases[0]?.id ?? "");
  const [salvando, setSalvando] = useState(false);

  const todos = jogadores.length > 0 && selecionados.size === jogadores.length;

  function alternar(id: string) {
    setSelecionados((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function adicionar() {
    if (selecionados.size === 0 || !fase) return;
    setSalvando(true);
    let falhas = 0;
    for (const id of selecionados) {
      try {
        await movePlayerCard(id, fase);
      } catch {
        falhas += 1;
      }
    }
    setSalvando(false);
    if (falhas > 0) onErro(`${falhas} jogador${falhas === 1 ? "" : "es"} não ${falhas === 1 ? "pôde" : "puderam"} ser adicionado${falhas === 1 ? "" : "s"}. Tente de novo.`);
    onChange();
  }

  return (
    <Modal titulo="Adicionar ao funil" largura="max-w-md" onFechar={onFechar}>
      {jogadores.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Todos os jogadores já estão no funil.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Jogadores</span>
              <button type="button" onClick={() => setSelecionados(todos ? new Set() : new Set(jogadores.map((j) => j.userId)))}
                className="text-[11.5px] font-semibold text-muted hover:text-ink">
                {todos ? "Limpar" : "Selecionar todos"}
              </button>
            </div>
            <ul className="painel-scroll max-h-64 space-y-1 overflow-y-auto pr-1">
              {jogadores.map((j) => {
                const marcado = selecionados.has(j.userId);
                return (
                  <li key={j.userId}>
                    <label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${marcado ? "border-white/25 bg-white/[0.04]" : "border-hairline hover:border-white/15"}`}>
                      <input type="checkbox" checked={marcado} onChange={() => alternar(j.userId)} className="accent-white" />
                      <AvatarNivel userId={j.userId} avatarId={j.avatarId} avatarUrl={j.avatarUrl} tamanho={28} />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{j.nome}</span>
                      {j.labelName && <span className="shrink-0 text-[11px]" style={{ color: j.labelColor ?? undefined }}>{j.labelName}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
          <Campo label="Fase inicial">
            <select value={fase} onChange={(e) => setFase(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none">
              {fases.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Campo>
          <button onClick={adicionar} disabled={salvando || selecionados.size === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50">
            <Plus size={16} strokeWidth={2.5} />
            {salvando ? "Adicionando…" : selecionados.size > 1 ? `Adicionar ${selecionados.size} jogadores` : "Adicionar"}
          </button>
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------
// Arquivados: quem saiu do funil ativo (formado ou removido), sem sumir
// da vista -- restaurar manda de volta pra uma fase escolhida.
// ------------------------------------------------------------

export function ListaArquivados({ arquivados, carregando, fases, onRestaurar, onErro }: {
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
    <section className="painel-scroll min-h-0 flex-1 overflow-y-auto rounded-xl border border-hairline bg-surface p-5">
      <ul className="divide-y divide-hairline">
        {arquivados.map((a) => (
          <li key={a.cardId} className="flex flex-wrap items-center gap-3 py-3.5">
            <AvatarNivel userId={a.playerId} avatarId={a.avatarId} avatarUrl={a.avatarUrl} tamanho={38} />
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
                aria-label={`Fase para restaurar ${a.nome}`}
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
