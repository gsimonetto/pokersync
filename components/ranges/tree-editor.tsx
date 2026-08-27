"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Link2,
  Link2Off,
  Download,
  Check,
  GitBranch,
  Upload,
} from "lucide-react";
import { ImportHandModal } from "@/components/ranges/import-hand-modal";
import { useConfirm } from "@/components/confirm-dialog";
import { TagPicker } from "@/components/shared/tag-picker";
import {
  addChildNode,
  createTree,
  deleteTree,
  exportTreeToJSON,
  getTree,
  moveNodeById,
  removeNodeById,
  updateNodeById,
  updateTree,
  type TreeNode,
} from "@/lib/services/strategy-tree-service";
import { listRanges, type RangeListItem } from "@/lib/services/range-service";

function newNodeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyNode(): TreeNode {
  return { id: newNodeId(), label: "", rangeId: null, children: [] };
}

// Um no da arvore + toda a subarvore dele, renderizado recursivamente.
// Cada no pode ter 0, 1 ou varios filhos — 2+ filhos e' uma ramificacao
// de verdade (ex: "BTN Open" -> "BB Defende" / "BB Folda", cada um
// continuando pra um caminho diferente).
function NodeEditor({
  node,
  depth,
  ranges,
  onUpdate,
  onAddChild,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  node: TreeNode;
  depth: number;
  ranges: RangeListItem[];
  onUpdate: (id: string, patch: Partial<TreeNode>) => void;
  onAddChild: (parentId: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const linkedRange = node.rangeId ? ranges.find((r) => r.id === node.rangeId) : null;

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0 }}>
      <div className="rounded-xl border border-hairline bg-surface p-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="flex gap-1">
              <button
                onClick={() => onMove(node.id, -1)}
                disabled={!canMoveUp}
                className="rounded border border-hairline p-0.5 text-muted disabled:opacity-30"
              >
                <ArrowUp size={12} />
              </button>
              <button
                onClick={() => onMove(node.id, 1)}
                disabled={!canMoveDown}
                className="rounded border border-hairline p-0.5 text-muted disabled:opacity-30"
              >
                <ArrowDown size={12} />
              </button>
            </div>
          </div>

          <div className="flex-1">
            <input
              value={node.label}
              onChange={(e) => onUpdate(node.id, { label: e.target.value })}
              placeholder='Ex: "BTN Open", "Flop Ks8d2c", "C-bet pequena"'
              className="mb-2 w-full rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-sm outline-none"
            />

            {linkedRange ? (
              <div className="mb-2 flex items-center gap-2 text-xs text-muted">
                <Link2 size={12} className="text-positive" />
                Vinculado ao range <span className="font-medium text-ink">{linkedRange.name}</span>
                <button onClick={() => onUpdate(node.id, { rangeId: null })} className="text-negative">
                  remover vínculo
                </button>
              </div>
            ) : (
              <div className="mb-2 flex items-center gap-2">
                <Link2Off size={12} className="text-muted" />
                <select
                  value=""
                  onChange={(e) => e.target.value && onUpdate(node.id, { rangeId: e.target.value })}
                  className="rounded-lg border border-hairline bg-elevated px-2 py-1 text-xs text-muted"
                >
                  <option value="">Vincular a um range salvo…</option>
                  {ranges.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => onAddChild(node.id)}
              className="flex items-center gap-1 text-xs text-muted hover:text-ink"
            >
              <GitBranch size={12} />
              {node.children.length === 0 ? "Adicionar continuação" : "Adicionar ramificação"}
            </button>
          </div>

          <button onClick={() => onRemove(node.id)} className="text-negative">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {node.children.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-hairline pl-3">
          {node.children.map((child, i) => (
            <NodeEditor
              key={child.id}
              node={child}
              depth={depth + 1}
              ranges={ranges}
              onUpdate={onUpdate}
              onAddChild={onAddChild}
              onRemove={onRemove}
              onMove={onMove}
              canMoveUp={i > 0}
              canMoveDown={i < node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeEditor({ id, tabs }: { id: string; tabs?: React.ReactNode }) {
  const router = useRouter();
  const confirm = useConfirm();
  const isNew = id === "nova";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [treeId, setTreeId] = useState<string | null>(isNew ? null : id);
  const [exported, setExported] = useState(false);
  const [showImportHand, setShowImportHand] = useState(false);

  const [ranges, setRanges] = useState<RangeListItem[]>([]);

  useEffect(() => {
    listRanges().then(setRanges).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const t = await getTree(id);
        setName(t.name);
        setDescription(t.description ?? "");
        setTags(t.tags);
        setNodes(t.nodes);
      } catch {
        setError("Árvore não encontrada.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew]);

  function addRoot() {
    setNodes((prev) => [...prev, emptyNode()]);
  }
  function handleImportHand(node: TreeNode) {
    setNodes((prev) => [...prev, node]);
    setShowImportHand(false);
  }
  function handleAddChild(parentId: string) {
    setNodes((prev) => addChildNode(prev, parentId, emptyNode()));
  }
  function handleUpdate(nodeId: string, patch: Partial<TreeNode>) {
    setNodes((prev) => updateNodeById(prev, nodeId, patch));
  }
  function handleRemove(nodeId: string) {
    setNodes((prev) => removeNodeById(prev, nodeId));
  }
  function handleMove(nodeId: string, dir: -1 | 1) {
    setNodes((prev) => moveNodeById(prev, nodeId, dir));
  }

  function hasEmptyLabel(list: TreeNode[]): boolean {
    return list.some((n) => !n.label.trim() || hasEmptyLabel(n.children));
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Dê um nome para a árvore antes de salvar.");
      return;
    }
    if (hasEmptyLabel(nodes)) {
      setError('Todo passo precisa de um texto (ex: "BTN Open", "Flop Ks8d2c").');
      return;
    }
    setSaving(true);
    setError("");
    try {
      const input = { name: name.trim(), description: description.trim() || null, nodes, tags };
      if (treeId) {
        await updateTree(treeId, input);
      } else {
        const created = await createTree(input);
        setTreeId(created.id);
        router.replace(`/ranges/arvores/${created.id}`);
      }
    } catch {
      setError("Erro ao salvar a árvore.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    const json = exportTreeToJSON({ name: name.trim() || "Árvore sem nome", description: description.trim() || null, tags, nodes });
    try {
      await navigator.clipboard.writeText(json);
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch {
      setError("Não consegui copiar automaticamente.");
    }
  }

  async function handleDelete() {
    if (!treeId) return;
    if (!(await confirm({ title: "Excluir árvore", message: "Essa ação não pode ser desfeita.", confirmLabel: "Excluir" }))) return;
    try {
      await deleteTree(treeId);
      router.push("/ranges/arvores");
    } catch {
      setError("Erro ao excluir a árvore.");
    }
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    <div>
      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      {/* Container unico envolvendo toda a arvore -- mesmo padrao do
          Treino/Banca (uma tela, um card), em vez de cada pedaco
          flutuando solto contra o void. */}
      <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      {tabs && <div className="mb-4">{tabs}</div>}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: BTN Open vs BB Defend, board seco"
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Tags</label>
          <TagPicker value={tags} onChange={setTags} />
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

      {nodes.length > 0 && (
        <p className="mb-3 text-xs text-muted">
          Quando um passo tem mais de uma continuação, cada uma é um caminho diferente (ex: "BB Defende" e "BB Folda"
          saindo do mesmo "BTN Open") — não uma sequência.
        </p>
      )}

      <div className="mb-4 space-y-2">
        {nodes.map((node, i) => (
          <NodeEditor
            key={node.id}
            node={node}
            depth={0}
            ranges={ranges}
            onUpdate={handleUpdate}
            onAddChild={handleAddChild}
            onRemove={handleRemove}
            onMove={handleMove}
            canMoveUp={i > 0}
            canMoveDown={i < nodes.length - 1}
          />
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={addRoot}
          className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm text-muted hover:text-ink"
        >
          <Plus size={16} />
          {nodes.length === 0 ? "Adicionar primeiro passo" : "Adicionar novo início de linha"}
        </button>
        <button
          onClick={() => setShowImportHand(true)}
          className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm text-muted hover:text-ink"
        >
          <Upload size={16} />
          Importar de uma mão
        </button>
      </div>

      {showImportHand && (
        <ImportHandModal onImport={handleImportHand} onClose={() => setShowImportHand(false)} />
      )}

      <div className="flex flex-wrap items-center gap-2">
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
        {treeId && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-sm text-negative"
          >
            <Trash2 size={16} />
            Excluir
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
