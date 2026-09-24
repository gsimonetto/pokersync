"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { SeriesPoint, DayActivity } from "@/lib/bankroll/calc";
import type { Annotation } from "@/lib/bankroll/types";
import { fmtMoneyIn, fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { niceTicks } from "@/lib/format";
import { DicaGrafico } from "@/components/performance/graficos/base";
import { formatadorMoeda } from "@/components/performance/graficos/torneios";
import { useTamanho } from "@/components/performance/graficos/usar-largura";
import type { PontoSaldo } from "./use-banca";
import type { FaixaPasso } from "@/lib/bankroll/variancia";
import { COR_NEGATIVO, COR_POSITIVO, COR_UNICA, dataBR, dataEixo } from "./util";

// Gráficos da Gestão de Banca. Mesma linguagem da Performance (linha
// dourada de 2px que se desenha ao aparecer, área suave, grade discreta,
// caixinha ao passar o mouse), mas cada um ocupa a ALTURA que o card
// tiver -- no computador a tela inteira cabe na janela, então o gráfico
// estica ou encolhe junto com o card em vez de ter altura fixa.

const M = { t: 12, r: 14, b: 24, l: 62 };
const ALTURA_MIN = 150;

// Pontos mais próximos do mouse (por x).
function maisProximo(xs: number[], px: number): number {
  let melhor = 0;
  let dist = Infinity;
  xs.forEach((x, i) => {
    const d = Math.abs(x - px);
    if (d < dist) {
      dist = d;
      melhor = i;
    }
  });
  return melhor;
}

// ---------------------------------------------------------------------
// Evolução do saldo: sessões + depósitos/saques, termina na banca atual.
export function CurvaSaldo({ pontos, anotacoes, moeda }: { pontos: PontoSaldo[]; anotacoes: Annotation[]; moeda: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const { largura, altura: alturaCaixa } = useTamanho(caixa);
  const altura = Math.max(ALTURA_MIN, alturaCaixa);
  const [foco, setFoco] = useState<number | null>(null);
  const fmtEixo = useMemo(() => formatadorMoeda(moeda, true), [moeda]);
  const fmt = (v: number) => fmtMoneyIn(v, moeda);

  const valores = pontos.map((p) => p.valor);
  const minV = Math.min(...valores, 0);
  const maxV = Math.max(...valores, 0);
  const marcas = niceTicks(minV, maxV, 4);
  const lo = Math.min(minV, marcas[0]);
  const hi = Math.max(maxV, marcas[marcas.length - 1]);
  const w = Math.max(0, largura - M.l - M.r);
  const h = Math.max(0, altura - M.t - M.b);
  const x = (i: number) => M.l + (pontos.length <= 1 ? w / 2 : (i / (pontos.length - 1)) * w);
  const y = (v: number) => M.t + h - ((v - lo) / (hi - lo || 1)) * h;
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");
  const fundo = pontos.length ? `${linha} L${x(pontos.length - 1).toFixed(1)},${y(lo).toFixed(1)} L${x(0).toFixed(1)},${y(lo).toFixed(1)} Z` : "";

  // Anotação cai no ponto de data mais próxima (dia anotado nem sempre tem sessão).
  const marcadas = useMemo(
    () =>
      anotacoes
        .map((a) => {
          if (pontos.length === 0) return null;
          const alvo = new Date(a.date).getTime();
          let idx = 0;
          let dif = Infinity;
          pontos.forEach((p, i) => {
            const d = Math.abs(new Date(p.date).getTime() - alvo);
            if (d <= dif) {
              dif = d;
              idx = i;
            }
          });
          return { ...a, idx };
        })
        .filter((a): a is Annotation & { idx: number } => a !== null),
    [anotacoes, pontos],
  );

  const p = foco != null ? pontos[foco] : null;
  const notaFoco = foco != null ? marcadas.filter((a) => a.idx === foco) : [];
  const idxEixo = pontos.length > 2 ? [0, Math.floor((pontos.length - 1) / 2), pontos.length - 1] : pontos.length === 2 ? [0, 1] : [0];

  return (
    <div ref={caixa} className="relative min-h-[150px] w-full flex-1" onMouseLeave={() => setFoco(null)}>
      {pontos.length < 2 ? (
        <p className="text-sm text-muted">Registre uma sessão ou um depósito pra ver a curva da sua banca.</p>
      ) : (
        largura > 0 && (
          <svg
            width={largura}
            height={altura}
            className="absolute inset-0"
            role="img"
            aria-label="Evolução do saldo da banca"
            onMouseMove={(e) => {
              const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
              setFoco(maisProximo(pontos.map((_, i) => x(i)), px));
            }}
          >
            <defs>
              <linearGradient id="banca-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={COR_UNICA} stopOpacity={0.26} />
                <stop offset="100%" stopColor={COR_UNICA} stopOpacity={0} />
              </linearGradient>
            </defs>
            {marcas.map((g) => (
              <g key={g}>
                <line x1={M.l} x2={M.l + w} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.05)" />
                <text x={M.l - 8} y={y(g)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="rgba(255,255,255,0.4)">
                  {fmtEixo(g)}
                </text>
              </g>
            ))}
            {lo < 0 && <line x1={M.l} x2={M.l + w} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />}
            <motion.path d={fundo} fill="url(#banca-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.8 }} />
            <motion.path
              d={linha}
              fill="none"
              stroke={COR_UNICA}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
            />
            {/* Depósito/saque/caixinha: marquinha própria, pra não confundir com resultado de jogo. */}
            {pontos.map((pt, i) =>
              pt.tipo === "deposito" || pt.tipo === "saque" || pt.tipo === "caixinha" ? (
                <rect key={`t${i}`} x={x(i) - 3} y={y(pt.valor) - 3} width={6} height={6} rx={1.5} fill="#141414" stroke="#4a90d9" strokeWidth={1.5} />
              ) : null,
            )}
            {marcadas.map((a) => (
              <circle key={a.id} cx={x(a.idx)} cy={y(pontos[a.idx].valor)} r={3.5} fill="#a855f7" stroke="#141414" strokeWidth={1.5} />
            ))}
            {idxEixo.map((i, k) => (
              <text
                key={i}
                x={x(i)}
                y={altura - 6}
                textAnchor={k === 0 ? "start" : k === idxEixo.length - 1 ? "end" : "middle"}
                fontSize={10}
                fill="rgba(255,255,255,0.4)"
              >
                {dataEixo(pontos[i].date)}
              </text>
            ))}
            {p && foco != null && (
              <g pointerEvents="none">
                <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={M.t + h} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                <circle cx={x(foco)} cy={y(p.valor)} r={4.5} fill={COR_UNICA} stroke="#141414" strokeWidth={2} />
              </g>
            )}
          </svg>
        )
      )}
      <DicaGrafico aberta={!!p} x={foco != null ? x(foco) : 0} y={p ? y(p.valor) + 24 : 0} largura={largura}>
        {p && (
          <>
            <p className="font-semibold text-ink">
              {dataBR(p.date)} · {p.rotulo}
            </p>
            {p.tipo !== "inicio" && (
              <p className="tabular-nums" style={{ color: p.variacao >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>
                {p.tipo === "sessao" ? "Resultado" : "Movimentação"}: {fmtSignedMoneyIn(p.variacao, moeda)}
              </p>
            )}
            <p className="tabular-nums text-ink/90">Saldo: {fmt(p.valor)}</p>
            {notaFoco.map((a) => (
              <p key={a.id} className="mt-1 text-[11px] text-[#c4a1f5]">
                📝 {a.note}
              </p>
            ))}
          </>
        )}
      </DicaGrafico>
    </div>
  );
}

// ---------------------------------------------------------------------
// Queda desde o topo ("underwater"): 0 = no pico; abaixo = quanto falta
// pra voltar ao melhor momento. Só resultado de jogo (depósito não
// "recupera" uma queda).
export function GraficoQueda({ serie, moeda, buyInMedio }: { serie: SeriesPoint[]; moeda: string; buyInMedio: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const { largura, altura: alturaCaixa } = useTamanho(caixa);
  const altura = Math.max(ALTURA_MIN, alturaCaixa);
  const [foco, setFoco] = useState<number | null>(null);
  const fmtEixo = useMemo(() => formatadorMoeda(moeda, true), [moeda]);

  const lo = Math.min(...serie.map((p) => p.value), -1);
  const marcas = niceTicks(lo, 0, 3);
  const piso = Math.min(lo, marcas[0]);
  const w = Math.max(0, largura - M.l - M.r);
  const h = Math.max(0, altura - M.t - M.b);
  const x = (i: number) => M.l + (serie.length <= 1 ? w / 2 : (i / (serie.length - 1)) * w);
  const y = (v: number) => M.t + (v / piso) * h;
  const linha = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = serie.length ? `${linha} L${x(serie.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z` : "";
  const p = foco != null ? serie[foco] : null;

  return (
    <div ref={caixa} className="relative min-h-[150px] w-full flex-1" onMouseLeave={() => setFoco(null)}>
      {serie.length < 2 ? (
        <p className="text-sm text-muted">Registre pelo menos 2 sessões pra ver as quedas da banca.</p>
      ) : (
        largura > 0 && (
          <svg
            width={largura}
            height={altura}
            className="absolute inset-0"
            role="img"
            aria-label="Queda da banca desde o topo"
            onMouseMove={(e) => {
              const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
              setFoco(maisProximo(serie.map((_, i) => x(i)), px));
            }}
          >
            <defs>
              <linearGradient id="banca-queda" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={COR_NEGATIVO} stopOpacity={0.05} />
                <stop offset="100%" stopColor={COR_NEGATIVO} stopOpacity={0.35} />
              </linearGradient>
            </defs>
            {marcas.map((g) => (
              <g key={g}>
                <line x1={M.l} x2={M.l + w} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.05)" />
                <text x={M.l - 8} y={y(g)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="rgba(255,255,255,0.4)">
                  {fmtEixo(g)}
                </text>
              </g>
            ))}
            <line x1={M.l} x2={M.l + w} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.3)" />
            <motion.path d={area} fill="url(#banca-queda)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
            <motion.path
              d={linha}
              fill="none"
              stroke={COR_NEGATIVO}
              strokeWidth={1.75}
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
            {[0, serie.length - 1].map((i, k) => (
              <text key={i} x={x(i)} y={altura - 6} textAnchor={k === 0 ? "start" : "end"} fontSize={10} fill="rgba(255,255,255,0.4)">
                {dataEixo(serie[i].date)}
              </text>
            ))}
            {p && foco != null && (
              <g pointerEvents="none">
                <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={M.t + h} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
                <circle cx={x(foco)} cy={y(p.value)} r={4} fill={COR_NEGATIVO} stroke="#141414" strokeWidth={2} />
              </g>
            )}
          </svg>
        )
      )}
      <DicaGrafico aberta={!!p} x={foco != null ? x(foco) : 0} y={p ? y(p.value) + 24 : 0} largura={largura}>
        {p && (
          <>
            <p className="font-semibold text-ink">{dataBR(p.date)}</p>
            {p.value === 0 ? (
              <p className="text-[#22c55e]">No topo da banca</p>
            ) : (
              <>
                <p className="tabular-nums" style={{ color: COR_NEGATIVO }}>
                  {fmtMoneyIn(p.value, moeda)} do topo
                </p>
                {buyInMedio > 0 && (
                  <p className="tabular-nums text-ink/80">
                    {(Math.abs(p.value) / buyInMedio).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} buy-ins
                  </p>
                )}
              </>
            )}
          </>
        )}
      </DicaGrafico>
    </div>
  );
}

// ---------------------------------------------------------------------
// Calendário de volume (estilo GitHub): cada coluna uma semana, cada
// quadradinho um dia. Cor = ganhou (verde) ou perdeu (vermelho); mais
// forte = resultado maior. O tamanho do quadrado se ajusta à largura E à
// altura do card, pra caber inteiro sem barra de rolagem.
export function CalendarioVolume({ atividade, moeda }: { atividade: Record<string, DayActivity>; moeda: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const { largura, altura } = useTamanho(caixa);
  const [foco, setFoco] = useState<string | null>(null);

  const GAP = 3;
  const lado = largura > 0 && altura > 0 ? Math.max(8, Math.min(22, (altura - GAP * 6 - 18) / 7)) : 12;
  const semanas = Math.max(8, Math.min(30, Math.floor((largura + GAP) / (lado + GAP)) || 20));

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimSemana = new Date(hoje);
  fimSemana.setDate(hoje.getDate() + (6 - hoje.getDay()));
  const inicio = new Date(fimSemana);
  inicio.setDate(fimSemana.getDate() - semanas * 7 + 1);

  const colunas: { iso: string; futuro: boolean }[][] = [];
  for (let s = 0; s < semanas; s++) {
    const col: { iso: string; futuro: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dia = new Date(inicio);
      dia.setDate(inicio.getDate() + s * 7 + d);
      const iso = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`;
      col.push({ iso, futuro: dia > hoje });
    }
    colunas.push(col);
  }
  const maxAbs = Math.max(...Object.values(atividade).map((a) => Math.abs(a.net)), 1);
  const cor = (a?: DayActivity) => {
    if (!a || a.n === 0) return "rgba(255,255,255,0.05)";
    const alfa = 0.25 + Math.min(1, Math.abs(a.net) / maxAbs) * 0.65;
    return a.net >= 0 ? `rgba(34,197,94,${alfa})` : `rgba(224,85,90,${alfa})`;
  };
  const f = foco ? atividade[foco] : null;
  const diasJogados = Object.keys(atividade).filter((k) => k >= colunas[0][0].iso).length;

  return (
    <div ref={caixa} className="flex min-h-[140px] w-full flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex" style={{ gap: GAP }}>
          {colunas.map((col, ci) => (
            <div key={ci} className="flex flex-col" style={{ gap: GAP }}>
              {col.map(({ iso, futuro }) => (
                <motion.div
                  key={iso}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, delay: 0.2 + ci * 0.012 }}
                  onMouseEnter={() => !futuro && setFoco(iso)}
                  onMouseLeave={() => setFoco((k) => (k === iso ? null : k))}
                  className="rounded-[4px] transition-transform hover:scale-110"
                  style={{ width: lado, height: lado, background: futuro ? "transparent" : cor(atividade[iso]) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 h-4 text-center text-[11px] text-muted">
        {foco ? (
          <>
            <span className="font-semibold text-ink">{dataBR(foco)}</span>
            {f ? (
              <>
                {" "}· {f.n} {f.n === 1 ? "sessão" : "sessões"} ·{" "}
                <span style={{ color: f.net >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>{fmtSignedMoneyIn(f.net, moeda)}</span>
              </>
            ) : (
              " · sem sessão"
            )}
          </>
        ) : (
          `${diasJogados} ${diasJogados === 1 ? "dia jogado" : "dias jogados"} nas últimas ${semanas} semanas`
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Leque da variância: onde a banca deve estar nas próximas sessões. Faixa
// clara = 80% dos casos (10% a 90%), faixa forte = metade do meio (25% a
// 75%), linha = o caso típico (mediana). Uma cor só (dourado) em
// intensidades -- é a mesma grandeza, só a confiança muda.
export function LequeVariancia({ leque, moeda }: { leque: FaixaPasso[]; moeda: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const { largura, altura: alturaCaixa } = useTamanho(caixa);
  const altura = Math.max(ALTURA_MIN, alturaCaixa);
  const [foco, setFoco] = useState<number | null>(null);
  const fmtEixo = useMemo(() => formatadorMoeda(moeda, true), [moeda]);

  const minV = Math.min(...leque.map((p) => p.p10));
  const maxV = Math.max(...leque.map((p) => p.p90));
  const marcas = niceTicks(minV, maxV, 4);
  const lo = Math.min(minV, marcas[0]);
  const hi = Math.max(maxV, marcas[marcas.length - 1]);
  const w = Math.max(0, largura - M.l - M.r);
  const h = Math.max(0, altura - M.t - M.b);
  const ultimo = leque.length - 1;
  const x = (i: number) => M.l + (ultimo <= 0 ? 0 : (i / ultimo) * w);
  const y = (v: number) => M.t + h - ((v - lo) / (hi - lo || 1)) * h;
  const faixa = (a: keyof FaixaPasso, b: keyof FaixaPasso) =>
    leque.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[a]).toFixed(1)}`).join(" ") +
    " " +
    [...leque]
      .reverse()
      .map((p, k) => `L${x(ultimo - k).toFixed(1)},${y(p[b]).toFixed(1)}`)
      .join(" ") +
    " Z";
  const mediana = leque.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.p50).toFixed(1)}`).join(" ");
  const p = foco != null ? leque[foco] : null;

  return (
    <div ref={caixa} className="relative min-h-[150px] w-full flex-1" onMouseLeave={() => setFoco(null)}>
      {largura > 0 && (
        <svg
          width={largura}
          height={altura}
          className="absolute inset-0"
          role="img"
          aria-label="Faixa provável da banca nas próximas sessões"
          onMouseMove={(e) => {
            const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
            setFoco(Math.max(0, Math.min(ultimo, Math.round(((px - M.l) / Math.max(1, w)) * ultimo))));
          }}
        >
          {marcas.map((g) => (
            <g key={g}>
              <line x1={M.l} x2={M.l + w} y1={y(g)} y2={y(g)} stroke="rgba(255,255,255,0.05)" />
              <text x={M.l - 8} y={y(g)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="rgba(255,255,255,0.4)">
                {fmtEixo(g)}
              </text>
            </g>
          ))}
          {lo < 0 && <line x1={M.l} x2={M.l + w} y1={y(0)} y2={y(0)} stroke={COR_NEGATIVO} strokeOpacity={0.6} strokeDasharray="4 4" />}
          <motion.path d={faixa("p10", "p90")} fill={COR_UNICA} fillOpacity={0.12} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
          <motion.path d={faixa("p25", "p75")} fill={COR_UNICA} fillOpacity={0.22} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.45 }} />
          <motion.path
            d={mediana}
            fill="none"
            stroke={COR_UNICA}
            strokeWidth={2}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
          <text x={M.l} y={altura - 6} fontSize={10} fill="rgba(255,255,255,0.4)">
            hoje
          </text>
          <text x={M.l + w} y={altura - 6} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.4)">
            +{ultimo} sessões
          </text>
          {p && foco != null && (
            <line x1={x(foco)} x2={x(foco)} y1={M.t} y2={M.t + h} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" pointerEvents="none" />
          )}
        </svg>
      )}
      <DicaGrafico aberta={!!p} x={foco != null ? x(foco) : 0} y={p ? y(p.p50) : 0} largura={largura}>
        {p && (
          <>
            <p className="font-semibold text-ink">Depois de {p.passo} sessões</p>
            <p className="tabular-nums text-ink/90">Típico: {fmtMoneyIn(p.p50, moeda)}</p>
            <p className="tabular-nums text-muted">
              8 em 10 vezes: {fmtMoneyIn(p.p10, moeda)} a {fmtMoneyIn(p.p90, moeda)}
            </p>
          </>
        )}
      </DicaGrafico>
    </div>
  );
}
