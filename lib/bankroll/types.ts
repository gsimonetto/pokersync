export interface Session {
  id: string;
  date: string;
  time?: string;
  format: string;
  buyIn: number;
  reentries: number;
  cashout: number;
  stake?: string;
  hours?: number;
  venue?: string;
  notes?: string;
  // Diario pos-sessao / fechamento de sessao (2026-08): opcionais, nao
  // bloqueiam o registro rapido de sessao — preenchidos so quem quiser
  // fechar a sessao com reflexao.
  mood?: string;
  tilt?: number;
  diaryNote?: string;
  // Rake/rakeback (2026-08): opcionais, so' faz sentido em cash/formatos
  // com rake explicito. Sem eles, resultado (cashout-buyin) ja' inclui o
  // rake implicitamente — aqui e' so' pra separar visualmente o quanto foi
  // pago de rake vs devolvido de rakeback.
  rake?: number;
  rakeback?: number;
  // Big blind da sessao (2026-08): so' aplicavel a Cash — alimenta bb/hora,
  // a metrica que grinder de cash realmente usa pra comparar stakes
  // diferentes (R$/hora nao normaliza, bb/hora sim).
  bigBlind?: number;
  // Moeda da sessao (2026-08): default BRL, so' aparece na UI quando o
  // jogador de fato usa mais de uma moeda — nao mistura na soma.
  currency?: string;
  // Staking/backing (2026-08): ownPct = % da acao que o proprio jogador
  // ficou (100 = sem staking, banca 100% propria). O resto foi vendido a
  // um backer com o markup informado. net() ja' calcula o resultado
  // liquido do jogador considerando isso — o resto do app nao precisa
  // saber que staking existe.
  ownPct?: number;
  markup?: number;
  backerName?: string;
  // Preenchido quando a sessão veio de um torneio que o agente desktop já
  // tinha capturado (id do hand_sessions de origem) -- alimenta a tag
  // "Importada" e o filtro de importadas na Gestão de Banca. null/undefined
  // = lançada à mão pelo jogador.
  importedHandSessionId?: string | null;
}

export type TransactionType = "deposito" | "saque" | "caixinha";

// Movimentacao de capital — separada do resultado de jogo (Session).
// Depositos somam a banca de jogo; saques e caixinha tiram da banca de
// jogo mas continuam contando no patrimonio total (nao sao "perda").
export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  note?: string;
  venue?: string;
  currency?: string;
}

export type GoalType = "volume" | "estudo";
export type GoalPeriod = "semanal" | "mensal";

export interface Goal {
  id: string;
  type: GoalType;
  period: GoalPeriod;
  target: number;
  unit: string;
  active: boolean;
}

export interface StudyLog {
  id: string;
  date: string;
  minutes: number;
  note?: string;
}

// Anotacao no grafico de evolucao ("subi pra NL100 aqui") — marcador
// clicavel na timeline, so data + nota curta.
export interface Annotation {
  id: string;
  date: string;
  note: string;
}

// BRM: threshold de moveup/movedown em buy-ins, por formato. Alimenta o
// Coach (saude de banca deixa de ser um numero fixo unico pra todos os
// formatos) e fica visivel/editavel pro jogador.
export type BrmFormat = "Cash" | "MTT" | "SNG" | "Spin";

export interface BrmThreshold {
  format: BrmFormat;
  moveupBuyins: number;
  movedownBuyins: number;
}
