import { aggregate, evolutionSeries, groupStats, brmReading, tiltImpact } from "./calc";
import { fmtMoney, fmtPct } from "./format";
import type { Session, BrmThreshold } from "./types";

const MIN_SAMPLE = 12;
const MIN_SAMPLE_DIM = 8;
const DD_WARN = 10;
const DD_ACTION = 20;
const LOW_VOLUME = 20;

export interface CoachTip {
  id: string;
  level: "info" | "good" | "warn" | "bad";
  title: string;
  text: string;
}

export function drawdownBuyIns(sessions: Session[], avgBuyIn: number) {
  const series = evolutionSeries(sessions);
  let peak = 0,
    dd = 0;
  for (const p of series) {
    if (p.value > peak) peak = p.value;
    dd = Math.max(dd, peak - p.value);
  }
  return avgBuyIn > 0 ? dd / avgBuyIn : 0;
}

export function buildCoachTips(
  sessions: Session[],
  opts: { bankroll?: number; brmThresholds?: BrmThreshold[] } = {}
): CoachTip[] {
  const a = aggregate(sessions);
  if (a.n === 0) {
    return [
      {
        id: "empty",
        level: "info",
        title: "Sem dados ainda",
        text: "Registre sua primeira sessao para o Coach analisar sua banca.",
      },
    ];
  }
  const tips: CoachTip[] = [];
  const ddBI = drawdownBuyIns(sessions, a.avgBuyIn);
  if (ddBI >= DD_ACTION) {
    tips.push({
      id: "dd",
      level: "bad",
      title: `Downswing de ${Math.round(ddBI)} buy-ins`,
      text: "Considere descer de limite temporariamente e revisar sua selecao de mesas ate estabilizar.",
    });
  } else if (ddBI >= DD_WARN) {
    tips.push({
      id: "dd",
      level: "warn",
      title: `Atencao: ${Math.round(ddBI)} buy-ins abaixo do topo`,
      text: "Variancia dentro do normal, mas monitore seu BRM se o downswing continuar.",
    });
  }
  const perFmt = groupStats(sessions, "format");
  const eligible = perFmt.filter((g) => g.n >= MIN_SAMPLE);
  const best = [...eligible].sort((x, y) => y.roi - x.roi)[0];
  const worst = [...eligible].sort((x, y) => x.roi - y.roi)[0];
  if (best && best.roi > 0) {
    tips.push({
      id: "best",
      level: "good",
      title: `${best.key} e seu formato mais lucrativo`,
      text: `ROI de ${fmtPct(best.roi)} em ${best.n} sessoes. Priorize este formato neste mes.`,
    });
  }
  if (worst && worst.roi < 0 && (!best || worst.key !== best.key)) {
    tips.push({
      id: "worst",
      level: "bad",
      title: `Vazamento em ${worst.key}`,
      text: `ROI de ${fmtPct(worst.roi)} em ${worst.n} sessoes. Reduza volume ou revise a estrategia.`,
    });
  }

  // Melhor/pior dia da semana e melhor/pior periodo do dia -- mesma logica
  // do melhor/pior formato acima, so trocando a dimensao de agrupamento.
  // Amostra minima menor (MIN_SAMPLE_DIM) porque o volume total se espalha
  // por mais grupos (7 dias, 4 periodos) do que os poucos formatos jogados.
  const perWeekday = groupStats(sessions, "weekday");
  const eligibleWeekday = perWeekday.filter((g) => g.n >= MIN_SAMPLE_DIM);
  const bestWeekday = [...eligibleWeekday].sort((x, y) => y.roi - x.roi)[0];
  const worstWeekday = [...eligibleWeekday].sort((x, y) => x.roi - y.roi)[0];
  if (bestWeekday && bestWeekday.roi > 0) {
    tips.push({
      id: "best-weekday",
      level: "good",
      title: `${bestWeekday.key} e seu melhor dia`,
      text: `ROI de ${fmtPct(bestWeekday.roi)} em ${bestWeekday.n} sessoes nesse dia. Se der pra escolher, concentre volume aqui.`,
    });
  }
  if (worstWeekday && worstWeekday.roi < 0 && (!bestWeekday || worstWeekday.key !== bestWeekday.key)) {
    tips.push({
      id: "worst-weekday",
      level: "warn",
      title: `${worstWeekday.key} costuma pesar no resultado`,
      text: `ROI de ${fmtPct(worstWeekday.roi)} em ${worstWeekday.n} sessoes. Vale observar o que muda nesse dia — cansaco, rotina, adversarios mais fortes.`,
    });
  }

  const perTime = groupStats(sessions, "time");
  const eligibleTime = perTime.filter((g) => g.n >= MIN_SAMPLE_DIM);
  const bestTime = [...eligibleTime].sort((x, y) => y.roi - x.roi)[0];
  const worstTime = [...eligibleTime].sort((x, y) => x.roi - y.roi)[0];
  if (bestTime && bestTime.roi > 0) {
    tips.push({
      id: "best-time",
      level: "good",
      title: `${bestTime.key} e seu melhor periodo`,
      text: `ROI de ${fmtPct(bestTime.roi)} em ${bestTime.n} sessoes jogando de ${bestTime.key.toLowerCase()}.`,
    });
  }
  if (worstTime && worstTime.roi < 0 && (!bestTime || worstTime.key !== bestTime.key)) {
    tips.push({
      id: "worst-time",
      level: "warn",
      title: `${worstTime.key} e seu periodo mais fraco`,
      text: `ROI de ${fmtPct(worstTime.roi)} em ${worstTime.n} sessoes. Se possivel, evite sessoes importantes nesse horario ate entender o motivo.`,
    });
  }

  if (opts.bankroll) {
    const reading = brmReading(sessions, opts.bankroll, opts.brmThresholds || []);
    if (reading) {
      if (reading.status === "movedown") {
        tips.push({
          id: "brm",
          level: "bad",
          title: `Banca abaixo do minimo pra ${reading.format} (${reading.buyInsCovered} buy-ins)`,
          text: `Seu threshold de movedown em ${reading.format} e' ${reading.threshold.movedownBuyins} buy-ins. Considere descer de stake ate reforcar a banca.`,
        });
      } else if (reading.status === "moveup") {
        tips.push({
          id: "brm",
          level: "good",
          title: `Banca cobre ${reading.buyInsCovered} buy-ins em ${reading.format}`,
          text: `Acima do seu threshold de moveup (${reading.threshold.moveupBuyins} buy-ins). Pode considerar subir de stake com disciplina.`,
        });
      } else {
        tips.push({
          id: "brm",
          level: "info",
          title: `Banca cobre ${reading.buyInsCovered} buy-ins em ${reading.format}`,
          text: `Dentro da faixa (entre ${reading.threshold.movedownBuyins} e ${reading.threshold.moveupBuyins} buy-ins). Mantenha o stake atual.`,
        });
      }
    }
  }
  if (a.profit > 0 && ddBI < DD_WARN) {
    tips.push({
      id: "up",
      level: "good",
      title: `Banca em alta: ${fmtMoney(a.profit)}`,
      text: `ROI geral de ${fmtPct(a.roi)}. Mantenha a disciplina de BRM e o volume.`,
    });
  }
  const MIN_TILT_SAMPLE = 5;
  const tilt = tiltImpact(sessions);
  if (tilt && tilt.tiltN >= MIN_TILT_SAMPLE) {
    const gap = tilt.otherRoi - tilt.tiltRoi;
    if (gap >= 15) {
      tips.push({
        id: "tilt",
        level: "bad",
        title: "Tilt esta custando caro",
        text: `ROI de ${fmtPct(tilt.tiltRoi)} em sessoes marcadas como tilt (${tilt.tiltN}) contra ${fmtPct(tilt.otherRoi)} nas demais. Considere parar a sessao ao notar o padrao.`,
      });
    }
  }

  if (a.n < LOW_VOLUME) {
    tips.push({
      id: "sample",
      level: "info",
      title: "Amostra ainda pequena",
      text: `Com ${a.n} sessoes, os numeros tem alta variancia. Use como tendencia, nao como verdade.`,
    });
  }
  return tips;
}
