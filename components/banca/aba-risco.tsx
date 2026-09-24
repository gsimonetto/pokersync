"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Gauge, Skull, TrendingDown } from "lucide-react";
import { DEFAULT_BRM_THRESHOLDS, brmReading, thresholdFor } from "@/lib/bankroll/calc";
import type { BrmFormat, BrmThreshold } from "@/lib/bankroll/types";
import { fmtMoneyIn, fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { BarraProgresso, Linha, PainelCard, Selo } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";
import type { Banca } from "./use-banca";
import { GraficoQueda } from "./graficos";
import { Escolhas } from "./formulario-sessao";
import { ReguaBrm, STATUS_BRM, corRuina } from "./pecas";
import { CAMPO, COR_NEGATIVO, COR_POSITIVO, num1, numero } from "./util";

// Aba "Risco & BRM": tudo que responde "minha banca aguenta?".
//
//   ┌──────── Quedas da banca (4) ────────┐┌ Risco de ruína (2) ┐
//   ┌──────── BRM por formato (4) ────────┐┌ Calculadora (2) ───┐

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
      <PainelCard title="Quedas da banca" icon={<TrendingDown size={15} />} ordem={0} rolagem={false} className="md:col-span-2 xl:col-span-4 tela-cheia:min-h-0">
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
          <p className="mt-1 text-[11px] text-muted/80">
            Quanto a banca ficou abaixo do melhor momento, sessão a sessão (só resultado de jogo). BI = buy-ins do seu buy-in médio.
          </p>
        </div>
      </PainelCard>

      {/* ---------------- Risco de ruína + tilt ---------------- */}
      <PainelCard title="Risco de ruína" icon={<Skull size={15} />} ordem={1} className="xl:col-span-2 tela-cheia:min-h-0">
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
      <PainelCard title="BRM por formato" icon={<Gauge size={15} />} ordem={2} className="md:col-span-2 xl:col-span-4 tela-cheia:min-h-0">
        <p className="mb-2 text-[12px] text-muted">
          Quantos buy-ins sua banca precisa cobrir pra subir ou descer de stake em cada formato. Os números são editáveis: é só clicar e digitar.
        </p>
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
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

      {/* ---------------- Calculadora ---------------- */}
      <Calculadora b={b} />
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
  // Maior buy-in que a banca aguenta hoje pelo limite de "descer".
  const maximo = limite.movedownBuyins > 0 ? banca / limite.movedownBuyins : 0;
  const confortavel = limite.moveupBuyins > 0 ? banca / limite.moveupBuyins : 0;

  return (
    <PainelCard title="Posso jogar esse buy-in?" icon={<Calculator size={15} />} ordem={3} className="xl:col-span-2 tela-cheia:min-h-0">
      <div className="flex flex-col gap-2.5">
        <Escolhas valor={formato} opcoes={FORMATOS_BRM.map((f) => ({ value: f, label: f }))} onChange={setFormato} />
        <input inputMode="decimal" placeholder={`Buy-in (${b.moeda})`} value={buyIn} onChange={(e) => setBuyIn(e.target.value)} className={CAMPO} />
        {cobre != null && status ? (
          <Linha className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] text-muted">
              Cobre <span className="font-semibold tabular-nums text-ink">{num1(cobre)}</span> buy-ins
            </p>
            <Selo cor={STATUS_BRM[status].cor} pequeno>
              {STATUS_BRM[status].rotulo}
            </Selo>
          </Linha>
        ) : (
          <p className="text-[12px] text-muted">Digite o buy-in pra ver se cabe na sua banca de {fmtMoneyIn(banca, b.moeda)}.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Linha className="!p-2.5">
            <p className="text-[11px] text-muted/80">Confortável até</p>
            <p className="tnum mt-0.5 text-[14px] font-semibold text-ink">{fmtMoneyIn(Math.max(0, confortavel), b.moeda)}</p>
          </Linha>
          <Linha className="!p-2.5">
            <p className="text-[11px] text-muted/80">Limite máximo</p>
            <p className="tnum mt-0.5 text-[14px] font-semibold text-ink">{fmtMoneyIn(Math.max(0, maximo), b.moeda)}</p>
          </Linha>
        </div>
      </div>
    </PainelCard>
  );
}
