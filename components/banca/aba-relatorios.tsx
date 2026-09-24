"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange, Download, FileBarChart, GitCompare } from "lucide-react";
import type { GroupStat } from "@/lib/bankroll/calc";
import { net } from "@/lib/bankroll/calc";
import { downloadCSV, fmtMoneyIn, fmtSignedMoneyIn, sessionsToCSV, todayISO, WEEKDAYS, TIME_BUCKETS } from "@/lib/bankroll/format";
import { EASE, PainelCard } from "@/components/painel/painel-card";
import { RoiBuyin } from "@/components/performance/graficos/roi-buyin";
import type { Banca } from "./use-banca";
import { Segmentos } from "./aba-visao-geral";
import { BOTAO_ICONE, BOTAO_VIDRO, COR_NEGATIVO, COR_POSITIVO, num1 } from "./util";

// Aba "Relatórios": responde "onde eu ganho dinheiro de verdade?" e
// fecha os números por mês e por ano (útil pro imposto de renda).
//
//   ┌ Onde você ganha (3) ─────┐┌ ROI por faixa de buy-in (3) ┐
//   ┌ Resumo anual (3) ────────┐┌ Este mês vs. anterior (3) ──┐

type Dimensao = "format" | "weekday" | "time";

// Os nomes vêm sem acento de lib/bankroll/format.ts (também usados no CSV).
const ACENTOS: Record<string, string> = { Terca: "Terça", Sabado: "Sábado", Manha: "Manhã", "Sem horario": "Sem horário" };
const MIN_GRUPO = 5;

export function AbaRelatorios({ b }: { b: Banca }) {
  const [dim, setDim] = useState<Dimensao>("format");
  const grupos = useMemo(() => {
    const g = dim === "format" ? b.porFormato : dim === "weekday" ? b.porDia : b.porHorario;
    const ordem = dim === "weekday" ? WEEKDAYS : dim === "time" ? [...TIME_BUCKETS, "Sem horario"] : null;
    return [...g].sort((x, y) => (ordem ? ordem.indexOf(x.key) - ordem.indexOf(y.key) : y.net - x.net));
  }, [dim, b.porFormato, b.porDia, b.porHorario]);

  const fmt = (v: number) => fmtMoneyIn(v, b.moeda);

  function baixarAnual() {
    const cab = ["Ano", "Sessões", "Total investido", "Total devolvido", "Lucro", "ROI %", "Buy-in médio", "ITM %"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = b.anual.map((y) => [y.ano, y.n, y.totalInvested.toFixed(2), y.totalCashout.toFixed(2), y.profit.toFixed(2), y.roi.toFixed(1), y.avgBuyIn.toFixed(2), y.itm.toFixed(1)]);
    downloadCSV(`pokersync-resumo-anual-${b.moeda}-${todayISO()}.csv`, [cab, ...linhas].map((r) => r.map(esc).join(",")).join("\n"));
  }
  function baixarSessoes() {
    downloadCSV(`pokersync-sessoes-${todayISO()}.csv`, sessionsToCSV(b.sessoesFiltradas, net));
  }

  const { current: atual, previous: anterior } = b.comparacao;
  const linhasComparacao: { rotulo: string; a: string; p: string; corA?: string; corP?: string }[] = [
    {
      rotulo: "Resultado",
      a: fmtSignedMoneyIn(atual.profit, b.moeda),
      p: fmtSignedMoneyIn(anterior.profit, b.moeda),
      corA: atual.profit >= 0 ? COR_POSITIVO : COR_NEGATIVO,
      corP: anterior.profit >= 0 ? COR_POSITIVO : COR_NEGATIVO,
    },
    { rotulo: "ROI", a: `${num1(atual.roi)}%`, p: `${num1(anterior.roi)}%` },
    { rotulo: "Sessões", a: String(atual.n), p: String(anterior.n) },
    { rotulo: "Investido", a: fmt(atual.totalInvested), p: fmt(anterior.totalInvested) },
    { rotulo: "Buy-in médio", a: fmt(atual.avgBuyIn), p: fmt(anterior.avgBuyIn) },
  ];
  const mes = (rotulo: string) => rotulo.split(" ")[0].replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 tela-cheia:h-full tela-cheia:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------------- Onde você ganha ---------------- */}
      <PainelCard
        title="Onde você ganha"
        icon={<FileBarChart size={15} />}
        ordem={0}
        className="tela-cheia:min-h-0"
        action={
          <Segmentos
            valor={dim}
            opcoes={[
              { value: "format", label: "Formato" },
              { value: "weekday", label: "Dia" },
              { value: "time", label: "Horário" },
            ]}
            onChange={setDim}
          />
        }
      >
        {grupos.length === 0 ? (
          <p className="text-sm text-muted">Registre sessões pra ver onde você ganha e onde perde.</p>
        ) : (
          <BarrasResultado grupos={grupos} moeda={b.moeda} />
        )}
      </PainelCard>

      <RoiBuyin sessoes={b.sessoesFiltradas} ordem={1} className="tela-cheia:min-h-0" />

      {/* ---------------- Resumo anual ---------------- */}
      <PainelCard
        title="Resumo anual"
        icon={<CalendarRange size={15} />}
        ordem={2}
        className="tela-cheia:min-h-0"
        action={
          b.anual.length > 0 && (
            <button type="button" onClick={baixarAnual} className={`${BOTAO_VIDRO} !px-2.5 !py-1.5 text-[12px]`} title="Baixar o resumo anual em CSV">
              <Download size={14} /> CSV
            </button>
          )
        }
      >
        {b.anual.length === 0 ? (
          <p className="text-sm text-muted">Registre sessões pra ver o fechamento por ano.</p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted/80">
                <th className="py-2 pr-2">Ano</th>
                <th className="px-2 py-2 text-right">Sessões</th>
                <th className="hidden px-2 py-2 text-right sm:table-cell">Investido</th>
                <th className="px-2 py-2 text-right">Lucro</th>
                <th className="px-2 py-2 text-right">ROI</th>
                <th className="hidden py-2 pl-2 text-right sm:table-cell">ITM</th>
              </tr>
            </thead>
            <tbody>
              {b.anual.map((y) => (
                <tr key={y.ano} className="border-b border-white/[0.05] last:border-0">
                  <td className="py-2.5 pr-2 font-semibold text-ink">{y.ano}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted">{y.n}</td>
                  <td className="hidden px-2 py-2.5 text-right tabular-nums text-muted sm:table-cell">{fmt(y.totalInvested)}</td>
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums" style={{ color: y.profit >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                    {fmtSignedMoneyIn(y.profit, b.moeda)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums text-muted">{num1(y.roi)}%</td>
                  <td className="hidden py-2.5 pl-2 text-right tabular-nums text-muted sm:table-cell">{y.tourneyCount > 0 ? `${num1(y.itm)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </PainelCard>

      {/* ---------------- Comparar meses ---------------- */}
      <PainelCard
        title="Este mês vs. mês passado"
        icon={<GitCompare size={15} />}
        ordem={3}
        className="tela-cheia:min-h-0"
        action={
          <button type="button" onClick={baixarSessoes} className={BOTAO_ICONE} title="Baixar todas as sessões (CSV)" aria-label="Baixar sessões em CSV">
            <Download size={14} />
          </button>
        }
      >
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted/80">
              <th />
              <th className="px-2 py-2 text-right">{mes(b.comparacao.currentLabel)}</th>
              <th className="py-2 pl-2 text-right">{mes(b.comparacao.previousLabel)}</th>
            </tr>
          </thead>
          <tbody>
            {linhasComparacao.map((l) => (
              <tr key={l.rotulo} className="border-b border-white/[0.05] last:border-0">
                <td className="py-2.5 pr-2 text-muted">{l.rotulo}</td>
                <td className="px-2 py-2.5 text-right font-semibold tabular-nums" style={{ color: l.corA ?? "#fff" }}>
                  {l.a}
                </td>
                <td className="py-2.5 pl-2 text-right tabular-nums" style={{ color: l.corP ?? "rgba(255,255,255,0.75)" }}>
                  {l.p}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PainelCard>
    </div>
  );
}

// Barras que saem do zero: lucro pra direita (verde), prejuízo pra
// esquerda (vermelho). Grupo com pouca amostra fica apagado.
function BarrasResultado({ grupos, moeda }: { grupos: GroupStat[]; moeda: string }) {
  const escala = Math.max(1, ...grupos.map((g) => Math.abs(g.net)));
  return (
    <ul className="flex flex-col gap-2.5">
      {grupos.map((g, i) => {
        const cor = g.net >= 0 ? COR_POSITIVO : COR_NEGATIVO;
        const metade = (Math.abs(g.net) / escala) * 50;
        const pouca = g.n < MIN_GRUPO;
        return (
          <li key={g.key} className={pouca ? "opacity-55" : ""} title={pouca ? `Só ${g.n} sessões aqui — amostra pequena` : undefined}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] text-ink/90">{ACENTOS[g.key] ?? g.key}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-[14px] font-bold tabular-nums" style={{ color: cor }}>
                  {fmtSignedMoneyIn(g.net, moeda)}
                </span>
                <span className="text-[11px] tabular-nums text-muted/70">
                  ROI {num1(g.roi)}% · {g.n}
                </span>
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-white/[0.04]">
              <span className="absolute inset-y-[-3px] left-1/2 w-px bg-white/25" />
              <motion.span
                className="absolute inset-y-0 rounded-full"
                style={{ background: cor, [g.net >= 0 ? "left" : "right"]: "50%" }}
                initial={{ width: 0 }}
                animate={{ width: `${metade}%` }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.25 + i * 0.06 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
