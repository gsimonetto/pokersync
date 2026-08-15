"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, X, Trophy, Coins } from "lucide-react";
import {
  listSessionsForImport,
  listHandsForImport,
  type ImportableSession,
  type ImportableHand,
} from "@/lib/services/hand-import-service";
import { buildTreeChainFromHand } from "@/lib/poker/tree-from-hand";
import type { TreeNode } from "@/lib/services/strategy-tree-service";

export function ImportHandModal({
  onImport,
  onClose,
}: {
  onImport: (node: TreeNode) => void;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<ImportableSession[] | null>(null);
  const [selectedSession, setSelectedSession] = useState<ImportableSession | null>(null);
  const [hands, setHands] = useState<ImportableHand[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listSessionsForImport()
      .then(setSessions)
      .catch(() => setError("Erro ao carregar seus torneios/sessões."));
  }, []);

  function openSession(s: ImportableSession) {
    setSelectedSession(s);
    setHands(null);
    listHandsForImport(s.id)
      .then(setHands)
      .catch(() => setError("Erro ao carregar as mãos dessa sessão."));
  }

  function pickHand(h: ImportableHand) {
    if (!h.parsed) {
      setError("Essa mão não pôde ser interpretada — tente outra.");
      return;
    }
    onImport(buildTreeChainFromHand(h.parsed));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-hairline bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          {selectedSession && (
            <button onClick={() => setSelectedSession(null)} className="text-muted hover:text-ink">
              <ArrowLeft size={16} />
            </button>
          )}
          <h3 className="flex-1 text-lg font-semibold">
            {selectedSession ? selectedSession.label : "Importar de uma mão"}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-negative">{error}</p>}

        {!selectedSession && (
          <>
            <p className="mb-3 text-xs text-muted">Escolha o torneio ou sessão onde está a mão.</p>
            {sessions === null && <p className="text-sm text-muted">Carregando…</p>}
            {sessions !== null && sessions.length === 0 && (
              <p className="text-sm text-muted">Nenhuma sessão com mãos salvas ainda no Revisor de Mãos.</p>
            )}
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {sessions?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => openSession(s)}
                  className="flex w-full items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-left text-sm hover:bg-void"
                >
                  {s.kind === "tournament" ? <Trophy size={14} className="text-evolution" /> : <Coins size={14} className="text-positive" />}
                  <span className="flex-1 truncate">{s.label}</span>
                  <span className="text-xs text-muted">{s.handCount} mãos</span>
                </button>
              ))}
            </div>
          </>
        )}

        {selectedSession && (
          <>
            <p className="mb-3 text-xs text-muted">
              Escolha a mão — o preflop, os boards e as ações do hero viram os passos automaticamente.
            </p>
            {hands === null && <p className="text-sm text-muted">Carregando…</p>}
            {hands !== null && hands.length === 0 && <p className="text-sm text-muted">Nenhuma mão nessa sessão.</p>}
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {hands?.map((h) => (
                <button
                  key={h.id}
                  onClick={() => pickHand(h)}
                  disabled={!h.parsed}
                  className="flex w-full items-center justify-between rounded-lg border border-hairline bg-elevated px-3 py-2 text-left text-sm hover:bg-void disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="truncate">
                    {h.title || (h.parsed?.heroPosition ? `${h.parsed.heroPosition} — ${h.parsed.heroCards?.join(" ") ?? ""}` : "Mão sem título")}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{new Date(h.createdAt).toLocaleDateString("pt-BR")}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
