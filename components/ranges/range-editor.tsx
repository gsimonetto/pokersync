"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare, Save, Trash2, Download, Check, Users, X } from "lucide-react";
import { RangeGrid, getDecision, type RangeHands } from "@/components/ranges/range-grid";
import { BoardAnalyzer } from "@/components/ranges/board-analyzer";
import { MultiBoardAnalyzer } from "@/components/ranges/multi-board-analyzer";
import { RangeVersionHistory } from "@/components/ranges/range-version-history";
import { ComboEditorModal } from "@/components/ranges/combo-editor-modal";
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
  const [tagsInput, setTagsInput] = useState("");
  const [hands, setHands] = useState<RangeHands>({});
  const [comboOverrides, setComboOverrides] = useState<RangeHands>({});
  const [editingComboLabel, setEditingComboLabel] = useState<string | null>(null);
  const [rangeId, setRangeId] = useState<string | null>(isNew ? null : id);
  const [exported, setExported] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [publishing, setPublishing] = useState(false);

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
    const json = exportRangeToJSON({ name: name.trim() || "Range sem nome", description: description.trim() || null, tags: parseTags(), hands, comboOverrides });
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
      setTagsInput(r.tags.join(", "));
      setHands(r.hands);
      setComboOverrides(r.comboOverrides);
      setTeamId(r.team_id);
    } catch {
      setError("Range não encontrado.");
    } finally {
      setLoading(false);
    }
  }

  function parseTags(): string[] {
    return tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
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
        await updateRange(rangeId, { name: name.trim(), description: description.trim() || null, hands, tags: parseTags(), comboOverrides });
      } else {
        const created = await createRange({ name: name.trim(), description: description.trim() || null, hands, tags: parseTags(), comboOverrides });
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
      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: BTN Open 40bb"
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Tags (separadas por vírgula)</label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Ex: 3bet, ICM, push/fold"
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-muted">Descrição (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      <RangeGrid
        value={hands}
        onChange={setHands}
        labelsWithOverrides={labelsWithOverrides}
        onOpenComboEditor={setEditingComboLabel}
      />

      <BoardAnalyzer hands={hands} comboOverrides={comboOverrides} />

      <MultiBoardAnalyzer hands={hands} comboOverrides={comboOverrides} />

      {rangeId && <RangeVersionHistory rangeId={rangeId} onRestored={loadRange} />}

      {editingComboLabel && (
        <ComboEditorModal
          label={editingComboLabel}
          handDecision={getDecision(hands, editingComboLabel)}
          overrides={comboOverrides}
          onChange={setComboOverrides}
          onClose={() => setEditingComboLabel(null)}
        />
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Salvando…" : "Salvar"}
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-sm text-muted hover:text-ink"
        >
          {exported ? <Check size={16} className="text-positive" /> : <Download size={16} />}
          {exported ? "Copiado!" : "Exportar (copiar)"}
        </button>

        {rangeId && myTeam && (
          <button
            onClick={teamId ? handleUnpublish : handlePublish}
            disabled={publishing}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm disabled:opacity-50 ${
              teamId ? "border-positive text-positive" : "border-hairline text-muted hover:text-ink"
            }`}
          >
            {teamId ? <X size={16} /> : <Users size={16} />}
            {publishing
              ? "Salvando…"
              : teamId
                ? `Publicado no time ${myTeam.team.name} — remover`
                : `Publicar no time ${myTeam.team.name}`}
          </button>
        )}

        {rangeId && (
          <>
            <button
              onClick={() => router.push(`/ranges/compare?a=${rangeId}`)}
              className="flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-sm text-muted hover:text-ink"
            >
              <GitCompare size={16} />
              Comparar
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-sm text-negative"
            >
              <Trash2 size={16} />
              Excluir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
