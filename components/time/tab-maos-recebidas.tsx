"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";
import { RevisorHandTable } from "@/components/revisor/revisor-hand-table";
import { parseHand, HandParseError, type ParsedHand } from "@/lib/poker/hand-parser";
import { fetchSharedHands, markSharedHandViewed, type SharedHandRow } from "@/lib/services/shared-hands-service";
import { F, T } from "@/lib/poker/drill-theme";

// Aba "Mãos Recebidas" do painel do coach — pedido explicito (2026-08):
// "envie o hand history apenas dessa mao para o coach abrir no hand
// replayer do modo time dele". Reusa o MESMO RevisorHandTable do
// Revisor de Mãos do jogador — mesma mesa, mesmos controles — só que
// alimentado pelas linhas de shared_hands em vez da sessão do jogador.
// Nenhuma sobreposição com o Kanban/Jogadores: essa aba é só a fila de
// mãos que os jogadores mandaram, não substitui acompanhamento de leaks.

function statusLabel(status: SharedHandRow["status"]): { label: string; color: string; bg: string } {
  switch (status) {
    case "pendente":
      return { label: "Nova", color: "#FBBF24", bg: "rgba(251,191,36,0.14)" };
    case "visto":
      return { label: "Vista", color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.06)" };
    case "comentado":
      return { label: "Comentada", color: "#6EE7B7", bg: "rgba(52,211,153,0.14)" };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TabMaosRecebidas({ teamId }: { teamId: string }) {
  const [rows, setRows] = useState<SharedHandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSharedHands(teamId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setErro(e instanceof Error ? e.message : "Erro ao carregar mãos recebidas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const parsedSelected: ParsedHand | null = useMemo(() => {
    if (!selected) return null;
    if (selected.parsedData && (selected.parsedData as { kind?: string }).kind === "parsed") {
      return selected.parsedData as unknown as ParsedHand;
    }
    if (selected.handHistory) {
      try {
        return parseHand(selected.handHistory);
      } catch (e) {
        if (!(e instanceof HandParseError)) console.warn("[TabMaosRecebidas] parse falhou:", e);
        return null;
      }
    }
    return null;
  }, [selected]);

  function openHand(row: SharedHandRow) {
    setSelectedId(row.id);
    if (row.status === "pendente") {
      markSharedHandViewed(row.id)
        .then(() => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: "visto" } : r))))
        .catch(() => {
          /* falha silenciosa — status fica "pendente", jogador não é afetado */
        });
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40, color: "rgba(255,255,255,0.4)" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (erro) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 40 }}>
        <AlertTriangle size={20} color={T.bad} />
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{erro}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 48, textAlign: "center" }}>
        <Inbox size={22} color="rgba(255,255,255,0.3)" />
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", maxWidth: 320 }}>
          Nenhum jogador compartilhou uma mão com você ainda. Assim que alguém enviar uma mão pelo Revisor, ela aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 14 }}>
      {selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              fontSize: 12.5, color: "rgba(255,255,255,0.55)", width: "fit-content",
            }}
          >
            <X size={14} /> Voltar pra lista
          </button>

          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>
            Compartilhada por <strong style={{ color: "#FFFFFF" }}>{selected.fromPlayerName}</strong> · {formatDate(selected.createdAt)}
          </div>

          {parsedSelected ? (
            <RevisorHandTable parsedHand={parsedSelected} tournamentName={selected.handTitle} />
          ) : (
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 40,
                borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <AlertTriangle size={20} color={T.warn} />
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 360 }}>
                Essa mão não tem hand history parseável — não é possível montar a mesa.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((row) => {
            const s = statusLabel(row.status);
            return (
              <button
                key={row.id}
                onClick={() => openHand(row)}
                style={{
                  all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  padding: "12px 16px", borderRadius: 12,
                  background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#FFFFFF" }}>{row.fromPlayerName}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                    {row.handTitle ?? "Mão sem título"} · {formatDate(row.createdAt)}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
                    color: s.color, background: s.bg, whiteSpace: "nowrap", flexShrink: 0,
                  }}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
