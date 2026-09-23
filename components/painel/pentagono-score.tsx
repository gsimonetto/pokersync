"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { animate, useReducedMotion } from "framer-motion";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { COMPONENTES } from "@/components/analysis/EvolutionScoreCard";
import { nivelDoScore, type PlayerPerformance } from "@/lib/services/performance-service";
import { EASE, Numero } from "./painel-card";
import { InfoHover, type Explicacao } from "./info-hover";
import { num } from "./formato";

// Pentágono (radar) dos 5 pilares do Score de Evolução -- substitui o
// conta-giros: o número sozinho dizia QUANTO, o pentágono diz POR QUÊ
// (qual pilar está murcho) e a linha de baixo diz O QUE FAZER (leva ao
// módulo que sobe o pilar mais fraco).
//
// Pilares, pesos e textos são os MESMOS do card de Score da Performance
// (components/analysis/EvolutionScoreCard.tsx, exportados de lá), e as
// faixas de cor também: abaixo de 40 fraco, 40-69 em evolução, 70+ bom.
//
// Regras de gráfico seguidas: uma série só (sem legenda), uma cor (o
// dourado do Painel), linha de 2px, pontos de 8px com anel na cor do
// fundo, grade discreta e rótulos na cor de texto, não na cor do dado.

export function corDoScore(v: number): string {
  return v < 40 ? "#e0555a" : v < 70 ? "#f59e0b" : "#22c55e";
}

// Pra onde mandar o jogador quando o pilar é o mais fraco.
const ACAO: Record<string, { texto: string; href: string }> = {
  score_tecnica: { texto: "Revisar mãos", href: "/revisor" },
  score_conhecimento: { texto: "Treinar", href: "/treino" },
  score_disciplina: { texto: "Manter a sequência", href: "/treino" },
  score_performance: { texto: "Ver a banca", href: "/banca" },
  score_consistencia: { texto: "Registrar sessões", href: "/banca" },
};

// Geometria (viewBox 200x200). Centro um pouco abaixo do meio: o
// pentágono tem ponta pra cima e base larga, assim fica centrado no olho.
const CX = 100;
const CY = 104;
const R = 70;
const r2 = (n: number) => Math.round(n * 100) / 100; // evita diferença de arredondamento servidor x navegador
function ponto(i: number, fracao: number) {
  const a = ((-90 + i * 72) * Math.PI) / 180;
  return { x: r2(CX + R * fracao * Math.cos(a)), y: r2(CY + R * fracao * Math.sin(a)) };
}
const poligono = (fracoes: number[]) => fracoes.map((f, i) => `${ponto(i, f).x},${ponto(i, f).y}`).join(" ");

// Rótulo curto por pilar (o nome inteiro vai na explicação do hover).
const CURTO: Record<string, string> = {
  score_tecnica: "Técnica",
  score_conhecimento: "Conhec.",
  score_disciplina: "Disciplina",
  score_performance: "Perform.",
  score_consistencia: "Consist.",
};

export function PentagonoScore({ perf, explicacao }: { perf: PlayerPerformance | null; explicacao: Explicacao }) {
  const score = perf?.score_geral ?? null;
  const reduzir = useReducedMotion();
  // Entrada: os 5 pontos saem do centro e vão até a nota de cada pilar.
  const [crescimento, setCrescimento] = useState(reduzir ? 1 : 0);
  useEffect(() => {
    if (reduzir) {
      setCrescimento(1);
      return;
    }
    const c = animate(0, 1, { duration: 0.9, ease: EASE, delay: 0.45, onUpdate: setCrescimento });
    return () => c.stop();
  }, [reduzir]);
  // Pilar sem dado vem 50 (neutro) direto da view; null só se a view
  // inteira não existe pro jogador ainda.
  const pilares = COMPONENTES.map((c) => {
    const v = perf?.[c.key];
    return { ...c, valor: typeof v === "number" ? Math.max(0, Math.min(100, v)) : null };
  });
  const temDado = pilares.some((p) => p.valor != null);
  const fracoes = pilares.map((p) => (p.valor ?? 0) / 100);

  // Ponto fraco: menor pilar abaixo de 70 (empate: o de maior peso, que é
  // a ordem da lista). Sem nada abaixo de 70, não há o que apontar.
  const fraco = pilares
    .filter((p) => p.valor != null && p.valor < 70)
    .reduce<(typeof pilares)[number] | null>((menor, p) => (menor == null || p.valor! < menor.valor! ? p : menor), null);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Cabeçalho numa linha só (economiza altura pro pentágono):
          rótulo + nível por extenso à esquerda, número à direita. */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <InfoHover explicacao={explicacao} className="rounded-md">
            <span className="text-[12px] leading-tight text-muted/80 underline decoration-dotted decoration-white/25 underline-offset-2">
              Score geral
            </span>
          </InfoHover>
          <p
            className="mt-0.5 text-[10px] font-semibold uppercase leading-none tracking-[0.12em]"
            style={{ color: score == null ? "#c4c7c8" : corDoScore(score) }}
          >
            {nivelDoScore(score)}
          </p>
        </div>
        <span className="flex items-baseline gap-1">
          <span className="tnum text-[28px] font-bold leading-none tracking-[-0.02em] text-ink xl:[@media(max-height:819px)]:text-[22px]">
            {score == null ? "—" : <Numero valor={score} formatar={num} duracao={1200} />}
          </span>
          <span className="text-[11px] text-muted/70">/100</span>
        </span>
      </div>

      {/* O pentágono. Os rótulos são HTML por cima do SVG (posição em %)
          pra cada um poder abrir a explicação ao passar o mouse. */}
      {/* Quadrado que manda na geometria: no computador o lado é o MENOR
          entre a largura e a altura que sobram no card (unidades de
          container), pra caber sem rolagem e continuar quadrado -- os
          rótulos são posicionados em % dele. No celular, segue a largura. */}
      <div className="flex min-h-0 flex-1 items-center justify-center xl:[container-type:size]">
      <div className="relative aspect-square w-full max-w-[210px] xl:h-[min(100cqw,100cqh)] xl:w-[min(100cqw,100cqh)] xl:max-w-none">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          {/* grade: 25/50/75/100 e os raios */}
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <polygon
              key={f}
              points={poligono([f, f, f, f, f])}
              fill="none"
              stroke={f === 1 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"}
              strokeWidth={1}
            />
          ))}
          {pilares.map((_, i) => {
            const p = ponto(i, 1);
            return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
          })}
          {temDado && (
            <g opacity={Math.min(1, crescimento * 2)}>
              <polygon
                points={poligono(fracoes.map((f) => f * crescimento))}
                fill="rgba(212,175,55,0.16)"
                stroke="#d4af37"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              {pilares.map((p, i) => {
                if (p.valor == null) return null;
                const pt = ponto(i, fracoes[i] * crescimento);
                const ehFraco = fraco?.key === p.key;
                return (
                  <circle
                    key={p.key}
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill={ehFraco ? "#e0555a" : "#d4af37"}
                    stroke="#161616"
                    strokeWidth={2}
                  />
                );
              })}
            </g>
          )}
        </svg>

        {pilares.map((p, i) => {
          // Rótulo um pouco pra fora da ponta, em % do quadro.
          const a = ((-90 + i * 72) * Math.PI) / 180;
          const x = r2(((CX + (R + 17) * Math.cos(a)) / 200) * 100);
          const y = r2(((CY + (R + 13) * Math.sin(a)) / 200) * 100);
          return (
            <InfoHover
              key={p.key}
              explicacao={{
                titulo: `${p.label} · peso ${p.peso}`,
                oQueE: p.explicacao,
                itens: [{ rotulo: "Sua nota", valor: p.valor == null ? "—" : `${num(p.valor)} de 100` }],
                origem: "Performance · Score de Evolução",
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md px-1 text-center leading-none"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <span className="block whitespace-nowrap text-[10.5px] text-muted/80">
                <span aria-hidden>{CURTO[p.key]}</span>
                <span className="sr-only">{p.label}</span>
              </span>
              <span className="tnum block text-[11.5px] font-bold text-ink/90">
                {p.valor == null ? "—" : num(p.valor)}
              </span>
            </InfoHover>
          );
        })}
      </div>
      </div>

      {/* O que fazer: leva ao módulo que sobe o pilar mais fraco. Ícone +
          texto (a cor sozinha nunca carrega o significado). */}
      {fraco && (
        <Link
          href={ACAO[fraco.key].href}
          title={`Ponto fraco: ${fraco.label}`}
          className="mt-1 flex items-center gap-1.5 rounded-lg px-1 py-1 text-[11.5px] transition-colors hover:bg-white/[0.04]"
        >
          <TriangleAlert size={13} className="shrink-0 text-[#e0555a]" aria-hidden />
          {/* "Ponto fraco:" só pra leitor de tela: no painel estreito o
              texto cortava o nome do pilar. O ícone de alerta e o ponto
              vermelho no pentágono já dizem isso a quem enxerga. */}
          <span className="min-w-0 flex-1 truncate text-ink/90">
            <span className="sr-only">Ponto fraco: </span>
            {fraco.label}
          </span>
          <span className="flex shrink-0 items-center gap-1 font-semibold text-[#d4af37]">
            {ACAO[fraco.key].texto}
            <ArrowRight size={12} aria-hidden />
          </span>
        </Link>
      )}
    </div>
  );
}
