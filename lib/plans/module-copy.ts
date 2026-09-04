import type { ModuleKey } from "./plans-data";

// Texto de venda de cada modulo bloqueado -- usado na modal que abre
// quando o jogador clica num item travado do menu (components/app-shell.tsx)
// e na pagina /planos. `benefits` e' a lista COMPLETA do que o modulo
// realmente tem (ver POKERSYNC.md, secao 6, pra descricao real de cada
// modulo) -- pedido explicito: nada de bloco de "diferencial" separado,
// so' os checks, direto.
export interface ModuleCopy {
  title: string;
  blurb: string;
  benefits: string[];
}

export const MODULE_COPY: Record<ModuleKey, ModuleCopy> = {
  drill: {
    title: "Modo Treino",
    blurb: "Treine spots de ranges e frequências GTO fora da mesa, no seu ritmo.",
    benefits: [
      "Drills de RFI/Jam por posição, stack e situação",
      "Motor GTO próprio (CFR + ICM), sem depender de solver externo",
      "Sugestão automática de treino a partir dos leaks do Revisor",
      "Sugestão baseada na performance da Banca (ex: leak de stack curto)",
      "Drill com suas próprias ranges, criadas no Construtor",
      "XP, combo de acertos e missões a cada drill",
    ],
  },
  bankroll: {
    title: "Gestor de Banca",
    blurb: "Controle de risco, fluxo de caixa e evolução da sua banca num só lugar.",
    benefits: [
      "Registro de sessão com fechamento (humor, tilt, diário)",
      "Metas de volume e de estudo",
      "Dashboard de evolução com heatmap de volume",
      "Fluxo de caixa: depósitos, saques e caixinha",
      "R$/hora e bb/hora com intervalo de confiança",
      "Histórico com filtros por formato e período",
      "Rake, rakeback e suporte a múltiplas moedas",
      "Staking e backing com markup",
      "BRM com limites de risco por formato",
      "Alertas de banca e anotações no gráfico",
    ],
  },
  revisor: {
    title: "Revisor de Mãos",
    blurb: "Revise as mãos que te incomodaram e entenda o porquê, sem depender de solver externo.",
    benefits: [
      "Captura rápida (menos de 30s) por hand history ou print",
      "Etiquetas por situação (3-bet, ICM, PKO, hero call...)",
      "Fila de revisão e histórico completo",
      "Perguntas guiadas antes do veredito",
      "Veredito baseado na aderência às suas próprias ranges",
      "Registro de aprendizado por mão",
      "Sugestão automática de drill a partir do leak identificado",
      "Replay de mão com atalhos de teclado",
      "Avaliação detalhada por rua (flop, turn, river)",
      "Compartilhar mão com o time e thread de coach",
    ],
  },
  hub: {
    title: "Hub de Evolução",
    blurb: "XP, missões diárias, ranking e temporadas com prêmio — seu progresso, visível.",
    benefits: [
      "XP de tudo que você faz: treino, banca e revisão",
      "Missões diárias e combo de acertos",
      "Níveis e ranking com pódio",
      "Temporadas com prêmio",
      "Participação nos eventos do Hub",
      "Notificações de progresso",
    ],
  },
  time: {
    title: "Meu Time",
    blurb: "Gerencie um grupo de jogadores: metas, alertas e evolução consolidada em um painel de coach.",
    benefits: [
      "Cadastro de time e convite de jogadores",
      "Papéis e permissões (admin, coach, jogador)",
      "Dashboard do coach com funil de metas e calendário",
      "Metas por jogador com acompanhamento",
      "Métricas consolidadas: financeiro, atividade e leaks",
      "Alertas automáticos de leak por jogador",
      "Chat integrado com o time",
    ],
  },
  performance: {
    title: "Player Evolution",
    blurb: "Raio-x da sua evolução: ROI, volume, tendências e leaks que viram ação.",
    benefits: [
      "ROI, ABI, volume e lucro",
      "Evolução temporal e comparação de períodos",
      "Insights acionáveis, não só números soltos",
      "Matriz 13×13 de preflop com heatmap",
      "Análise pós-flop por rua (c-bet, fold-to-cbet, check-raise)",
      "Estatísticas por posição e por torneio",
      "Leak Finder que leva direto pro replay da mão",
      "Importação manual ou automática (via Radar)",
    ],
  },
  ranges: {
    title: "Construtor de Ranges",
    blurb: "Monte suas próprias ranges e árvores de decisão como material de estudo.",
    benefits: [
      "Editor de ranges e árvores de decisão com versionamento",
      "Importar mão do Revisor e checar aderência de range",
      "Range vira drill automaticamente no Treino",
      "Comparador de ranges",
      "Calculadora de equity",
      "Analisador de board (textura single e multiway)",
      "Biblioteca de time e journal de decisões",
    ],
  },
};

// Radar PokerSync = o agente desktop (repo proprio gsimonetto/pokersync-agent,
// Tauri + Rust). Varre o computador do jogador atras de hand history
// (PokerStars, GGPoker, PartyPoker, 888poker, ACR) e sincroniza sozinho com
// o Revisor/Player Evolution -- sem precisar colar mao por mao na mao.
export const RADAR_COPY: ModuleCopy = {
  title: "Radar PokerSync",
  blurb: "O agente desktop que varre suas hand histories sozinho e sincroniza com o PokerSync em segundo plano.",
  benefits: [
    "Detecta PokerStars, GGPoker, PartyPoker, 888poker e ACR automaticamente",
    "Só reenvia o que mudou desde a última varredura",
    "Sincroniza direto com Revisor e Player Evolution",
    "Roda em segundo plano, sem precisar abrir o app",
  ],
};
