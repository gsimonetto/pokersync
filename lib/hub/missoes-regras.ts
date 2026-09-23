// Regras de período das missões do Hub. O banco renova as missões pelo
// relógio dele (UTC): diárias à meia-noite UTC, semanais na segunda e
// mensais no dia 1 (ver assign_missions_for_all + cron das 00:05 UTC).
// A tela usa as mesmas datas pra dizer "renova em 5h" sem prometer
// um horário que o banco não cumpre.

export type TipoMissao = "daily" | "weekly" | "monthly" | "challenge";

function diaUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Primeiro dia (UTC, AAAA-MM-DD) do período atual de cada tipo. */
export function inicioDoPeriodo(tipo: TipoMissao, agora = new Date()): string {
  const hoje = diaUTC(agora);
  if (tipo === "weekly") {
    const dow = (hoje.getUTCDay() + 6) % 7; // segunda = 0
    hoje.setUTCDate(hoje.getUTCDate() - dow);
  } else if (tipo === "monthly" || tipo === "challenge") {
    hoje.setUTCDate(1);
  }
  return hoje.toISOString().slice(0, 10);
}

/** Quando o período atual acaba (= próxima renovação). */
export function proximaRenovacao(tipo: TipoMissao, agora = new Date()): Date | null {
  if (tipo === "challenge") return null;
  const d = new Date(inicioDoPeriodo(tipo, agora) + "T00:00:00Z");
  if (tipo === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (tipo === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** "5h 12min", "3 dias", "40min". */
export function tempoAte(alvo: Date, agora = new Date()): string {
  const min = Math.max(0, Math.round((alvo.getTime() - agora.getTime()) / 60_000));
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ${String(min % 60).padStart(2, "0")}min`;
  return `${Math.floor(h / 24)} dias`;
}
