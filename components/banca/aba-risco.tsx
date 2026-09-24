"use client";

import { useEffect, useMemo, useState } from "react";
import { Dices, Gauge, OctagonAlert, Skull, TrendingDown } from "lucide-react";
import { DEFAULT_BRM_THRESHOLDS, brmReading, thresholdFor } from "@/lib/bankroll/calc";
import type { BrmFormat, BrmThreshold } from "@/lib/bankroll/types";
import { fmtMoneyIn, fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { BarraProgresso, Linha, PainelCard, Selo } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";
import type { Banca } from "./use-banca";
import { GraficoQueda, LequeVariancia } from "./graficos";
import { AMOSTRA_MINIMA_VARIANCIA, simularVariancia } from "@/lib/bankroll/variancia";
import { Escolhas } from "./formulario-sessao";
import { ReguaBrm, STATUS_BRM, corRuina } from "./pecas";
import { CAMPO, COR_NEGATIVO, COR_POSITIVO, num1, numero } from "./util";

// Aba "Risco & BRM": tudo que responde "minha banca aguenta?".
//
//   ┌──── Quedas da banca (3) ────┐┌──── Isso é variância? (3) ────┐
//   ┌ Risco de ruína (2) ┐┌ BRM + calculadora (2) ┐┌ Limite do dia (2) ┐

const FORMATOS_BRM = DEFAULT_BRM_THRESHOLDS.map((t) => t.format);

export function AbaRisco({ b }: { b: Banca }) {
  const banca = b.patrimonio.playingBankroll;
  const leituras = useMemo(
    () =>
      FORMATOS_BRM.map((f) => ({
        formato: f,
        limite: thresholdFor(b.limites, f),
        leitura: brmReading(
          b.sessoesMoeda.filter((s) => s.format === f),
          banca,
          b.limites,
        ),
      })),
    [b.limites, b.sessoesMoeda, banca],
  );

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 tela-cheia:h-full xl:grid-cols-6 tela-cheia:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------------- Quedas ---------------- */}
      <PainelCard title="Quedas da banca" icon={<TrendingDown size={15} />} ordem={0} rolagem={false} className="md:col-span-2 xl:col-span-3 tela-cheia:min-h-0">
        <div className="flex min-h-[240px] flex-1 flex-col tela-cheia:min-h-0">
          <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1">
            <p className="flex items-baseline gap-2">
              <span className="text-[22px] font-bold leading-none tabular-nums" style={{ color: b.queda.atual >= 15 ? COR_NEGATIVO : "#fff" }}>
                {b.agg.n === 0 ? "—" : b.queda.atual > 0 ? `${num1(b.queda.atual)} BI` : "No topo"}
              </span>
              <span className="text-[11.5px] text-muted">
                queda atual{b.queda.emDinheiro > 0 ? ` · ${fmtMoneyIn(b.queda.emDinheiro, b.moeda)}` : ""}
              </span>
            </p>
            <p className="flex items-baseline gap-2">
              <span className="text-[22px] font-bold leading-none tabular-nums text-ink/80">{b.queda.maxima > 0 ? `${num1(b.queda.maxima)} BI` : "—"}</span>
              <span className="text-[11.5px] text-muted">maior queda já vista</span>
            </p>
          </div>
          <GraficoQueda serie={b.serieQueda} moeda={b.moeda} buyInMedio={b.agg.avgBuyIn} />
          <p className="mt-1 text-[11px] text-muted/80">Quanto a banca ficou abaixo do melhor momento (só resultado de jogo). BI = seu buy-in médio.</p>
        </div>
      </PainelCard>

      <CardVariancia b={b} />

      {/* ---------------- Risco de ruína + tilt ---------------- */}
      <PainelCard title="Risco de ruína" icon={<Skull size={15} />} ordem={2} className="xl:col-span-2 tela-cheia:min-h-0">
        <div className="flex flex-col gap-3">
          <InfoHover
            explicacao={{
              titulo: "Risco de ruína",
              oQueE: "A chance de zerar a banca nas próximas 100 sessões, se você continuar jogando como tem jogado.",
              origem: "Gestão de Banca · suas sessões reais",
              comoCalcula: b.ruina
                ? `Simulado ${b.ruina.simulations} vezes sorteando resultados das suas ${b.ruina.sampleSize} sessões, a partir da banca de hoje.`
                : "Precisa de pelo menos 15 sessões registradas e banca acima de zero.",
            }}
          >
            <Linha className="text-center">
              <p className="tnum text-[36px] font-bold leading-none" style={{ color: b.ruina ? corRuina(b.ruina.ruinPct) : "#fff" }}>
                {b.ruina ? `${num1(b.ruina.ruinPct)}%` : "—"}
              </p>
              <p className="mt-1.5 text-[12px] text-muted">
                {b.ruina ? `de chance de zerar em ${b.ruina.horizonSessions} sessões` : "Registre pelo menos 15 sessões pra calcular"}
              </p>
              {b.ruina && (
                <BarraProgresso
                  pct={Math.min(100, b.ruina.ruinPct * 2.5)}
                  cor={corRuina(b.ruina.ruinPct)}
                  fundo={`linear-gradient(90deg, ${COR_POSITIVO}, ${corRuina(b.ruina.ruinPct)})`}
                  className="mt-3 h-1.5"
                />
              )}
            </Linha>
          </InfoHover>

          {b.tilt && b.tilt.tiltN > 0 && (
            <div>
              <p className="mb-1.5 text-[12px] font-medium text-ink/90">Sessões em tilt vs. as demais</p>
              <div className="grid grid-cols-2 gap-2">
                <Linha className="!p-2.5">
                  <p className="text-[11px] text-muted/80">Tilt ({b.tilt.tiltN})</p>
                  <p className="tnum mt-0.5 text-[14px] font-semibold" style={{ color: b.tilt.tiltNet >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                    {fmtSignedMoneyIn(b.tilt.tiltNet, b.moeda)}
                  </p>
                  <p className="text-[11px] text-muted">ROI {num1(b.tilt.tiltRoi)}%</p>
                </Linha>
                <Linha className="!p-2.5">
                  <p className="text-[11px] text-muted/80">Demais ({b.tilt.otherN})</p>
                  <p className="tnum mt-0.5 text-[14px] font-semibold" style={{ color: b.tilt.otherNet >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                    {fmtSignedMoneyIn(b.tilt.otherNet, b.moeda)}
                  </p>
                  <p className="text-[11px] text-muted">ROI {num1(b.tilt.otherRoi)}%</p>
                </Linha>
              </div>
            </div>
          )}
        </div>
      </PainelCard>

      {/* ---------------- BRM por formato ---------------- */}
      <PainelCard title="BRM por formato" icon={<Gauge size={15} />} ordem={3} className="xl:col-span-2 tela-cheia:min-h-0">
        <Calculadora b={b} />
        <p className="mb-2 mt-3 text-[12px] text-muted">
          Quantos buy-ins sua banca precisa cobrir pra subir ou descer de stake. Clique nos números pra mudar.
        </p>
        <ul className="grid grid-cols-1 gap-2">
          {leituras.map((l) => (
            <li key={l.formato}>
              <Linha className="flex h-full flex-col gap-2">
                <LimitesEditaveis limite={l.limite} onSalvar={b.salvarLimite} />
                {l.leitura ? (
                  <ReguaBrm leitura={l.leitura} compacta />
                ) : (
                  <p className="text-[12px] text-muted/80">Sem sessões de {l.formato} ainda.</p>
                )}
              </Linha>
            </li>
          ))}
        </ul>
      </PainelCard>

      <LimiteDoDia b={b} />
    </div>
  );
}

function LimitesEditaveis({ limite, onSalvar }: { limite: BrmThreshold; onSalvar: (f: BrmFormat, sobe: number, desce: number) => void }) {
  const [sobe, setSobe] = useState(String(limite.moveupBuyins));
  const [desce, setDesce] = useState(String(limite.movedownBuyins));
  useEffect(() => {
    setSobe(String(limite.moveupBuyins));
    setDesce(String(limite.movedownBuyins));
  }, [limite.moveupBuyins, limite.movedownBuyins]);

  function gravar() {
    const u = numero(sobe) || limite.moveupBuyins;
    const d = numero(desce) || limite.movedownBuyins;
    if (u !== limite.moveupBuyins || d !== limite.movedownBuyins) onSalvar(limite.format, u, d);
  }
  const campo = "w-14 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-1 text-center text-[12.5px] tabular-nums text-ink outline-none focus:border-[#d4af37]/60";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="min-w-[42px] text-[14px] font-semibold text-ink">{limite.format}</span>
      <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
        Desce abaixo de
        <input aria-label={`Descer de stake em ${limite.format} abaixo de`} value={desce} onChange={(e) => setDesce(e.target.value)} onBlur={gravar} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className={campo} />
      </label>
      <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
        Sobe com
        <input aria-label={`Subir de stake em ${limite.format} a partir de`} value={sobe} onChange={(e) => setSobe(e.target.value)} onBlur={gravar} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} className={campo} />
      </label>
    </div>
  );
}

function Calculadora({ b }: { b: Banca }) {
  const [formato, setFormato] = useState<BrmFormat>((b.brm?.format as BrmFormat) ?? "MTT");
  const [buyIn, setBuyIn] = useState("");
  const banca = b.patrimonio.playingBankroll;
  const limite = thresholdFor(b.limites, formato);
  const v = numero(buyIn);
  const cobre = v > 0 ? banca / v : null;
  const status = cobre == null ? null : cobre >= limite.moveupBuyins ? "moveup" : cobre < limite.movedownBuyins ? "movedown" : "hold";
  const maximo = limite.movedownBuyins > 0 ? banca / limite.movedownBuyins : 0;

  return (
    <Linha className="flex flex-col gap-2">
      <p className="text-[12.5px] font-medium text-ink/90">Posso jogar esse buy-in?</p>
      <div className="flex gap-2">
        <select value={formato} onChange={(e) => setFormato(e.target.value as BrmFormat)} aria-label="Formato" className={`${CAMPO} !w-auto !py-2`}>
          {FORMATOS_BRM.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <input inputMode="decimal" placeholder={`Buy-in (${b.moeda})`} value={buyIn} onChange={(e) => setBuyIn(e.target.value)} className={`${CAMPO} !py-2`} />
      </div>
      {cobre != null && status ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] text-muted">
            Cobre <span className="font-semibold tabular-nums text-ink">{num1(cobre)}</span> buy-ins
          </p>
          <Selo cor={STATUS_BRM[status].cor} pequeno>
            {STATUS_BRM[status].rotulo}
          </Selo>
        </div>
      ) : (
        <p className="text-[11.5px] text-muted">Buy-in máximo hoje em {formato}: {fmtMoneyIn(Math.max(0, maximo), b.moeda)}.</p>
      )}
    </Linha>
  );
}

// "Isso é variância?": faixa provável das próximas 100 sessões e se a
// queda atual é normal pro seu jogo (ver lib/bankroll/variancia.ts).
function CardVariancia({ b }: { b: Banca }) {
  const [roiTexto, setRoiTexto] = useState("");
  const roiEsperado = roiTexto.trim() === "" ? null : numero(roiTexto);
  const v = useMemo(
    () =>
      simularVariancia(b.sessoesMoeda, {
        inicio: b.patrimonio.playingBankroll,
        roiEsperado: roiEsperado != null && Number.isFinite(roiEsperado) ? roiEsperado : null,
        quedaAtual: b.queda.emDinheiro,
      }),
    [b.sessoesMoeda, b.patrimonio.playingBankroll, roiEsperado, b.queda.emDinheiro],
  );
  const fim = v?.leque[v.leque.length - 1];
  const bi = (x: number) => (b.agg.avgBuyIn > 0 ? `${num1(x / b.agg.avgBuyIn)} BI` : fmtMoneyIn(x, b.moeda));
  const leitura =
    v?.chanceQueda == null
      ? null
      : v.chanceQueda >= 25
        ? { cor: COR_POSITIVO, texto: "Normal: é variância." }
        : v.chanceQueda >= 10
          ? { cor: "#f59e0b", texto: "Pouco comum, mas acontece." }
          : { cor: COR_NEGATIVO, texto: "Incomum: vale revisar o jogo (ou seu ROI real é menor)." };

  return (
    <PainelCard
      title="Isso é variância?"
      icon={<Dices size={15} />}
      ordem={1}
      rolagem={false}
      className="md:col-span-2 xl:col-span-3 tela-cheia:min-h-0"
      action={
        v && (
          <label className="flex items-center gap-1.5 text-[11.5px] text-muted" title="Teste outro ROI: deixe em branco pra usar o seu histórico">
            ROI
            <input
              inputMode="decimal"
              value={roiTexto}
              onChange={(e) => setRoiTexto(e.target.value)}
              placeholder={num1(v.roiHistorico)}
              className="w-14 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-1 text-center tabular-nums text-ink outline-none focus:border-[#d4af37]/60"
            />
            %
          </label>
        )
      }
    >
      {!v || !fim ? (
        <p className="text-sm text-muted">
          Precisa de pelo menos {AMOSTRA_MINIMA_VARIANCIA} sessões pra simular. Você tem {b.sessoesMoeda.length}.
        </p>
      ) : (
        <div className="flex min-h-[240px] flex-1 flex-col tela-cheia:min-h-0">
          <div className="mb-1 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
            <InfoHover
              explicacao={{
                titulo: "Faixa provável",
                oQueE: "Sorteamos 1.000 sequências de 100 sessões usando os seus resultados reais. Em 8 de cada 10, a banca terminou dentro dessa faixa.",
                origem: "Gestão de Banca · suas sessões",
                comoCalcula: `ROI usado: ${num1(v.roiUsado)}% (${roiEsperado == null ? "o seu histórico" : "o que você digitou"}), amostra de ${v.amostra} sessões.`,
              }}
            >
              <p>
                Em 100 sessões:{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {fmtMoneyIn(fim.p10, b.moeda)} a {fmtMoneyIn(fim.p90, b.moeda)}
                </span>
              </p>
            </InfoHover>
            {leitura && v.chanceQueda != null && (
              <InfoHover
                explicacao={{
                  titulo: "Sua queda atual é normal?",
                  oQueE: `Em sequências do tamanho da sua amostra, uma queda de ${bi(b.queda.emDinheiro)} ou maior apareceu em ${Math.round(v.chanceQueda)}% das simulações.`,
                  origem: "Gestão de Banca · suas sessões",
                  comoCalcula: `Maior queda típica pro seu jogo: ${bi(v.quedaTipica)}.`,
                }}
              >
                <p>
                  Queda de {bi(b.queda.emDinheiro)}: <span style={{ color: leitura.cor }} className="font-semibold">{leitura.texto}</span>
                </p>
              </InfoHover>
            )}
          </div>
          <LequeVariancia leque={v.leque} moeda={b.moeda} />
        </div>
      )}
    </PainelCard>
  );
}

// Limite de perda do dia (stop-loss): em buy-ins, com aviso perto de
// bater e notificação quando bate.
function LimiteDoDia({ b }: { b: Banca }) {
  const [outro, setOutro] = useState("");
  const opcoes = ["0", "3", "5", "8", "10"];
  const atual = b.limiteDia == null ? "0" : String(b.limiteDia);
  const { hoje } = b;
  const cor = hoje.status === "atingido" ? COR_NEGATIVO : hoje.status === "perto" ? "#f59e0b" : COR_POSITIVO;

  return (
    <PainelCard title="Limite de perda do dia" icon={<OctagonAlert size={15} />} ordem={4} className="xl:col-span-2 tela-cheia:min-h-0">
      <div className="flex flex-col gap-2.5">
        <p className="text-[12px] text-muted">Quanto você aceita perder num dia antes de parar. Em buy-ins do formato que você mais joga.</p>
        <Escolhas
          valor={opcoes.includes(atual) ? atual : ""}
          opcoes={opcoes.map((o) => ({ value: o, label: o === "0" ? "Desligado" : `${o} BI` }))}
          onChange={(o) => b.salvarLimiteDia(o === "0" ? null : Number(o))}
        />
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            placeholder="Outro valor (BI)"
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && numero(outro) > 0) {
                b.salvarLimiteDia(numero(outro));
                setOutro("");
              }
            }}
            className={`${CAMPO} !py-2`}
          />
          <button
            type="button"
            disabled={!(numero(outro) > 0)}
            onClick={() => {
              b.salvarLimiteDia(numero(outro));
              setOutro("");
            }}
            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] font-medium text-ink transition hover:border-white/20 disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
        {hoje.limite != null ? (
          <Linha className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] text-muted">Hoje ({hoje.n} {hoje.n === 1 ? "sessão" : "sessões"})</span>
              <span className="tnum text-[16px] font-bold" style={{ color: hoje.resultado >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                {fmtSignedMoneyIn(hoje.resultado, b.moeda)}
              </span>
            </div>
            <BarraProgresso pct={hoje.pct} cor={cor} className="h-1.5" />
            <p className="text-[11.5px] text-muted">
              {hoje.status === "atingido"
                ? "Limite batido. Hora de parar por hoje."
                : `Pode perder até ${fmtMoneyIn(hoje.limite, b.moeda)} hoje (${b.limiteDia} BI de ${fmtMoneyIn(hoje.buyInRef, b.moeda)}).`}
            </p>
          </Linha>
        ) : b.limiteDia != null ? (
          <p className="text-[11.5px] text-muted">Registre sessões pra calcular o buy-in de referência.</p>
        ) : null}
      </div>
    </PainelCard>
  );
}
