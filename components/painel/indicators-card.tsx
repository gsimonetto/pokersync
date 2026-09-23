"use client";

import { Activity, BookOpen, Flame, Percent, Target, Trophy } from "lucide-react";
import { MAX_LEVEL, xpForNextLevel, type Progress } from "@/lib/services/xp-service";
import type { PlayerPerformance } from "@/lib/services/performance-service";
import { motion } from "framer-motion";
import { BarraProgresso, CardHint, EASE, Linha, Numero, PainelCard } from "./painel-card";
import { usePainelDados } from "./painel-dados";
import { num, pct } from "./formato";

type Indicador = {
  rotulo: string;
  /** Texto final (define o tamanho da fonte e vai no title). */
  valor: string;
  /** Número por trás do texto + como formatá-lo -- é o que conta de 0
   *  até o valor na entrada. */
  alvo: number;
  formatar: (n: number) => string;
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
      alvo: perf.score_geral,
      formatar: num,
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
      valor: pct(perf.roi_pct, { sinal: true, casas: Math.abs(perf.roi_pct) >= 100 ? 0 : 1 }),
      alvo: perf.roi_pct,
      formatar: (n) => pct(n, { sinal: true, casas: Math.abs(perf.roi_pct!) >= 100 ? 0 : 1 }),
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
      alvo: progresso.level,
      formatar: num,
      detalhe: noMaximo ? "nível máximo" : `${num(progresso.xp_current)}/${num(necessario)} XP`,
      icone: Trophy,
      cor: "#d4af37",
      progresso: noMaximo ? 100 : Math.min(100, (progresso.xp_current / Math.max(1, necessario)) * 100),
    });
    lista.push({
      rotulo: "Sequência",
      valor: num(progresso.streak_days),
      alvo: progresso.streak_days,
      formatar: num,
      detalhe: `melhor: ${num(progresso.streak_best)} dias`,
      icone: Flame,
      cor: "#F59E0B",
    });
  }
  if (perf?.taxa_acerto_treino_pct != null) {
    lista.push({
      rotulo: "Acerto no treino",
      valor: pct(perf.taxa_acerto_treino_pct, { casas: 0 }),
      alvo: perf.taxa_acerto_treino_pct,
      formatar: (n) => pct(n, { casas: 0 }),
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
      alvo: perf.maos_revisadas,
      formatar: num,
      detalhe: "no total",
      icone: BookOpen,
      cor: "#A855F7",
    });
  }

  return lista;
}

// Tamanho do número conforme o comprimento: o quadro tem largura fixa (3
// por linha no computador) e um valor longo, como "+14.900%", passava
// por cima do quadro vizinho. Número curto continua grande.
function tamanhoValor(valor: string): string {
  if (valor.length > 8) return "text-[16px]";
  if (valor.length > 6) return "text-[19px]";
  return "text-[22px]";
}

export function IndicatorsCard({
  style,
  className,
  ordem,
}: {
  style?: React.CSSProperties;
  className?: string;
  ordem?: number;
}) {
  const { carregando, performance, progresso } = usePainelDados();
  const itens = montar(performance, progresso);

  return (
    <PainelCard title="Seus indicadores" icon={<Activity size={15} />} style={style} className={className} ordem={ordem}>
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
          {itens.map(({ rotulo, valor, alvo, formatar, detalhe, icone: Icone, cor, progresso: barra }, i) => (
            <motion.li
              key={rotulo}
              className="min-w-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.3 + i * 0.05 }}
            >
              {/* Quadro de número no padrão de painel: rótulo em cima à
                  esquerda, ícone solto à direita e o valor grande embaixo.
                  Antes o ícone ficava num quadradinho ao lado do rótulo em
                  CAIXA ALTA -- no quadro estreito o rótulo quebrava em
                  duas linhas e empurrava o número pra fora. */}
              <Linha className="flex h-full min-w-0 flex-col !p-3 xl:[@media(max-height:819px)]:!p-2">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-[12px] leading-tight text-muted/80">{rotulo}</span>
                  <Icone size={15} className="shrink-0" style={{ color: cor }} aria-hidden />
                </span>
                <p
                  className={`tnum mt-2.5 truncate font-light leading-none xl:[@media(max-height:819px)]:mt-1.5 ${tamanhoValor(valor)}`}
                  style={{ color: cor }}
                  title={valor}
                >
                  <Numero valor={alvo} formatar={formatar} />
                </p>
                {barra != null && <BarraProgresso className="mt-1.5 h-1" pct={barra} cor={cor} atraso={0.5} />}
                <p className="tnum mt-1.5 truncate text-[11px] leading-tight text-muted/70">{detalhe}</p>
              </Linha>
            </motion.li>
          ))}
        </ul>
      )}
    </PainelCard>
  );
}
