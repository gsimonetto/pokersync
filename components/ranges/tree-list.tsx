"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GitBranch, Upload } from "lucide-react";
import {
  listTrees,
  deleteTree,
  createTree,
  parseTreeImport,
  type TreeListItem,
} from "@/lib/services/strategy-tree-service";
import { useConfirm } from "@/components/confirm-dialog";

export function TreeList({ tabs }: { tabs?: React.ReactNode }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [items, setItems] = useState<TreeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setItems(await listTrees());
    } catch {
      setError("Erro ao carregar suas árvores.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ title: "Excluir árvore", message: "Essa ação não pode ser desfeita.", confirmLabel: "Excluir" }))) return;
    setBusyId(id);
    try {
      await deleteTree(id);
      setItems((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("Erro ao excluir a árvore.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleImport() {
    const result = parseTreeImport(importText);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setImporting(true);
    setError("");
    try {
      const created = await createTree(result.data);
      setImportText("");
      setShowImport(false);
      if (result.unlinkedCount > 0) {
        await confirm({
          okOnly: true,
          title: "Árvore importada",
          message: `${result.unlinkedCount} passo(s) tinham vínculo com um range que não existe na sua conta — o vínculo foi removido, o texto do passo continua igual.`,
        });
      }
      router.push(`/ranges/arvores/${created.id}`);
    } catch {
      setError("Erro ao importar a árvore.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      {tabs && <div className="mb-4">{tabs}</div>}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {loading ? "Carregando…" : `${items.length} árvore${items.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm text-muted hover:text-ink"
          >
            <Upload size={16} />
            Importar
          </button>
          <button
            onClick={() => router.push("/ranges/arvores/nova")}
            className="flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-void"
          >
            <Plus size={16} />
            Nova árvore
          </button>
        </div>
      </div>

      {showImport && (
        <div className="mb-4 rounded-xl border border-hairline bg-surface p-4">
          <label className="mb-1 block text-xs text-muted">Cole o JSON exportado de outra árvore</label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder='{ "name": "...", "nodes": [...] }'
            className="mb-2 w-full rounded-lg border border-hairline bg-elevated px-3 py-2 font-mono text-xs outline-none"
          />
          <button
            onClick={handleImport}
            disabled={importing || !importText.trim()}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void disabled:opacity-50"
          >
            {importing ? "Importando…" : "Importar como nova árvore"}
          </button>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
          <GitBranch size={28} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">
            Nenhuma árvore criada ainda. Monte uma linha estratégica completa: preflop → flop → turn → river.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <div key={t.id} className="group relative rounded-xl border border-hairline bg-surface p-4">
            <button onClick={() => router.push(`/ranges/arvores/${t.id}`)} className="block w-full text-left">
              <h3 className="mb-1 truncate text-sm font-semibold">{t.name}</h3>
              {t.description && <p className="mb-2 line-clamp-2 text-xs text-muted">{t.description}</p>}
              <p className="text-xs text-muted">{t.node_count} passos</p>
              {t.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </button>

            <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
              <button
                disabled={busyId === t.id}
                onClick={() => handleDelete(t.id)}
                className="flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-xs text-negative disabled:opacity-50"
              >
                <Trash2 size={12} />
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
