"use client";

import { Activity, BookOpen, Flame, Percent, Target, Trophy } from "lucide-react";
import { MAX_LEVEL, xpForNextLevel, type Progress } from "@/lib/services/xp-service";
import type { PlayerPerformance } from "@/lib/services/performance-service";
import { motion } from "framer-motion";
import { BarraProgresso, CardHint, EASE, Linha, Numero, PainelCard } from "./painel-card";
import { PentagonoScore } from "./pentagono-score";
import { InfoHover, type Explicacao } from "./info-hover";
import { usePainelDados } from "./painel-dados";
import { num, pct } from "./formato";

type Indicador = {
  rotulo: string;
  /** Texto final do valor (sem animação). */
  valor: string;
  /** Número por trás do texto + como formatá-lo -- é o que conta de 0
   *  até o valor na entrada. */
  alvo: number;
  formatar: (n: number) => string;
  /** Unidade mostrada menor e apagada ao lado do número ("%"). */
  sufixo?: string;
  /** Cor do NÚMERO só quando ela significa algo (ROI positivo/negativo);
   *  sem isso o número fica branco e a cor do indicador vai só no ícone. */
  corValor?: string;
  detalhe: string;
  icone: typeof Flame;
  cor: string;
  /** Barrinha opcional (0-100), hoje só pro progresso de nível. */
  progresso?: number;
  /** O que é e de onde vem -- aparece ao passar o mouse. */
  explicacao: Explicacao;
};

// Números que o app JÁ calcula, reunidos num mosaico. Vêm da view
// player_performance (a mesma do módulo Performance) e do user_progress
// (Hub de Evolução) -- nada é recalculado aqui.
function montar(perf: PlayerPerformance | null, progresso: Progress | null): Indicador[] {
  const lista: Indicador[] = [];

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
      explicacao: {
        titulo: "Nível",
        oQueE: "Seu nível de jogador no PokerSync. Sobe conforme você acumula XP; a barra mostra quanto falta pro próximo.",
        origem: "Hub de Evolução",
        comoCalcula: "Treinos, revisões de mão e as outras atividades do app rendem XP.",
      },
    });
    lista.push({
      rotulo: "Sequência",
      valor: num(progresso.streak_days),
      alvo: progresso.streak_days,
      formatar: num,
      detalhe: `melhor: ${num(progresso.streak_best)} dias`,
      icone: Flame,
      cor: "#F59E0B",
      explicacao: {
        titulo: "Sequência",
        oQueE: "Quantos dias seguidos você teve atividade no app. Um dia sem nada zera a contagem.",
        origem: "Hub de Evolução",
        comoCalcula: "Conta os dias com pelo menos um ganho de XP. Também vale 20% do Score (Disciplina).",
      },
    });
  }
  if (perf?.taxa_acerto_treino_pct != null) {
    lista.push({
      rotulo: "Acerto GTO",
      valor: pct(perf.taxa_acerto_treino_pct, { casas: 0 }),
      alvo: perf.taxa_acerto_treino_pct,
      formatar: (n) => semPct(pct(n, { casas: 0 })),
      sufixo: "%",
      // Antes: "0 drills hoje" ao lado de um acerto de TODO o histórico --
      // dois períodos no mesmo quadro. Os drills de hoje já aparecem em
      // "Sua semana", no card de metas.
      detalhe: `em ${num(perf.num_drills ?? 0)} drills`,
      icone: Target,
      cor: "#2FB89A",
      explicacao: {
        titulo: "Acerto no treino",
        oQueE: "Em quantas decisões dos drills você escolheu a jogada certa (GTO), somando todo o seu histórico.",
        origem: "Modo Treino",
        comoCalcula: "Decisões certas ÷ decisões respondidas. Também vale 20% do Score (Conhecimento).",
      },
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
      explicacao: {
        titulo: "Mãos revisadas",
        oQueE: "Quantas mãos você já analisou no Revisor, desde o começo.",
        origem: "Revisor de Mãos",
        comoCalcula: "Soma de todo o histórico. Marcar acerto/erro nas revisões alimenta a Técnica do Score (25%).",
      },
    });
  }

  return lista;
}

const semPct = (txt: string) => txt.replace(/%$/, "");

// Tamanho do número conforme o comprimento (sem a unidade): o quadro tem
// largura fixa (2 por linha, ao lado do pentágono) e um valor longo
// passaria por cima do quadro vizinho. Número curto fica grande. Em
// janela baixa tudo desce um degrau, pro card caber sem barra.
// No computador os 4 indicadores viram linhas compactas (card da mesma
// largura dos outros, pedido explícito), então o número cai pra um
// tamanho só; no celular continuam quadros 2x2 com o número grande.
function tamanhoValor(numero: string): string {
  const n = numero.length;
  const xl = "xl:text-[20px] xl:[@media(max-height:819px)]:text-[17px]";
  if (n <= 3) return `text-[32px] ${xl}`;
  if (n <= 5) return `text-[28px] ${xl}`;
  if (n <= 7) return `text-[23px] ${xl}`;
  return `text-[19px] ${xl}`;
}

const COMPONENTES_SCORE: { chave: keyof PlayerPerformance; rotulo: string }[] = [
  { chave: "score_tecnica", rotulo: "Técnica (25%)" },
  { chave: "score_conhecimento", rotulo: "Conhecimento (20%)" },
  { chave: "score_disciplina", rotulo: "Disciplina (20%)" },
  { chave: "score_performance", rotulo: "Performance (20%)" },
  { chave: "score_consistencia", rotulo: "Consistência (15%)" },
];

export function explicacaoScore(perf: PlayerPerformance | null): Explicacao {
  return {
    titulo: "Score geral",
    oQueE: "Nota de 0 a 100 que resume sua evolução como jogador. Abaixo de 40 pede atenção; de 70 pra cima está bom.",
    itens: COMPONENTES_SCORE.map(({ chave, rotulo }) => {
      const v = perf?.[chave];
      return { rotulo, valor: typeof v === "number" ? num(v) : "—" };
    }),
    origem: "Performance · Score de Evolução",
    comoCalcula: "Média ponderada desses 5 pedaços, calculados a partir dos seus dados. Pedaço sem dado entra como 50 (neutro).",
  };
}

const EXPLICACAO_ROI: Explicacao = {
  titulo: "ROI total",
  oQueE: "Quanto voltou de lucro pra cada real investido em buy-ins, somando todas as suas sessões.",
  origem: "Gestão de Banca",
  comoCalcula: "Lucro total ÷ total investido (buy-ins e reentradas). Também vale 20% do Score (Performance).",
};

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

  const score = performance?.score_geral ?? null;
  const roi = performance?.roi_pct ?? null;
  const casasRoi = roi != null && Math.abs(roi) >= 100 ? 0 : 1;

  return (
    <PainelCard title="Seus indicadores" icon={<Activity size={15} />} style={style} className={className} ordem={ordem}>
      {carregando ? (
        <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="painel-esqueleto min-h-[180px] rounded-2xl" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="painel-esqueleto h-[88px] rounded-2xl" />
            ))}
          </div>
        </div>
      ) : score == null && itens.length === 0 ? (
        <CardHint>Os indicadores aparecem assim que você registrar sessões, drills ou mãos.</CardHint>
      ) : (
        // Pentágono do Score à esquerda (o número que resume tudo ganha o
        // maior peso visual) e os outros indicadores 2x2 à direita. No
        // celular, um embaixo do outro.
        <div className="grid h-full min-h-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <motion.div
            className="flex min-h-0 flex-col gap-2"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
          >
            {/* Pentágono dos 5 pilares do Score: mostra POR QUE o número é
                esse e aponta o pilar mais fraco com o atalho pro módulo. */}
            <Linha className="flex min-h-0 w-full flex-1 !p-2.5">
              <PentagonoScore perf={performance} explicacao={explicacaoScore(performance)} />
            </Linha>
            {/* Em janela baixa a faixa do ROI sai pra o pentágono ter
                altura legível; o ROI segue na Gestão de Banca e dentro da
                explicação do Score (pilar Performance). */}
            {roi != null && (
              <InfoHover explicacao={EXPLICACAO_ROI} className="xl:[@media(max-height:819px)]:hidden">
                <Linha className="flex items-center justify-between gap-2 !px-3 !py-2">
                  <span className="flex items-center gap-1.5 text-[12px] text-muted/80">
                    <Percent size={13} aria-hidden style={{ color: roi >= 0 ? "#22c55e" : "#e0555a" }} />
                    ROI total
                  </span>
                  <span
                    className="tnum truncate text-[15px] font-semibold tracking-[-0.02em]"
                    style={{ color: roi > 0 ? "#22c55e" : roi < 0 ? "#e0555a" : "#ffffff" }}
                  >
                    <Numero valor={roi} formatar={(n) => pct(n, { sinal: true, casas: casasRoi })} />
                  </span>
                </Linha>
              </InfoHover>
            )}
          </motion.div>

          <ul className="grid auto-rows-fr grid-cols-2 gap-2 xl:grid-cols-1">
            {itens.map(({ rotulo, alvo, formatar, sufixo, corValor, detalhe, icone: Icone, cor, progresso: barra, explicacao }, i) => (
              <motion.li
                key={rotulo}
                className="min-w-0"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.35 + i * 0.06 }}
              >
                {/* Passar o mouse (ou focar pelo teclado) mostra o que é o
                    número e de que módulo ele vem. */}
                <InfoHover explicacao={explicacao} className="h-full">
                  <Linha className="flex h-full min-w-0 flex-col !p-3 xl:flex-row xl:items-center xl:gap-2 xl:!px-2.5 xl:!py-1.5">
                    <span className="flex items-start justify-between gap-2 xl:min-w-0 xl:flex-1 xl:flex-row-reverse xl:items-center xl:justify-end">
                      <span className="min-w-0 text-[12px] leading-tight text-muted/80 xl:truncate xl:text-[11.5px]">{rotulo}</span>
                      <Icone size={15} className="shrink-0" style={{ color: cor }} aria-hidden />
                    </span>
                    {/* Número marcante: centralizado no quadro, em negrito
                        (Space Grotesk, a fonte do produto) e na cor do
                        indicador -- a mesma do ícone, pra o quadro ter uma
                        identidade só. A unidade vem menor e apagada, pra o
                        olho pegar primeiro o valor. */}
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center pt-1.5 text-center xl:flex-none xl:items-end xl:pt-0 xl:text-right">
                      <p
                        className={`tnum flex max-w-full items-baseline justify-center truncate font-bold leading-none tracking-[-0.02em] ${tamanhoValor(formatar(alvo))}`}
                        style={{ color: corValor ?? cor }}
                      >
                        <Numero valor={alvo} formatar={formatar} />
                        {sufixo && <span className="ml-0.5 text-[0.55em] font-semibold tracking-normal text-muted/70">{sufixo}</span>}
                      </p>
                      {barra != null && <BarraProgresso className="mt-2 h-1 w-full max-w-[120px] xl:hidden" pct={barra} cor={cor} atraso={0.5} />}
                      <p className="tnum mt-1.5 max-w-full truncate text-[11px] leading-tight text-muted/70 xl:mt-0.5 xl:text-[10px] xl:[@media(max-height:819px)]:hidden">{detalhe}</p>
                    </div>
                  </Linha>
                </InfoHover>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </PainelCard>
  );
}
