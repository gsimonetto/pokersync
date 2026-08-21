"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History, RotateCcw } from "lucide-react";
import { listRangeVersions, restoreRangeVersion, type RangeVersion } from "@/lib/services/range-service";
import { useConfirm } from "@/components/confirm-dialog";

export function RangeVersionHistory({
  rangeId,
  onRestored,
  startOpen = false,
}: {
  rangeId: string;
  onRestored: () => void;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const confirm = useConfirm();
  const [versions, setVersions] = useState<RangeVersion[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || versions !== null) return;
    listRangeVersions(rangeId)
      .then(setVersions)
      .catch(() => setError("Erro ao carregar o histórico."));
  }, [open, rangeId, versions]);

  async function handleRestore(v: RangeVersion) {
    if (!(await confirm({ tone: "default", title: "Restaurar versão", message: `Voltar para a versão de ${new Date(v.created_at).toLocaleString("pt-BR")}? A versão atual não é perdida — vira um novo item no histórico.`, confirmLabel: "Restaurar" }))) return;
    setRestoringId(v.id);
    try {
      await restoreRangeVersion(rangeId, v);
      onRestored();
      setVersions(null); // forca recarregar na proxima abertura, ja tem a restauracao nova
    } catch {
      setError("Erro ao restaurar essa versão.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-hairline bg-surface">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-medium">
          <History size={14} />
          Histórico de versões
        </span>
        {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>

      {open && (
        <div className="border-t border-hairline p-4">
          {error && <p className="mb-2 text-sm text-negative">{error}</p>}
          {versions === null && <p className="text-sm text-muted">Carregando…</p>}
          {versions !== null && versions.length === 0 && (
            <p className="text-sm text-muted">Nenhuma edição salva ainda além da criação — o histórico começa na próxima vez que você editar as mãos e salvar.</p>
          )}
          {versions !== null && versions.length > 0 && (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
                  <div>
                    <p className="text-sm">{new Date(v.created_at).toLocaleString("pt-BR")}</p>
                    {v.version_note && <p className="text-xs text-muted">{v.version_note}</p>}
                  </div>
                  <button
                    onClick={() => handleRestore(v)}
                    disabled={restoringId === v.id}
                    className="flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                    {restoringId === v.id ? "Restaurando…" : "Restaurar"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
