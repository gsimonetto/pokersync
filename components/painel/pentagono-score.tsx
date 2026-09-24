"use client";

import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { COMPONENTES } from "@/components/analysis/EvolutionScoreCard";
import { nivelDoScore, type PlayerPerformance } from "@/lib/services/performance-service";
import { Numero } from "./painel-card";
import { PentagonoCircuito, type EixoCircuito } from "@/components/time/pentagono-circuito";
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
// Desenho: o mesmo pentágono 3D ("placa de circuito") da ficha do
// jogador (components/time/pentagono-circuito.tsx) -- um padrão só de
// pentágono no produto.

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
  // Pilar sem dado vem 50 (neutro) direto da view; null só se a view
  // inteira não existe pro jogador ainda.
  const pilares = COMPONENTES.map((c) => {
    const v = perf?.[c.key];
    return { ...c, valor: typeof v === "number" ? Math.max(0, Math.min(100, v)) : null };
  });
  const temDado = pilares.some((p) => p.valor != null);

  // Ponto fraco: menor pilar abaixo de 70 (empate: o de maior peso, que é
  // a ordem da lista). Sem nada abaixo de 70, não há o que apontar.
  const fraco = pilares
    .filter((p) => p.valor != null && p.valor < 70)
    .reduce<(typeof pilares)[number] | null>((menor, p) => (menor == null || p.valor! < menor.valor! ? p : menor), null);

  // Mesmo pentágono 3D ("placa de circuito") da ficha do jogador, com os
  // 5 pilares do Score de 0 a 100. O ponto fraco sai em vermelho.
  const eixos: EixoCircuito[] = pilares.map((p) => ({
    chave: p.key,
    curto: CURTO[p.key] ?? p.label,
    titulo: `${p.label} · peso ${p.peso}`,
    oQueE: p.explicacao,
    comoCalcula: `Nota de 0 a 100. Vale ${p.peso} do Score geral.`,
    teto: 100,
    valor: p.valor,
  }));

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

      {/* No computador a tela inteira cabe sem rolagem: o pentágono ocupa
          o maior tamanho que couber na altura E na largura que sobram
          (unidades de container), mantendo a proporção. No celular segue
          a largura. */}
      <div className="flex min-h-0 flex-1 items-center justify-center xl:[container-type:size]">
        <div className="w-full xl:w-[min(100cqw,calc(100cqh*2.05))]">
          <PentagonoCircuito
            eixos={eixos}
            amostra={temDado ? 1 : 0}
            formatar={(v) => (v == null ? "—" : num(v))}
            rotuloValor="Sua nota"
            rotuloTeto="Escala"
            unidadeTeto=""
            origem="Performance · Score de Evolução"
            vazio="O Score aparece assim que você registrar sessões, drills ou mãos."
            destaque={fraco ? pilares.indexOf(fraco) : null}
          />
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
