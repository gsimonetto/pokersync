"use client";

import type { FinancialDay } from "@/lib/services/team-service";

// Grafico financeiro reutilizavel: barras diarias de ganho/perda + linha
// de acumulado. Mesma leitura do Gestor de Banca (valor no eixo, data no
// tempo) — usado na Visao Geral do painel e na ficha individual do
// jogador, para nao obrigar reaprender o formato em cada tela.

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL_CURTO = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function GraficoFinanceiro({
  dados,
  pronto,
  titulo = "Resultado no período",
}: {
  dados: FinancialDay[];
  pronto: boolean;
  titulo?: string;
}) {
  const H = 132;
  const temDados = dados.some((d) => d.resultado !== 0);
  const maxAbs = Math.max(1, ...dados.map((d) => Math.abs(d.resultado)));
  const acumFinal = dados.length ? dados[dados.length - 1].acumulado : 0;

  const minAc = Math.min(0, ...dados.map((d) => d.acumulado));
  const maxAc = Math.max(0, ...dados.map((d) => d.acumulado));
  const faixa = maxAc - minAc || 1;
  const pontos = dados
    .map((d, i) => {
      const x = dados.length > 1 ? (i / (dados.length - 1)) * 100 : 50;
      const y = 100 - ((d.acumulado - minAc) / faixa) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div
      className={`rounded-xl border border-hairline bg-surface p-5 transition-all duration-500 print:break-inside-avoid ${
        pronto ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold">{titulo}</h2>
        <span className={`text-sm font-semibold tnum ${acumFinal > 0 ? "text-positive" : acumFinal < 0 ? "text-negative" : "text-muted"}`}>
          {BRL.format(acumFinal)}
        </span>
      </div>

      {!temDados ? (
        <p className="mt-8 text-sm text-muted">Sem sessões registradas no período.</p>
      ) : (
        <>
          <div className="relative mt-4" style={{ height: H }}>
            {/* linha do zero */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-hairline" />
            {/* barras */}
            <div className="absolute inset-0 flex items-center gap-[2px]">
              {dados.map((d, i) => {
                const alt = (Math.abs(d.resultado) / maxAbs) * 50;
                const pos = d.resultado >= 0;
                return (
                  <div key={d.dia} className="relative h-full min-w-0 flex-1"
                    title={`${new Date(d.dia).toLocaleDateString("pt-BR")}: ${BRL.format(d.resultado)} · ${d.sessoes} sessão(ões)`}>
                    <div
                      className={`absolute left-0 w-full rounded-sm transition-all ease-out ${pos ? "bg-positive/70" : "bg-negative/70"}`}
                      style={{
                        height: pronto ? `${alt}%` : "0%",
                        bottom: pos ? "50%" : undefined,
                        top: pos ? undefined : "50%",
                        transitionDuration: "700ms",
                        transitionDelay: `${Math.min(i * 10, 350)}ms`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            {/* linha do acumulado */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
              <polyline points={pontos} fill="none" stroke="var(--color-evolution, #f59e0b)" strokeWidth="0.8"
                vectorEffect="non-scaling-stroke" strokeLinejoin="round"
                style={{ opacity: pronto ? 1 : 0, transition: "opacity 700ms ease-out 300ms" }} />
            </svg>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-positive/70" /> Ganho</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-negative/70" /> Perda</span>
              <span className="flex items-center gap-1.5"><span className="h-px w-3 bg-evolution" /> Acumulado</span>
            </span>
            <span className="tnum">pico {BRL_CURTO.format(maxAbs)}</span>
          </div>
        </>
      )}
    </div>
  );
}
