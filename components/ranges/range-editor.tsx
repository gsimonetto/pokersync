"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GitCompare,
  Save,
  Trash2,
  Download,
  Check,
  Users,
  X,
  History,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Percent,
  Maximize2,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Library,
} from "lucide-react";
import { RangeGrid, getDecision, type RangeHands } from "@/components/ranges/range-grid";
import { useConfirm } from "@/components/confirm-dialog";
import { BoardAnalyzer } from "@/components/ranges/board-analyzer";
import { MultiBoardAnalyzer } from "@/components/ranges/multi-board-analyzer";
import { MotorLibraryPanel } from "@/components/ranges/motor-library-panel";
import { RangeVersionHistory } from "@/components/ranges/range-version-history";
import { ComboEditorModal } from "@/components/ranges/combo-editor-modal";
import { RangeListModal } from "@/components/ranges/range-list-modal";
import { RangeLibraryModal } from "@/components/ranges/range-library-modal";
import { TagPicker } from "@/components/shared/tag-picker";
import { labelForComboKey } from "@/lib/poker/range-board-analyzer";
import {
  createRange,
  deleteRange,
  exportRangeToJSON,
  getRange,
  publishRangeToTeam,
  unpublishRange,
  updateRange,
} from "@/lib/services/range-service";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";

// id === "novo" -> cria um range vazio (nao existe ainda no banco, so
// e' persistido no primeiro Salvar). Qualquer outro valor e' um uuid
// real, carregado do Supabase.
export function RangeEditor({ id, tabs }: { id: string; tabs?: React.ReactNode }) {
  const router = useRouter();
  const confirm = useConfirm();
  const isNew = id === "novo";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [hands, setHands] = useState<RangeHands>({});
  const [comboOverrides, setComboOverrides] = useState<RangeHands>({});
  const [editingComboLabel, setEditingComboLabel] = useState<string | null>(null);
  const [rangeId, setRangeId] = useState<string | null>(isNew ? null : id);
  const [exported, setExported] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [showMyRanges, setShowMyRanges] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExpandedGrid, setShowExpandedGrid] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    fetchMyTeam().then(setMyTeam).catch(() => {});
  }, []);

  async function handlePublish() {
    if (!rangeId || !myTeam) return;
    setPublishing(true);
    try {
      await publishRangeToTeam(rangeId, myTeam.team.id);
      setTeamId(myTeam.team.id);
    } catch {
      setError("Erro ao publicar pro time.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!rangeId) return;
    setPublishing(true);
    try {
      await unpublishRange(rangeId);
      setTeamId(null);
    } catch {
      setError("Erro ao remover a publicação.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleExport() {
    const json = exportRangeToJSON({ name: name.trim() || "Range sem nome", description: description.trim() || null, tags, hands, comboOverrides });
    try {
      await navigator.clipboard.writeText(json);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch {
      setError("Não consegui copiar automaticamente — copie manualmente pelo console do navegador.");
    }
  }

  useEffect(() => {
    if (isNew) return;
    loadRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  async function loadRange() {
    try {
      const r = await getRange(id);
      setName(r.name);
      setDescription(r.description ?? "");
      setShowDescription(Boolean(r.description));
      setTags(r.tags);
      setHands(r.hands);
      setComboOverrides(r.comboOverrides);
      setTeamId(r.team_id);
    } catch {
      setError("Range não encontrado.");
    } finally {
      setLoading(false);
    }
  }

  const labelsWithOverrides = useMemo(() => {
    const set = new Set<string>();
    for (const key of Object.keys(comboOverrides)) {
      const label = labelForComboKey(key);
      if (label) set.add(label);
    }
    return set;
  }, [comboOverrides]);

  async function handleSave() {
    if (!name.trim()) {
      setError("Dê um nome para o range antes de salvar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (rangeId) {
        await updateRange(rangeId, { name: name.trim(), description: description.trim() || null, hands, tags, comboOverrides });
      } else {
        const created = await createRange({ name: name.trim(), description: description.trim() || null, hands, tags, comboOverrides });
        setRangeId(created.id);
        // Troca a URL "novo" pela URL real, sem perder o estado em tela.
        router.replace(`/ranges/${created.id}`);
      }
    } catch {
      setError("Erro ao salvar o range.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!rangeId) return;
    if (!(await confirm({ title: "Excluir range", message: "Essa ação não pode ser desfeita.", confirmLabel: "Excluir" }))) return;
    try {
      await deleteRange(rangeId);
      router.push("/ranges");
    } catch {
      setError("Erro ao excluir o range.");
    }
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    <div>
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}

      {/* Container unico envolvendo toda a ferramenta (barra + grade +
          analise) -- antes cada pedaco flutuava solto contra o void,
          sem nada amarrando visualmente que aquilo e' uma unica tela,
          diferente do Treino/Banca (que sempre tiveram um card unico). */}
      <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      {tabs && <div className="mb-4">{tabs}</div>}

      {/* Breadcrumb: onde eu estou, sem depender do menu lateral pra
          saber (ele so' diz o modulo, nao "estou dentro de um range"). */}
      <div className="mb-2 flex items-center gap-1 text-xs text-muted">
        <Link href="/ranges" className="hover:text-ink">
          Ranges
        </Link>
        <ChevronRight size={12} />
        <span className="text-ink">{name.trim() || (isNew ? "Novo range" : "Range sem nome")}</span>
      </div>

      {/* Barra compacta: nome + tags + acoes, tudo numa linha so — o
          Salvar fica sempre visivel sem precisar rolar a pagina. As
          acoes secundarias (meus ranges, exportar, publicar, historico,
          comparar, excluir) ficam atras de um "⋯" — eram 6-7 icones
          identicos competindo com o Salvar pela atencao. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do range — ex: BTN Open 40bb"
          className="min-w-[200px] flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm font-medium outline-none"
        />
        <div className="w-56 shrink-0">
          <TagPicker value={tags} onChange={setTags} />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Salvando…" : "Salvar"}
        </button>

        <div ref={moreMenuRef} className="relative shrink-0">
          <button
            onClick={() => setShowMoreMenu((v) => !v)}
            title="Mais ações"
            aria-pressed={showMoreMenu}
            className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted hover:text-ink"
          >
            <MoreHorizontal size={16} />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-hairline bg-surface p-1 shadow-lg">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowMyRanges(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-elevated"
              >
                <FolderOpen size={15} className="text-muted" />
                Meus ranges
              </button>
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  handleExport();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-elevated"
              >
                {exported ? <Check size={15} className="text-positive" /> : <Download size={15} className="text-muted" />}
                {exported ? "Copiado!" : "Exportar (copiar JSON)"}
              </button>
              {rangeId && myTeam && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    if (teamId) handleUnpublish();
                    else handlePublish();
                  }}
                  disabled={publishing}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-elevated disabled:opacity-50"
                >
                  <Users size={15} className={teamId ? "text-positive" : "text-muted"} />
                  {teamId ? `Publicado (${myTeam.team.name}) — remover` : `Publicar no time ${myTeam.team.name}`}
                </button>
              )}
              {rangeId && (
                <>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowHistory(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-elevated"
                  >
                    <History size={15} className="text-muted" />
                    Histórico de versões
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      router.push(`/ranges/compare?a=${rangeId}`);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-elevated"
                  >
                    <GitCompare size={15} className="text-muted" />
                    Comparar
                  </button>
                  <div className="my-1 border-t border-hairline" />
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleDelete();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-negative hover:bg-elevated"
                  >
                    <Trash2 size={15} />
                    Excluir range
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowDescription((v) => !v)}
        className="mb-3 flex items-center gap-1 text-xs text-muted hover:text-ink"
      >
        {showDescription ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {description ? "Descrição" : "+ Adicionar descrição"}
      </button>
      {showDescription && (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Anotações, conceito, observação do treinador…"
          className="mb-3 w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
        />
      )}

      {/* Grade + coluna lateral lado a lado — a lateral fica sempre
          visivel (sticky) pra nao precisar rolar a pagina pra baixo pra
          ver analise/biblioteca. Em telas largas a lateral vira 2
          colunas (analise + biblioteca do motor) pra usar o espaco que
          sobrava vazio ao lado da grade. O botao de esconder existe pra
          quem quer a grade sozinha, sem competir por espaco. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:shrink-0">
          <div className="mx-auto mb-2 flex items-center justify-end gap-2" style={{ maxWidth: 580 }}>
            <button
              type="button"
              onClick={() => setShowSidebar((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-muted hover:text-ink"
              title={showSidebar ? "Esconder análise/biblioteca" : "Mostrar análise/biblioteca"}
            >
              {showSidebar ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
              {showSidebar ? "Esconder análise" : "Mostrar análise"}
            </button>
            <button
              type="button"
              onClick={() => setShowExpandedGrid(true)}
              className="flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-xs text-muted hover:text-ink"
              title="Abrir a grade numa janela maior"
            >
              <Maximize2 size={13} />
              Expandir
            </button>
          </div>
          <RangeGrid
            value={hands}
            onChange={setHands}
            labelsWithOverrides={labelsWithOverrides}
            onOpenComboEditor={setEditingComboLabel}
          />
        </div>

        {showSidebar && (
          <div className="grid w-full flex-1 gap-4 lg:sticky lg:top-4 lg:grid-cols-2 lg:items-start xl:grid-cols-[460px_1fr]">
            <div className="space-y-2">
              <BoardAnalyzer hands={hands} comboOverrides={comboOverrides} startOpen />
              <MultiBoardAnalyzer hands={hands} comboOverrides={comboOverrides} />
              <a
                href={rangeId ? `/ranges/equidade?rangeId=${rangeId}` : "/ranges/equidade"}
                className="flex items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2.5 text-xs text-muted hover:text-ink"
              >
                <Percent size={14} />
                {rangeId ? "Calcular equidade desse range" : "Calcular equidade (salve o range primeiro)"}
              </a>
            </div>

            <MotorLibraryPanel onLoad={setHands} />
          </div>
        )}
      </div>
      </div>

      {showExpandedGrid && (
        // Mesmo estado (hands/onChange) da grade pequena — nao e' uma
        // copia, entao pintar aqui dentro ja' e' o range de verdade,
        // sem precisar de "aplicar"/"confirmar" ao fechar.
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowExpandedGrid(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-y-auto rounded-2xl border border-hairline bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{name.trim() || "Range sem nome"}</h3>
              <div className="flex items-center gap-2">
                <div className="w-56 shrink-0">
                  <TagPicker value={tags} onChange={setTags} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowLibrary(true)}
                  title="Biblioteca de ranges (time/coach e motor PokerSync)"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-2.5 text-xs text-muted hover:text-ink"
                >
                  <Library size={14} />
                  Biblioteca
                </button>
                <button onClick={() => setShowExpandedGrid(false)} className="text-muted hover:text-ink" title="Fechar">
                  <X size={18} />
                </button>
              </div>
            </div>
            <RangeGrid
              value={hands}
              onChange={setHands}
              labelsWithOverrides={labelsWithOverrides}
              onOpenComboEditor={setEditingComboLabel}
              maxWidthPx={720}
            />
          </div>
        </div>
      )}

      {showLibrary && <RangeLibraryModal onLoad={setHands} onClose={() => setShowLibrary(false)} />}

      {editingComboLabel && (
        <ComboEditorModal
          label={editingComboLabel}
          handDecision={getDecision(hands, editingComboLabel)}
          overrides={comboOverrides}
          onChange={setComboOverrides}
          onClose={() => setEditingComboLabel(null)}
        />
      )}

      {showMyRanges && <RangeListModal onClose={() => setShowMyRanges(false)} />}

      {showHistory && rangeId && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <RangeVersionHistory rangeId={rangeId} onRestored={loadRange} startOpen />
          </div>
        </div>
      )}
    </div>
  );
}
