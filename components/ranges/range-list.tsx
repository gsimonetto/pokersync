"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Trash2, Layers, Search, Upload } from "lucide-react";
import { listRanges, deleteRange, duplicateRange, createRange, parseRangeImport, type RangeListItem } from "@/lib/services/range-service";
import { RangeGridPreview } from "@/components/ranges/range-grid-preview";

export function RangeList() {
  const router = useRouter();
  const [items, setItems] = useState<RangeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busca, setBusca] = useState("");
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

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return items;
    return items.filter(
      (r) => r.name.toLowerCase().includes(termo) || r.tags.some((t) => t.toLowerCase().includes(termo))
    );
  }, [items, busca]);

  // Preview ao vivo do JSON colado — antes so' se descobria se o JSON
  // estava quebrado (ou o que ia ser importado) depois de clicar
  // "Importar", sem chance de corrigir antes.
  const importPreview = useMemo(() => {
    if (!importText.trim()) return null;
    return parseRangeImport(importText);
  }, [importText]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {loading
            ? "Carregando…"
            : busca.trim()
            ? `${filtrados.length} de ${items.length} range${items.length === 1 ? "" : "s"}`
            : `${items.length} range${items.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou tag…"
              className="w-44 rounded-lg border border-hairline bg-elevated py-2 pl-8 pr-3 text-sm text-ink outline-none placeholder:text-muted/50"
            />
          </div>
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder='{ "name": "...", "hands": { ... } }'
              className="w-full flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 font-mono text-xs outline-none"
            />
            {importPreview && (
              <div className="w-full shrink-0 sm:w-40">
                {"error" in importPreview ? (
                  <p className="text-xs text-negative">{importPreview.error}</p>
                ) : (
                  <div>
                    <RangeGridPreview hands={importPreview.data.hands} />
                    <p className="mt-1.5 truncate text-xs font-medium text-ink">{importPreview.data.name}</p>
                    <p className="text-[11px] text-muted">
                      {Object.values(importPreview.data.hands).filter((d) => d.call > 0 || d.raise > 0).length} mãos ativas
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleImport}
            disabled={importing || !importText.trim() || Boolean(importPreview && "error" in importPreview)}
            className="mt-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-void disabled:opacity-50"
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

      {!loading && items.length > 0 && filtrados.length === 0 && (
        <p className="rounded-xl border border-hairline bg-surface p-6 text-center text-sm text-muted">
          Nenhum range bate com &quot;{busca}&quot;.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtrados.map((r) => (
          <div
            key={r.id}
            className="group relative rounded-xl border border-hairline bg-surface p-4 transition-colors hover:border-hairline"
          >
            <button
              onClick={() => router.push(`/ranges/${r.id}`)}
              className="block w-full text-left"
            >
              <div className="mb-2.5 flex gap-3">
                <RangeGridPreview hands={r.hands} className="w-16 shrink-0" />
                <div className="min-w-0">
                  <h3 className="mb-1 truncate text-sm font-semibold">{r.name}</h3>
                  {r.description && (
                    <p className="mb-1 line-clamp-2 text-xs text-muted">{r.description}</p>
                  )}
                  <p className="text-xs text-muted">{r.hand_count} mãos</p>
                </div>
              </div>
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
