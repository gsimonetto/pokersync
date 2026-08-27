"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Flame } from "lucide-react";
import { fetchJournalData, type JournalData } from "@/lib/services/range-journal-service";

function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} min`;
  return `${hours.toFixed(1)} horas`;
}

export function RangeJournal({ tabs }: { tabs?: React.ReactNode }) {
  const [data, setData] = useState<JournalData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchJournalData()
      .then(setData)
      .catch(() => setError("Erro ao carregar o journal."));
  }, []);

  if (error) return <p className="text-sm text-negative">{error}</p>;
  if (!data) return <p className="text-sm text-muted">Carregando…</p>;

  return (
    <div className="space-y-6 rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      {tabs}
      {data.streakDays > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface px-4 py-3">
          <Flame size={18} className="text-evolution" />
          <span className="text-sm">
            <span className="font-semibold">{data.streakDays}</span> dia{data.streakDays === 1 ? "" : "s"} seguido
            {data.streakDays === 1 ? "" : "s"} estudando
          </span>
        </div>
      )}

      <div className="rounded-xl border border-hairline bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Hoje</h2>
        {data.today.hands === 0 ? (
          <p className="text-sm text-muted">Nenhuma mão treinada hoje ainda — bora pro Modo Treino, aba Ranges.</p>
        ) : (
          <>
            <div className="mb-3 space-y-1.5">
              {data.today.ranges.map((r) => {
                const pct = Math.round((r.hits / r.hands) * 100);
                return (
                  <div key={r.rangeName} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-positive" />
                    <span>{r.rangeName}</span>
                    <span className="text-muted">
                      ({r.hands} mão{r.hands === 1 ? "" : "s"}, {pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted">
              Precisão do dia: <span className="font-medium text-ink">{data.today.accuracyPct}%</span>
            </p>
          </>
        )}
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold">Últimos 30 dias</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-lg font-semibold">{formatHours(data.last30d.studySeconds)}</p>
            <p className="text-xs text-muted">Tempo de estudo</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{data.last30d.combos.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted">Combos revisados</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{data.last30d.hands.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted">Mãos treinadas</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{data.last30d.accuracyPct}%</p>
            <p className="text-xs text-muted">Precisão média</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Tempo de estudo é estimado a partir do intervalo entre as respostas do drill, não é um cronômetro exato.
        </p>
      </div>
    </div>
  );
}
