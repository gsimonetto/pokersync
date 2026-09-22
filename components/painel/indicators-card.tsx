"use client";

import { useEffect, useState } from "react";
import { Activity, BookOpen, Flame, Percent, Target, Trophy } from "lucide-react";
import { fetchPlayerPerformance, type PlayerPerformance } from "@/lib/services/performance-service";
import { fetchProgress, type Progress } from "@/lib/services/xp-service";
import { fetchTodayTrainingCount } from "@/lib/services/drill-service";
import { CardHint, Linha, PainelCard, TileIcone } from "./painel-card";

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
    <PainelCard title="Seus indicadores" icon={<Activity size={15} />} style={style} className={className}>
      {carregando ? (
        <CardHint>Carregando…</CardHint>
      ) : itens.length === 0 ? (
        <CardHint>Os indicadores aparecem assim que você registrar sessões, drills ou mãos.</CardHint>
      ) : (
        // Três colunas no computador: o card fica baixo quando a tela
        // inteira tem que caber sem rolagem, e 3x2 cabe onde 2x3 não
        // cabia. No celular continua 2 colunas, que é o confortável.
        <ul className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {itens.map(({ rotulo, valor, detalhe, icone: Icone, cor }) => (
            <li key={rotulo}>
              <Linha className="h-full !p-2.5">
                <span className="flex items-center gap-2">
                  <TileIcone cor={cor}>
                    <Icone size={14} />
                  </TileIcone>
                  <span className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-muted/70">
                    {rotulo}
                  </span>
                </span>
                <p className="tnum mt-2 text-[22px] font-light leading-none" style={{ color: cor }}>
                  {valor}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted/60">{detalhe}</p>
              </Linha>
            </li>
          ))}
        </ul>
      )}
    </PainelCard>
  );
}
