"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Flame, BookOpen } from "lucide-react";
import { fetchJournalData, type JournalData } from "@/lib/services/range-journal-service";
import { Painel, MetricGrid } from "@/components/dashboard/kit";
import { ACCENT } from "@/lib/modules-data";

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

  if (error) {
    return (
      <div className="space-y-6">
        {tabs}
        <p className="text-sm text-negative">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        {tabs}
        <p className="text-sm text-muted">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      {tabs}
      {data.streakDays > 0 && (
        <div
          className="fade-in-up flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border" style={{ borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.12)" }}>
            <Flame size={16} className="icon-glow text-evolution" />
          </span>
          <span className="text-sm">
            <span className="font-semibold">{data.streakDays}</span> dia{data.streakDays === 1 ? "" : "s"} seguido
            {data.streakDays === 1 ? "" : "s"} estudando
          </span>
        </div>
      )}

      <Painel titulo="Hoje" icone={<BookOpen size={13} style={{ color: ACCENT.pink }} />}>
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
      </Painel>

      <Painel titulo="Últimos 30 dias" icone={<Flame size={13} style={{ color: ACCENT.pink }} />}>
        <MetricGrid
          items={[
            { label: "Tempo de estudo", value: formatHours(data.last30d.studySeconds) },
            { label: "Combos revisados", value: data.last30d.combos.toLocaleString("pt-BR") },
            { label: "Mãos treinadas", value: data.last30d.hands.toLocaleString("pt-BR") },
            { label: "Precisão média", value: `${data.last30d.accuracyPct}%` },
          ]}
        />
        <p className="mt-3 text-xs text-muted">
          Tempo de estudo é estimado a partir do intervalo entre as respostas do drill, não é um cronômetro exato.
        </p>
      </Painel>
    </div>
  );
}
