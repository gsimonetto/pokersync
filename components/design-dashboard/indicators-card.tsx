"use client";

import { useEffect, useState } from "react";
import { Activity, BookOpen, Flame, Percent, Target, Trophy } from "lucide-react";
import { fetchPlayerPerformance, type PlayerPerformance } from "@/lib/services/performance-service";
import { fetchProgress, type Progress } from "@/lib/services/xp-service";
import { fetchTodayTrainingCount } from "@/lib/services/drill-service";
import { CardHint, GlassCard } from "./glass-card";

type Indicador = {
  rotulo: string;
  valor: string;
  detalhe: string;
  icone: typeof Flame;
  cor: string;
};

// Números que o app JÁ calcula hoje, reunidos num mosaico só. Tudo vem
// da view player_performance (a mesma do módulo Performance) e do
// user_progress (Hub de Evolução) -- nada é recalculado aqui.
function montar(perf: PlayerPerformance | null, progresso: Progress | null, drillsHoje: number | null): Indicador[] {
  const lista: Indicador[] = [];

  if (perf?.score_geral != null) {
    lista.push({
      rotulo: "Score geral",
      valor: String(Math.round(perf.score_geral)),
      detalhe: "de 100",
      icone: Activity,
      cor: "#22D3EE",
    });
  }
  if (perf?.roi_pct != null) {
    lista.push({
      rotulo: "ROI",
      valor: `${perf.roi_pct > 0 ? "+" : ""}${perf.roi_pct.toFixed(1)}%`,
      detalhe: `${perf.num_sessoes ?? 0} sessões`,
      icone: Percent,
      cor: perf.roi_pct >= 0 ? "#22c55e" : "#e0555a",
    });
  }
  if (progresso) {
    lista.push({
      rotulo: "Nível",
      valor: String(progresso.level),
      detalhe: `${progresso.xp_total} XP no total`,
      icone: Trophy,
      cor: "#E0B24C",
    });
    lista.push({
      rotulo: "Sequência",
      valor: String(progresso.streak_days),
      detalhe: `melhor: ${progresso.streak_best} dias`,
      icone: Flame,
      cor: "#F59E0B",
    });
  }
  if (perf?.taxa_acerto_treino_pct != null) {
    lista.push({
      rotulo: "Acerto no treino",
      valor: `${Math.round(perf.taxa_acerto_treino_pct)}%`,
      detalhe: drillsHoje != null ? `${drillsHoje} drill${drillsHoje === 1 ? "" : "s"} hoje` : `${perf.num_drills ?? 0} drills`,
      icone: Target,
      cor: "#2FB89A",
    });
  }
  if (perf?.maos_revisadas != null) {
    lista.push({
      rotulo: "Mãos revisadas",
      valor: String(perf.maos_revisadas),
      detalhe: "no total",
      icone: BookOpen,
      cor: "#A855F7",
    });
  }

  return lista;
}

export function IndicatorsCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const [itens, setItens] = useState<Indicador[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [perf, progresso, drills] = await Promise.allSettled([
        fetchPlayerPerformance(),
        fetchProgress(),
        fetchTodayTrainingCount(),
      ]);
      if (!vivo) return;
      setItens(
        montar(
          perf.status === "fulfilled" ? perf.value : null,
          progresso.status === "fulfilled" ? progresso.value : null,
          drills.status === "fulfilled" ? drills.value : null
        )
      );
      setCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <GlassCard title="Seus indicadores" icon={<Activity size={13} />} style={style} className={className}>
      {carregando ? (
        <CardHint>Carregando…</CardHint>
      ) : itens.length === 0 ? (
        <CardHint>Os indicadores aparecem assim que você registrar sessões, drills ou mãos.</CardHint>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5">
          {itens.map(({ rotulo, valor, detalhe, icone: Icone, cor }) => (
            <li key={rotulo} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
                <Icone size={12} color={cor} />
                {rotulo}
              </span>
              <p className="tnum mt-1.5 text-2xl font-light leading-none" style={{ color: cor }}>
                {valor}
              </p>
              <p className="mt-1 text-[11px] text-white/35">{detalhe}</p>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
