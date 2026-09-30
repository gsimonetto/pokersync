// Detecção automática de rebuy/re-entry a partir das mãos do torneio.
// O hand history não tem uma linha "fez rebuy" confiável, mas o efeito
// aparece nas mãos: o herói perde TODAS as fichas numa mão e mesmo assim
// volta a aparecer sentado numa mão seguinte do MESMO torneio. Cada vez
// que isso acontece conta 1 rebuy.
//
// Só usa campos que já ficam salvos em hand_reviews.parsed_data (assentos,
// ações por rua, quem recebeu o pote), então dá pra recalcular torneios
// antigos sem reprocessar o texto da mão.

export interface MaoParaRebuy {
  heroName?: string | null;
  handId?: string | null;
  date?: string | null;
  seats?: { playerName: string; startingChips: number }[] | null;
  streets?: { name: string; actions?: { player: string; action: string; amount?: number; raiseTo?: number; postType?: string }[] }[] | null;
  winnings?: { player: string; amount: number }[] | null;
  winner?: string | null;
}

// Fichas que o herói colocou na mesa na mão inteira (blinds, antes,
// apostas), já descontando aposta devolvida por não ter sido paga.
function fichasColocadas(mao: MaoParaRebuy, heroi: string): number {
  let total = 0;
  for (const rua of mao.streets ?? []) {
    let naRua = 0;
    for (const a of rua.actions ?? []) {
      if (a.player !== heroi) continue;
      const valor = Number(a.amount) || 0;
      if (a.action === "uncalled_return") {
        total -= valor;
        continue;
      }
      if (a.action === "posts") {
        total += valor;
        if (a.postType !== "ante") naRua += valor;
        continue;
      }
      if (a.action === "raises" && a.raiseTo != null) {
        const incremento = Math.max(0, a.raiseTo - naRua);
        total += incremento;
        naRua = a.raiseTo;
        continue;
      }
      if (a.action === "calls" || a.action === "bets" || a.action === "raises" || a.action === "allin") {
        total += valor;
        naRua += valor;
      }
    }
  }
  return total;
}

/** true quando o herói terminou a mão sem nenhuma ficha. */
export function heroiQuebrou(mao: MaoParaRebuy): boolean {
  const heroi = mao.heroName;
  if (!heroi) return false;
  const assento = (mao.seats ?? []).find((s) => s.playerName === heroi);
  if (!assento || !(assento.startingChips > 0)) return false;

  const ganhou = Array.isArray(mao.winnings)
    ? mao.winnings.some((w) => w.player === heroi && w.amount > 0)
    : mao.winner === heroi;
  if (ganhou) return false;

  return fichasColocadas(mao, heroi) >= assento.startingChips - 0.001;
}

function heroiSentado(mao: MaoParaRebuy): boolean {
  return !!mao.heroName && (mao.seats ?? []).some((s) => s.playerName === mao.heroName);
}

// Número da mão cresce com o tempo em todas as salas suportadas; quando
// falta, cai na data da mão.
function compararOrdem(a: MaoParaRebuy, b: MaoParaRebuy): number {
  const na = a.handId && /^\d+$/.test(a.handId) ? a.handId : null;
  const nb = b.handId && /^\d+$/.test(b.handId) ? b.handId : null;
  if (na && nb) return na.length !== nb.length ? na.length - nb.length : na < nb ? -1 : na > nb ? 1 : 0;
  return (a.date ?? "").localeCompare(b.date ?? "");
}

/** Quantos rebuys o herói fez no torneio, dadas as mãos dele (qualquer ordem). */
export function contarRebuys(maos: MaoParaRebuy[]): number {
  const ordenadas = maos.filter(heroiSentado).sort(compararOrdem);
  let rebuys = 0;
  for (let i = 0; i < ordenadas.length - 1; i++) {
    if (heroiQuebrou(ordenadas[i])) rebuys++;
  }
  return rebuys;
}
