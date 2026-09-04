"use client";

import { useState } from "react";
import type { FinancialDay } from "@/lib/services/team-service";
import { BRL } from "@/lib/format";

// Heatmap estilo GitHub do resultado diario do time — mesmo componente
// visual do Gestor de Banca (VolumeHeatmap), so que alimentado pelo
// financeiro agregado do time em vez da banca pessoal. Cor = resultado
// (verde/vermelho), intensidade = magnitude, mostrando consistencia de
// volume de jogo do time inteiro dia a dia.
export function TeamHeatmap({ dados }: { dados: FinancialDay[] }) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const porDia = new Map(dados.map((d) => [d.dia, d]));

  const weeksCount = 20;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
  const totalDays = weeksCount * 7;
  const start = new Date(endOfWeek);
  start.setDate(endOfWeek.getDate() - totalDays + 1);

  const days: { date: string; d: Date }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), d });
  }

  const maxAbs = Math.max(1, ...dados.map((d) => Math.abs(d.resultado)));

  function cellColor(d: FinancialDay | undefined) {
    if (!d || d.sessoes === 0) return "var(--color-hairline)";
    const intensity = Math.min(1, Math.abs(d.resultado) / maxAbs);
    const alpha = 0.25 + intensity * 0.65;
    return d.resultado >= 0 ? `rgba(34,197,94,${alpha})` : `rgba(224,85,90,${alpha})`;
  }

  const weeks: { date: string; d: Date }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const hovered = hoverKey ? porDia.get(hoverKey) : null;
  const semDados = dados.every((d) => d.sessoes === 0);

  return (
    <div className="w-full">
      {semDados ? (
        <p className="text-sm text-muted">Sem jogos registrados no período.</p>
      ) : (
        <>
          <div className="flex justify-center gap-[5px] overflow-x-auto pb-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[5px]">
                {week.map(({ date, d }) => {
                  const dia = porDia.get(date);
                  const future = d > today;
                  const cor = cellColor(dia);
                  return (
                    <div
                      key={date}
                      onMouseEnter={() => !future && setHoverKey(date)}
                      onMouseLeave={() => setHoverKey((k) => (k === date ? null : k))}
                      className="size-[20px] rounded-[4px] transition-all duration-150 hover:scale-125 hover:z-10"
                      style={{
                        background: future ? "transparent" : cor,
                        boxShadow: !future && dia && dia.sessoes > 0 && hoverKey === date ? `0 0 10px 1px ${cor}` : "none",
                      }}
                      title={dia ? `${date} · ${dia.sessoes} jogo(s) · ${BRL.format(dia.resultado)}` : date}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "rgba(34,197,94,0.55)" }} /> Ganho</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "rgba(224,85,90,0.55)" }} /> Perda</span>
            </span>
            {hovered && (
              <span className="font-semibold text-ink">
                {hovered.dia} · {hovered.sessoes} jogo(s) · {BRL.format(hovered.resultado)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
