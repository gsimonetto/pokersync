"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Copy, Layers } from "lucide-react";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import {
  listTeamSharedRanges,
  duplicateRange,
  getRange,
  type TeamSharedRange,
  type RangeDetail,
} from "@/lib/services/range-service";
import { RangeGrid } from "@/components/ranges/range-grid";

export function TeamLibrary({ tabs }: { tabs?: React.ReactNode }) {
  const router = useRouter();
  const [myTeam, setMyTeam] = useState<MyTeam | null>(null);
  const [items, setItems] = useState<TeamSharedRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<RangeDetail | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyTeam()
      .then(async (team) => {
        setMyTeam(team);
        if (team) {
          const rows = await listTeamSharedRanges(team.team.id);
          setItems(rows);
        }
      })
      .catch(() => setError("Erro ao carregar o time."))
      .finally(() => setLoading(false));
  }, []);

  async function openPreview(id: string) {
    try {
      setPreview(await getRange(id));
    } catch {
      setError("Erro ao abrir o range.");
    }
  }

  async function handleCopy(id: string) {
    setCopyingId(id);
    try {
      const copy = await duplicateRange(id);
      router.push(`/ranges/${copy.id}`);
    } catch {
      setError("Erro ao copiar pra sua biblioteca.");
    } finally {
      setCopyingId(null);
    }
  }

  if (loading) return <p className="text-sm text-muted">Carregando…</p>;

  if (!myTeam) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
        {tabs && <div className="mb-3 flex justify-end">{tabs}</div>}
        <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
          <Users size={28} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">
            Você ainda não faz parte de um time. Ranges publicados por colegas de time aparecem aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      {tabs && <div className="mb-3 flex justify-end">{tabs}</div>}
      {error && <p className="mb-4 text-sm text-negative">{error}</p>}
      <p className="mb-4 text-sm text-muted">
        Tudo que foi publicado pro time <span className="font-medium text-ink">{myTeam.team.name}</span>. Cada item
        continua pertencendo a quem publicou — pra editar o seu próprio, copie pra sua biblioteca.
      </p>

      {items.length === 0 && (
        <div className="rounded-xl border border-hairline bg-surface p-10 text-center">
          <Layers size={28} className="mx-auto mb-3 text-muted" />
          <p className="text-sm text-muted">Ninguém publicou nenhum range pro time ainda.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((r) => (
          <div key={r.id} className="rounded-xl border border-hairline bg-surface p-4">
            <button onClick={() => openPreview(r.id)} className="block w-full text-left">
              <h3 className="mb-1 truncate text-sm font-semibold">{r.name}</h3>
              <p className="mb-2 text-xs text-muted">
                {r.isMine ? "Publicado por você" : `Publicado por ${r.ownerName}`} · {r.hand_count} mãos
              </p>
            </button>
            {!r.isMine && (
              <button
                onClick={() => handleCopy(r.id)}
                disabled={copyingId === r.id}
                className="flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-50"
              >
                <Copy size={12} />
                {copyingId === r.id ? "Copiando…" : "Copiar pra minha biblioteca"}
              </button>
            )}
          </div>
        ))}
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-hairline bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{preview.name}</h3>
              <button onClick={() => setPreview(null)} className="text-muted">
                Fechar
              </button>
            </div>
            {preview.description && <p className="mb-3 text-sm text-muted">{preview.description}</p>}
            <RangeGrid value={preview.hands} onChange={() => {}} readOnly />
          </div>
        </div>
      )}
    </div>
  );
}
