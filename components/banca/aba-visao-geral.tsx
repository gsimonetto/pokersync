"use client";

import { useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowRight, CalendarDays, Clock, Coins, Download, History, LineChart, Percent, ShieldCheck, StickyNote, Target, Wallet } from "lucide-react";
import type { RangeOption } from "@/lib/bankroll/calc";
import type { Session } from "@/lib/bankroll/types";
import { filterSessionsByRange, net } from "@/lib/bankroll/calc";
import { fmtMoneyIn, fmtSignedMoneyIn, sessionsToCSV, downloadCSV, todayISO } from "@/lib/bankroll/format";
import { EASE, Numero, PainelCard, Selo } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";
import type { Banca } from "./use-banca";
import { CalendarioVolume, CurvaSaldo } from "./graficos";
import { Indicador, LinhaSessao, ReguaBrm, corRuina } from "./pecas";
import { BOTAO_ICONE, COR_NEGATIVO, COR_POSITIVO, PERIODOS, num1 } from "./util";
import type { AbaBanca } from "./abas";

// Aba "Visão geral": o que o grinder olha em 5 segundos. No computador
// cabe inteira na janela (duas faixas que dividem a altura, igual à tela
// inicial); no celular vira uma coluna que rola normalmente.
//
//   ┌──── Seu resumo (3) ────┐┌──── Evolução da banca (3) ────┐
//   ┌ Saúde (2) ─────┐┌ Últimas sessões (2) ┐┌ Consistência (2) ┐

export function Segmentos<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
      {opcoes.map((o) => {
        const ativo = o.value === valor;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative rounded-[10px] px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${ativo ? "text-black" : "text-muted hover:text-ink"}`}
          >
            {ativo && (
              <motion.span layoutId={`${id}-seg`} className="absolute inset-0 rounded-[10px] bg-[#d4af37]" transition={{ type: "spring", stiffness: 480, damping: 38 }} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function cortePeriodo(ultima: string, periodo: RangeOption): string | null {
  if (periodo === "all") return null;
  const dias = { "7D": 7, "30D": 30, "1Y": 365 }[periodo];
  const d = new Date(`${ultima}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export function AbaVisaoGeral({
  b,
  onIrPara,
  onAnotacoes,
  onEditarSessao,
}: {
  b: Banca;
  onIrPara: (aba: AbaBanca) => void;
  onAnotacoes: () => void;
  onEditarSessao: (s: Session) => void;
}) {
  const [periodo, setPeriodo] = useState<RangeOption>("all");
  const fmt = (v: number) => fmtMoneyIn(v, b.moeda);
  const { agg } = b;

  const pontos = useMemo(() => {
    if (b.curvaSaldo.length === 0) return b.curvaSaldo;
    const corte = cortePeriodo(b.curvaSaldo[b.curvaSaldo.length - 1].date, periodo);
    return corte ? b.curvaSaldo.filter((p) => p.date >= corte) : b.curvaSaldo;
  }, [b.curvaSaldo, periodo]);
  const variacaoPeriodo = pontos.length >= 2 ? pontos[pontos.length - 1].valor - pontos[0].valor : null;

  const ultimas = useMemo(
    () =>
      [...b.sessoesFiltradas]
        .sort((x, y) => `${y.date}${y.time ?? ""}`.localeCompare(`${x.date}${x.time ?? ""}`))
        .slice(0, 8),
    [b.sessoesFiltradas],
  );

  function exportarCSV() {
    const lista = filterSessionsByRange(b.sessoesFiltradas, periodo);
    downloadCSV(`pokersync-sessoes-${periodo}-${todayISO()}.csv`, sessionsToCSV(lista, net));
  }

  const r30 = b.variacao30d.profit;
  const deltaRoi = b.comparacao.previous.n > 0 ? b.comparacao.current.roi - b.comparacao.previous.roi : null;
  const temTorneio = agg.tourneyCount > 0;

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 tela-cheia:h-full xl:grid-cols-6 tela-cheia:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------------- Seu resumo ---------------- */}
      <PainelCard title="Seu resumo" icon={<Wallet size={15} />} ordem={0} className="md:col-span-2 xl:col-span-3 tela-cheia:min-h-0">
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <InfoHover
            explicacao={{
              titulo: "Banca atual",
              oQueE: "Quanto você tem pra jogar agora.",
              origem: "Gestão de Banca",
              comoCalcula: b.filtrandoPlataforma
                ? `Só ${b.plataforma}: resultado das sessões + depósitos − saques dessa plataforma.`
                : "Banca inicial + resultado das sessões + depósitos − saques − caixinha.",
              itens: [
                { rotulo: "Resultado de jogo", valor: fmtSignedMoneyIn(agg.profit, b.moeda) },
                { rotulo: "Depósitos", valor: fmt(b.patrimonio.deposits) },
                { rotulo: "Saques + caixinha", valor: fmt(b.patrimonio.withdrawn + b.patrimonio.caixinha) },
              ],
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
              className="painel-bloco relative overflow-hidden rounded-2xl border border-[#d4af37]/25 px-3.5 py-3"
              style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.14), rgba(212,175,55,0.02) 60%)" }}
            >
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted/90">
                Banca atual{b.filtrandoPlataforma ? ` · ${b.plataforma}` : ""}
              </p>
              <p className="tnum mt-1 truncate text-[clamp(26px,2.6vw,36px)] font-bold leading-none tracking-[-0.02em]" style={{ color: b.bancaAtual < 0 ? COR_NEGATIVO : "#fff" }}>
                <Numero valor={b.bancaAtual} formatar={fmt} duracao={1100} />
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Selo cor={r30 > 0 ? COR_POSITIVO : r30 < 0 ? COR_NEGATIVO : "#c4c7c8"} pequeno>
                  {fmtSignedMoneyIn(r30, b.moeda)}
                </Selo>
                <span className="text-[11px] text-muted">em 30 dias · {b.variacao30d.n} {b.variacao30d.n === 1 ? "sessão" : "sessões"}</span>
              </div>
            </motion.div>
          </InfoHover>

          <ul className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            <Indicador
              rotulo="ROI"
              icone={Percent}
              valor={agg.n > 0 ? agg.roi : null}
              formatar={(n) => `${n > 0 ? "+" : ""}${num1(n)}%`}
              cor={agg.n === 0 ? "#fff" : agg.roi >= 0 ? COR_POSITIVO : COR_NEGATIVO}
              detalhe={deltaRoi != null ? `${deltaRoi >= 0 ? "↑" : "↓"} ${num1(Math.abs(deltaRoi))} pts no mês` : `${agg.n} ${agg.n === 1 ? "sessão" : "sessões"}`}
              explicacao={{
                titulo: "ROI",
                oQueE: "Quanto voltou de lucro pra cada real investido em buy-ins.",
                origem: "Gestão de Banca · suas sessões",
                comoCalcula: "Resultado ÷ total investido (buy-ins + reentradas).",
                itens:
                  b.comparacao.previous.n > 0
                    ? [
                        { rotulo: "Este mês", valor: `${num1(b.comparacao.current.roi)}%` },
                        { rotulo: "Mês passado", valor: `${num1(b.comparacao.previous.roi)}%` },
                      ]
                    : undefined,
              }}
              indice={0}
            />
            <Indicador
              rotulo="Por hora"
              icone={Clock}
              valor={b.porHora?.value ?? null}
              formatar={fmt}
              cor={!b.porHora ? "#fff" : b.porHora.value >= 0 ? COR_POSITIVO : COR_NEGATIVO}
              detalhe={b.porHora ? `em ${Math.round(b.porHora.hoursLogged)} h` : "informe as horas"}
              explicacao={{
                titulo: "Ganho por hora",
                oQueE: "Quanto você ganha (ou perde) em média por hora jogada.",
                origem: "Gestão de Banca · sessões com horas jogadas",
                comoCalcula: "Soma do resultado ÷ soma das horas. Só entram sessões em que você informou as horas.",
              }}
              indice={1}
            />
            <Indicador
              rotulo="Buy-in"
              icone={Coins}
              valor={agg.n > 0 ? agg.avgBuyIn : null}
              formatar={fmt}
              detalhe={`média de ${agg.n} ${agg.n === 1 ? "sessão" : "sessões"}`}
              explicacao={{
                titulo: "Buy-in médio",
                oQueE: "O valor médio de entrada das suas sessões. É a base do cálculo de BRM (quantos buy-ins sua banca cobre).",
                origem: "Gestão de Banca · suas sessões",
                comoCalcula: "Soma dos buy-ins ÷ número de sessões.",
              }}
              indice={2}
            />
            {temTorneio || !b.bbPorHora ? (
              <Indicador
                rotulo="ITM"
                icone={Target}
                valor={temTorneio ? agg.itm : null}
                formatar={(n) => `${num1(n)}%`}
                detalhe={temTorneio ? `${agg.itmCount} de ${agg.tourneyCount}` : "só torneios"}
                explicacao={{
                  titulo: "ITM (in the money)",
                  oQueE: "Em quantos torneios você ficou premiado.",
                  origem: "Gestão de Banca · sessões de torneio",
                  comoCalcula: "Torneios com cashout acima de zero ÷ torneios jogados.",
                }}
                indice={3}
              />
            ) : (
              <Indicador
                rotulo="bb/hora"
                icone={Activity}
                valor={b.bbPorHora.value}
                formatar={num1}
                cor={b.bbPorHora.value >= 0 ? COR_POSITIVO : COR_NEGATIVO}
                detalhe={`${b.bbPorHora.n} sessões`}
                explicacao={{
                  titulo: "bb/hora",
                  oQueE: "Quantos big blinds você ganha por hora no cash. Diferente do R$/hora, deixa comparar stakes diferentes.",
                  origem: "Gestão de Banca · sessões de cash com big blind e horas",
                  comoCalcula: "Média de (resultado ÷ big blind ÷ horas) por sessão.",
                  itens: [{ rotulo: "Faixa provável (95%)", valor: `${num1(b.bbPorHora.ciLow)} a ${num1(b.bbPorHora.ciHigh)}` }],
                }}
                indice={3}
              />
            )}
          </ul>
        </div>
      </PainelCard>

      {/* ---------------- Evolução ---------------- */}
      <PainelCard
        title="Evolução da banca"
        icon={<LineChart size={15} />}
        ordem={1}
        rolagem={false}
        className="md:col-span-2 xl:col-span-3 tela-cheia:min-h-0"
        action={
          <div className="flex items-center gap-1.5">
            <Segmentos valor={periodo} opcoes={PERIODOS} onChange={setPeriodo} />
            <button type="button" onClick={onAnotacoes} title="Anotar um momento no gráfico" aria-label="Anotações" className={`${BOTAO_ICONE} hidden sm:grid`}>
              <StickyNote size={14} />
            </button>
            <button type="button" onClick={exportarCSV} title="Baixar as sessões do período (CSV)" aria-label="Baixar CSV" className={`${BOTAO_ICONE} hidden sm:grid`}>
              <Download size={14} />
            </button>
          </div>
        }
      >
        <div className="flex min-h-[220px] flex-1 flex-col md:min-h-[260px] tela-cheia:min-h-0">
          {variacaoPeriodo != null && (
            <p className="mb-1 flex flex-wrap items-baseline gap-2">
              <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color: variacaoPeriodo >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                {fmtSignedMoneyIn(variacaoPeriodo, b.moeda)}
              </span>
              <span className="text-[11.5px] text-muted">no período · sessões e movimentações</span>
              <span className="ml-auto hidden items-center gap-3 text-[11px] text-muted sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm border-[1.5px] border-[#4a90d9]" /> depósito/saque
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#a855f7]" /> anotação
                </span>
              </span>
            </p>
          )}
          <CurvaSaldo pontos={pontos} anotacoes={b.anotacoes} moeda={b.moeda} />
        </div>
      </PainelCard>

      {/* ---------------- Saúde da banca ---------------- */}
      <PainelCard
        title="Saúde da banca"
        icon={<ShieldCheck size={15} />}
        ordem={2}
        rolagem={false}
        className="xl:col-span-2 tela-cheia:min-h-0"
        action={
          <button type="button" onClick={() => onIrPara("risco")} className="flex items-center gap-1 text-[12px] text-muted transition hover:text-ink">
            Detalhes <ArrowRight size={13} />
          </button>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
          {b.brm ? (
            <ReguaBrm leitura={b.brm} compacta />
          ) : (
            <p className="text-sm text-muted">Registre sessões pra ver quantos buy-ins sua banca cobre.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <InfoHover
              explicacao={{
                titulo: "Queda atual",
                oQueE: "Quanto a banca está abaixo do melhor momento dela, em buy-ins. Zero = você está no topo.",
                origem: "Gestão de Banca · resultado das sessões",
                comoCalcula: "(Maior saldo já atingido − saldo de hoje) ÷ buy-in médio.",
              }}
            >
              <div className="painel-bloco rounded-2xl border border-white/5 p-2.5 text-center">
                <p className="text-[11px] text-muted/80">Queda atual</p>
                <p className="tnum mt-0.5 text-lg font-bold" style={{ color: b.queda.atual >= 15 ? COR_NEGATIVO : "#fff" }}>
                  {agg.n === 0 ? "—" : b.queda.atual > 0 ? `${num1(b.queda.atual)} BI` : "No topo"}
                </p>
              </div>
            </InfoHover>
            <InfoHover
              explicacao={{
                titulo: "Risco de ruína",
                oQueE: "A chance de zerar a banca nas próximas 100 sessões, se você continuar jogando como tem jogado.",
                origem: "Gestão de Banca · suas sessões reais",
                comoCalcula: b.ruina
                  ? `Simulado ${b.ruina.simulations} vezes sorteando resultados das suas ${b.ruina.sampleSize} sessões.`
                  : "Precisa de pelo menos 15 sessões registradas.",
              }}
            >
              <div className="painel-bloco rounded-2xl border border-white/5 p-2.5 text-center">
                <p className="text-[11px] text-muted/80">Risco de ruína</p>
                <p className="tnum mt-0.5 text-lg font-bold" style={{ color: b.ruina ? corRuina(b.ruina.ruinPct) : "#fff" }}>
                  {b.ruina ? `${num1(b.ruina.ruinPct)}%` : "—"}
                </p>
              </div>
            </InfoHover>
          </div>
        </div>
      </PainelCard>

      {/* ---------------- Últimas sessões ---------------- */}
      <PainelCard
        title="Últimas sessões"
        icon={<History size={15} />}
        ordem={3}
        className="xl:col-span-2 tela-cheia:min-h-0"
        action={
          <button type="button" onClick={() => onIrPara("sessoes")} className="flex items-center gap-1 text-[12px] text-muted transition hover:text-ink">
            Ver todas <ArrowRight size={13} />
          </button>
        }
      >
        {ultimas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma sessão ainda. Use “Registrar sessão” lá em cima.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ultimas.map((s) => (
              <li key={s.id}>
                <LinhaSessao s={s} moeda={b.moeda} onEditar={onEditarSessao} compacta />
              </li>
            ))}
          </ul>
        )}
      </PainelCard>

      {/* ---------------- Consistência ---------------- */}
      <PainelCard title="Consistência" icon={<CalendarDays size={15} />} ordem={4} rolagem={false} className="md:col-span-2 xl:col-span-2 tela-cheia:min-h-0">
        <CalendarioVolume atividade={b.atividade} moeda={b.moeda} />
      </PainelCard>
    </div>
  );
}
