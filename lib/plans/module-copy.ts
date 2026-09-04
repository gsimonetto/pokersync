import type { ModuleKey } from "./plans-data";

// Texto de venda de cada modulo bloqueado -- usado na modal que abre
// quando o jogador clica num item travado do menu (components/app-shell.tsx)
// e na pagina /planos. Foco no que ajuda o jogador (nao em feature tecnica
// solta) e no que diferencia do resto do mercado, seguindo o mesmo tom do
// resto do produto (ver POKERSYNC.md, secao 6, pra descricao real de cada
// modulo).
export interface ModuleCopy {
  title: string;
  blurb: string;
  benefits: string[];
  differential: string;
}

export const MODULE_COPY: Record<ModuleKey, ModuleCopy> = {
  drill: {
    title: "Modo Treino",
    blurb: "Treine spots de ranges e frequências GTO fora da mesa, no seu ritmo.",
    benefits: [
      "Filtros por posição, stack e tipo de spot",
      "XP e combo de acertos a cada drill",
      "Sugestão automática de treino a partir dos seus próprios leaks",
    ],
    differential: "O motor GTO é próprio do PokerSync — os spots vêm do mesmo lugar que valida sua evolução.",
  },
  bankroll: {
    title: "Gestor de Banca",
    blurb: "Controle de risco, fluxo de caixa e evolução da sua banca num só lugar.",
    benefits: [
      "Fechamento de sessão com humor, tilt e diário",
      "Metas de volume e de estudo",
      "R$/hora e bb/hora com intervalo de confiança",
    ],
    differential: "Vai além de saldo: rake/rakeback, staking, multi-moeda e alertas de banca, tudo integrado.",
  },
  revisor: {
    title: "Revisor de Mãos",
    blurb: "Revise as mãos que te incomodaram e entenda o porquê, sem depender de solver externo.",
    benefits: [
      "Captura rápida (menos de 30s) por hand history ou print",
      "Perguntas guiadas que te fazem pensar antes da resposta",
      "Veredito baseado na aderência às suas próprias ranges",
    ],
    differential: "Não é um repositório de mãos: cada revisão vira aprendizado registrado e alimenta sugestões de treino.",
  },
  hub: {
    title: "Hub de Evolução",
    blurb: "XP, missões diárias, ranking e temporadas com prêmio — seu progresso, visível.",
    benefits: [
      "XP toda vez que você treina, revisa ou joga",
      "Missões diárias e combo de acertos",
      "Ranking com pódio e eventos por temporada",
    ],
    differential: "O XP nasce do que você realmente faz nos outros módulos — não é um contador solto.",
  },
  time: {
    title: "Meu Time",
    blurb: "Gerencie um grupo de jogadores: metas, alertas e evolução consolidada em um painel de coach.",
    benefits: [
      "Dashboard do coach com funil de metas e calendário",
      "Alertas automáticos de leak por jogador",
      "Papéis e permissões (admin, coach, jogador) com chat integrado",
    ],
    differential: "Pensado pra quem acompanha mais de um jogador — a mesma base de dados do individual, agora em escala.",
  },
  performance: {
    title: "Player Evolution",
    blurb: "Raio-x da sua evolução: ROI, volume, tendências e leaks que viram ação.",
    benefits: [
      "Matriz 13×13 de preflop com heatmap",
      "Análise pós-flop por rua (c-bet, fold-to-cbet, check-raise)",
      "Leak Finder que te leva direto pro replay da mão",
    ],
    differential: "Um leak identificado aqui vira sugestão de treino automaticamente — não fica só no relatório.",
  },
  ranges: {
    title: "Construtor de Ranges",
    blurb: "Monte suas próprias ranges e árvores de decisão como material de estudo.",
    benefits: [
      "Editor de ranges e árvores com versionamento",
      "Comparador de ranges e calculadora de equity",
      "Analisador de board (textura single e multiway)",
    ],
    differential: "Integra com o Revisor (aderência à sua range real) e o Treino (a range vira drill sozinha).",
  },
};

export const RADAR_COPY: ModuleCopy = {
  title: "Radar PokerSync",
  blurb: "Inteligência de mesas e oponentes pra você escolher onde sentar.",
  benefits: ["Scouting de mesas e adversários", "Alertas de oportunidade em tempo real"],
  differential: "Complemento vendido à parte — disponível a partir do Individual Pro.",
};
