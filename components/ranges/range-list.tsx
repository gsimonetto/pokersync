"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Trash2, Layers, Upload } from "lucide-react";
import { listRanges, deleteRange, duplicateRange, createRange, parseRangeImport, type RangeListItem } from "@/lib/services/range-service";

export function RangeList() {
  const router = useRouter();
  const [items, setItems] = useState<RangeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Evita duplo-clique disparando duas exclusoes/duplicacoes da mesma
  // linha enquanto a primeira ainda esta em voo.
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
      const rows = await listRanges();
      setItems(rows);
    } catch {
      setError("Erro ao carregar seus ranges.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate(id: string) {
    setBusyId(id);
    try {
      const copy = await duplicateRange(id);
      router.push(`/ranges/${copy.id}`);
    } catch {
      setError("Erro ao duplicar o range.");
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este range? Essa ação não pode ser desfeita.")) return;
    setBusyId(id);
    try {
      await deleteRange(id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Erro ao excluir o range.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleImport() {
    const result = parseRangeImport(importText);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setImporting(true);
    setError("");
    try {
      const created = await createRange(result.data);
      setImportText("");
      setShowImport(false);
      router.push(`/ranges/${created.id}`);
    } catch {
      setError("Erro ao importar o range.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {loading ? "Carregando…" : `${items.length} range${items.length === 1 ? "" : "s"}`}
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
            onClick={() => router.push("/ranges/novo")}
            className="flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-void"
          >
            <Plus size={16} />
            Novo range
          </button>
        </div>
      </div>

      {showImport && (
        <div className="mb-4 rounded-xl border border-hairline bg-surface p-4">
          <label className="mb-1 block text-xs text-muted">Cole o JSON exportado de outro range</label>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            placeholder='{ "name": "...", "hands": { ... } }'
            className="mb-2 w-full rounded-lg border border-hairline bg-elevated px-3 py-2 font-mono text-xs outline-none"
          />
          <button
            onClick={handleImport}
            disabled={importing || !importText.trim()}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void disabled:opacity-50"
          >
            {importing ? "Importando…" : "Importar como novo range"}
          </button>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
          <Layers size={28} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">
            Nenhum range criado ainda. Comece montando um range do zero.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <div
            key={r.id}
            className="group relative rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-hairline"
          >
            <button
              onClick={() => router.push(`/ranges/${r.id}`)}
              className="block w-full text-left"
            >
              <h3 className="mb-1 truncate text-sm font-semibold">{r.name}</h3>
              {r.description && (
                <p className="mb-2 line-clamp-2 text-xs text-muted">{r.description}</p>
              )}
              <p className="text-xs text-muted">{r.hand_count} mãos</p>
              {r.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.tags.map((t) => (
                    <span key={t} className="rounded-full border border-hairline px-2 py-0.5 text-[10px] text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </button>

            <div className="mt-3 flex gap-2 border-t border-hairline pt-3">
              <button
                disabled={busyId === r.id}
                onClick={() => handleDuplicate(r.id)}
                className="flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
              >
                <Copy size={12} />
                Duplicar
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => handleDelete(r.id)}
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
