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
}
