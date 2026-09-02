"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Inbox, CheckCircle2, Circle, Flag } from "lucide-react";
import { fetchReceivedShares, type ReceivedShare } from "@/lib/services/hand-review-service";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_revisao: "Em revisão",
  concluida: "Concluída",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Aba do coach no Painel do Time: todas as maos que jogadores do time
// compartilharam com ele (hand_review_shares), com filtro por jogador e
// por torneio -- antes so' dava pra ver mao compartilhada abrindo a
// notificacao uma de cada vez, sem visao consolidada de tudo que os
// alunos mandaram.
export function TabMaosRecebidas() {
  const router = useRouter();
  const [shares, setShares] = useState<ReceivedShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playerFilter, setPlayerFilter] = useState<string | null>(null);
  const [tournamentFilter, setTournamentFilter] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchReceivedShares()
      .then(setShares)
      .catch(() => setError("Erro ao carregar as mãos recebidas."))
      .finally(() => setLoading(false));
  }, []);

  const players = useMemo(() => {
    const map = new Map<string, string>();
    shares.forEach((s) => map.set(s.playerId, s.playerName));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [shares]);

  const tournaments = useMemo(() => {
    const set = new Set<string>();
    shares.forEach((s) => s.tournamentLabel && set.add(s.tournamentLabel));
    return [...set].sort();
  }, [shares]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shares.filter((s) => {
      if (playerFilter && s.playerId !== playerFilter) return false;
      if (tournamentFilter && s.tournamentLabel !== tournamentFilter) return false;
      if (q && !s.playerName.toLowerCase().includes(q) && !(s.tournamentLabel || "").toLowerCase().includes(q) && !s.reviewTitle.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [shares, playerFilter, tournamentFilter, search]);

  const pendingCount = shares.filter((s) => !s.viewedAt).length;

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-negative/40 bg-negative/10 p-2.5 text-[13px] text-negative">{error}</div>
      )}

      {shares.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center">
          <Inbox size={32} className="text-elevated" />
          <p className="mt-3 text-muted">Nenhuma mão recebida ainda.</p>
          <p className="mt-1 text-xs text-muted">Aparece aqui assim que um jogador do time compartilhar uma mão com você.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {pendingCount > 0 && (
              <span className="rounded-full bg-evolution px-2 py-1 text-[11px] font-bold text-void">{pendingCount} não vista{pendingCount === 1 ? "" : "s"}</span>
            )}

            <select
              value={playerFilter ?? ""}
              onChange={(e) => setPlayerFilter(e.target.value || null)}
              className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[12.5px] text-ink outline-none"
            >
              <option value="">Todos os jogadores</option>
              {players.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={tournamentFilter ?? ""}
              onChange={(e) => setTournamentFilter(e.target.value || null)}
              className="rounded-lg border border-hairline bg-elevated px-2.5 py-1.5 text-[12.5px] text-ink outline-none"
            >
              <option value="">Todos os torneios</option>
              {tournaments.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setSearch("");
              }}
              title="Buscar"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors ${
                searchOpen ? "border-ink bg-ink text-void" : "border-hairline text-muted hover:border-ink/40 hover:text-ink"
              }`}
            >
              <Search size={13} />
            </button>

            {(playerFilter || tournamentFilter || search) && (
              <button
                onClick={() => {
                  setPlayerFilter(null);
                  setTournamentFilter(null);
                  setSearch("");
                }}
                className="text-[11.5px] font-semibold text-muted hover:text-ink"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-hairline bg-void px-3 py-2">
              <Search size={13} className="shrink-0 text-muted" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por jogador, torneio ou título da mão"
                className="flex-1 bg-transparent text-[13px] text-ink outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X size={13} className="text-muted" />
                </button>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-void p-10 text-center text-muted">
              Nenhuma mão encontrada pra esse filtro.
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {filtered.map((s) => (
                <li
                  key={s.shareId}
                  onClick={() => router.push(`/revisor?shared=${s.reviewId}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-hairline bg-surface p-3.5 transition-colors hover:border-ink/40"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-void">
                    {s.viewedAt ? (
                      <CheckCircle2 size={16} className="icon-glow text-positive" />
                    ) : (
                      <Circle size={16} className="icon-glow text-evolution" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{s.reviewTitle}</span>
                      <span className="shrink-0 text-[11px] text-muted">{STATUS_LABEL[s.reviewStatus] || s.reviewStatus}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <span className="font-semibold text-ink/80">{s.playerName}</span>
                      {s.tournamentLabel && (
                        <span className="flex items-center gap-1">
                          <Flag size={10} className="text-review" />
                          {s.tournamentLabel}
                        </span>
                      )}
                      <span>· {formatDate(s.createdAt)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
