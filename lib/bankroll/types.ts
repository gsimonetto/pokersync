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
