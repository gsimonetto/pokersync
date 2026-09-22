"use client";

import { Activity, BookOpen, Flame, Percent, Target, Trophy } from "lucide-react";
import { MAX_LEVEL, xpForNextLevel, type Progress } from "@/lib/services/xp-service";
import type { PlayerPerformance } from "@/lib/services/performance-service";
import { CardHint, Linha, PainelCard, TileIcone } from "./painel-card";
import { usePainelDados } from "./painel-dados";
import { num, pct } from "./formato";

type Indicador = {
  rotulo: string;
  valor: string;
  detalhe: string;
  icone: typeof Flame;
  cor: string;
  /** Barrinha opcional (0-100), hoje só pro progresso de nível. */
  progresso?: number;
};

// Números que o app JÁ calcula, reunidos num mosaico. Vêm da view
// player_performance (a mesma do módulo Performance) e do user_progress
// (Hub de Evolução) -- nada é recalculado aqui.
function montar(perf: PlayerPerformance | null, progresso: Progress | null): Indicador[] {
  const lista: Indicador[] = [];

  if (perf?.score_geral != null) {
    lista.push({
      rotulo: "Score geral",
      valor: num(perf.score_geral),
      detalhe: "de 100",
      icone: Activity,
      cor: "#22D3EE",
    });
  }
  if (perf?.roi_pct != null) {
    lista.push({
      // "total" no rótulo: é o ROI de todo o histórico. Sem isso ele
      // parecia do mesmo período dos "30 dias" mostrados no cabeçalho.
      rotulo: "ROI total",
      valor: pct(perf.roi_pct, { sinal: true }),
      detalhe: `${num(perf.num_sessoes ?? 0)} sessões`,
      icone: Percent,
      cor: perf.roi_pct >= 0 ? "#22c55e" : "#e0555a",
    });
  }
  if (progresso) {
    // Progresso até o próximo nível, com a MESMA conta do Hub de Evolução
    // (xp_current / xpForNextLevel). Antes só aparecia o XP total, que
    // não diz quanto falta pra subir.
    const noMaximo = progresso.level >= MAX_LEVEL;
    const necessario = noMaximo ? 0 : xpForNextLevel(progresso.level);
    lista.push({
      rotulo: "Nível",
      valor: num(progresso.level),
      detalhe: noMaximo ? "nível máximo" : `${num(progresso.xp_current)}/${num(necessario)} XP`,
      icone: Trophy,
      cor: "#d4af37",
      progresso: noMaximo ? 100 : Math.min(100, (progresso.xp_current / Math.max(1, necessario)) * 100),
    });
    lista.push({
      rotulo: "Sequência",
      valor: num(progresso.streak_days),
      detalhe: `melhor: ${num(progresso.streak_best)} dias`,
      icone: Flame,
      cor: "#F59E0B",
    });
  }
  if (perf?.taxa_acerto_treino_pct != null) {
    lista.push({
      rotulo: "Acerto no treino",
      valor: pct(perf.taxa_acerto_treino_pct, { casas: 0 }),
      // Antes: "0 drills hoje" ao lado de um acerto de TODO o histórico --
      // dois períodos no mesmo quadro. Os drills de hoje já aparecem em
      // "Sua semana", no card de metas.
      detalhe: `em ${num(perf.num_drills ?? 0)} drills`,
      icone: Target,
      cor: "#2FB89A",
    });
  }
  if (perf?.maos_revisadas != null) {
    lista.push({
      rotulo: "Mãos revisadas",
      valor: num(perf.maos_revisadas),
      detalhe: "no total",
      icone: BookOpen,
      cor: "#A855F7",
    });
  }

  return lista;
}

export function IndicatorsCard({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const { carregando, performance, progresso } = usePainelDados();
  const itens = montar(performance, progresso);

  return (
    <PainelCard title="Seus indicadores" icon={<Activity size={15} />} style={style} className={className}>
      {carregando ? (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="painel-esqueleto h-[92px] rounded-2xl" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <CardHint>Os indicadores aparecem assim que você registrar sessões, drills ou mãos.</CardHint>
      ) : (
        // Três colunas no computador: o card fica baixo quando a tela
        // inteira tem que caber sem rolagem, e 3x2 cabe onde 2x3 não
        // cabia. No celular continua 2 colunas, que é o confortável.
        <ul className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {itens.map(({ rotulo, valor, detalhe, icone: Icone, cor, progresso: barra }) => (
            <li key={rotulo}>
              <Linha className="h-full !p-2.5">
                <span className="flex items-center gap-2">
                  <TileIcone cor={cor}>
                    <Icone size={14} />
                  </TileIcone>
                  <span className="min-w-0 text-[11px] font-semibold uppercase leading-tight tracking-[0.05em] text-muted/80">
                    {rotulo}
                  </span>
                </span>
                <p className="tnum mt-2 text-[22px] font-light leading-none" style={{ color: cor }}>
                  {valor}
                </p>
                {barra != null && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full" style={{ width: `${barra}%`, background: cor }} />
                  </div>
                )}
                <p className="tnum mt-1 text-[11px] leading-tight text-muted/80">{detalhe}</p>
              </Linha>
            </li>
          ))}
        </ul>
      )}
    </PainelCard>
  );
}
