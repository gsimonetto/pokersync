"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare, Save, Trash2, Download, Check, Users, X, History, FolderOpen, ChevronDown, ChevronUp, Percent } from "lucide-react";
import { RangeGrid, getDecision, type RangeHands } from "@/components/ranges/range-grid";
import { BoardAnalyzer } from "@/components/ranges/board-analyzer";
import { MotorLibraryPanel } from "@/components/ranges/motor-library-panel";
import { RangeVersionHistory } from "@/components/ranges/range-version-history";
import { ComboEditorModal } from "@/components/ranges/combo-editor-modal";
import { RangeListModal } from "@/components/ranges/range-list-modal";
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
export function RangeEditor({ id }: { id: string }) {
  const router = useRouter();
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
    if (!confirm("Excluir este range? Essa ação não pode ser desfeita.")) return;
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

      {/* Barra compacta: nome + tags + acoes, tudo numa linha so — o
          Salvar fica sempre visivel sem precisar rolar a pagina. */}
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

        <button
          onClick={() => setShowMyRanges(true)}
          title="Meus ranges"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted hover:text-ink"
        >
          <FolderOpen size={16} />
        </button>
        <button
          onClick={handleExport}
          title="Exportar (copiar JSON)"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted hover:text-ink"
        >
          {exported ? <Check size={16} className="text-positive" /> : <Download size={16} />}
        </button>
        {rangeId && myTeam && (
          <button
            onClick={teamId ? handleUnpublish : handlePublish}
            disabled={publishing}
            title={teamId ? `Publicado no time ${myTeam.team.name} — clique pra remover` : `Publicar no time ${myTeam.team.name}`}
            className={`grid h-9 w-9 place-items-center rounded-lg border disabled:opacity-50 ${
              teamId ? "border-positive text-positive" : "border-hairline bg-elevated text-muted hover:text-ink"
            }`}
          >
            {teamId ? <X size={16} /> : <Users size={16} />}
          </button>
        )}
        {rangeId && (
          <>
            <button
              onClick={() => setShowHistory(true)}
              title="Histórico de versões"
              className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted hover:text-ink"
            >
              <History size={16} />
            </button>
            <button
              onClick={() => router.push(`/ranges/compare?a=${rangeId}`)}
              title="Comparar"
              className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted hover:text-ink"
            >
              <GitCompare size={16} />
            </button>
            <button
              onClick={handleDelete}
              title="Excluir"
              className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-negative"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
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
          sobrava vazio ao lado da grade. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:shrink-0">
          <RangeGrid
            value={hands}
            onChange={setHands}
            labelsWithOverrides={labelsWithOverrides}
            onOpenComboEditor={setEditingComboLabel}
          />
        </div>

        <div className="grid w-full flex-1 gap-4 lg:sticky lg:top-4 lg:grid-cols-2 lg:items-start xl:grid-cols-[460px_1fr]">
          <div className="space-y-2">
            <BoardAnalyzer hands={hands} comboOverrides={comboOverrides} startOpen />
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
      </div>

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
