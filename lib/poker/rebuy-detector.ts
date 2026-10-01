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
  streets?: { name: string; actions?: { player: string; action: string; amount?: number; raiseTo?: number; postType?: string; isAllIn?: boolean }[] }[] | null;
  winnings?: { player: string; amount: number }[] | null;
  winner?: string | null;
}

// Valor do ante quando os "posts" vieram sem tipo -- mãos do PokerStars
// salvas antes da correção do parser (os posts de lá ficam antes de
// "*** HOLE CARDS ***" e saíam sem postType). O ante é o valor que vários
// jogadores (3+) pagam igual, como primeiro post de cada um.
function anteSemTipo(mao: MaoParaRebuy): number | null {
  const preflop = (mao.streets ?? [])[0]?.actions ?? [];
  const contagem = new Map<number, number>();
  const jaPostou = new Set<string>();
  for (const a of preflop) {
    if (a.action !== "posts" || a.postType || jaPostou.has(a.player)) continue;
    jaPostou.add(a.player);
    const v = Number(a.amount) || 0;
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  let ante: number | null = null;
  let maior = 0;
  for (const [v, n] of contagem) if (n >= 3 && n > maior) [ante, maior] = [v, n];
  return ante;
}

// Fichas que o herói colocou na mesa na mão inteira (blinds, antes,
// apostas), já descontando aposta devolvida por não ter sido paga.
function fichasColocadas(mao: MaoParaRebuy, heroi: string): number {
  const ante = anteSemTipo(mao);
  let total = 0;
  for (const rua of mao.streets ?? []) {
    let naRua = 0;
    let postou = false;
    for (const a of rua.actions ?? []) {
      if (a.player !== heroi) continue;
      const valor = Number(a.amount) || 0;
      if (a.action === "uncalled_return") {
        total -= valor;
        continue;
      }
      if (a.action === "posts") {
        total += valor;
        // Ante vai direto pro pote: não conta na aposta da rua (o "raises
        // to X" é medido a partir do blind, sem o ante).
        const ehAnte = a.postType === "ante" || (!a.postType && !postou && ante != null && valor === ante);
        postou = true;
        if (!ehAnte) naRua += valor;
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

  // Foi all-in, não ganhou nada e nada voltou pra ele: quebrou. Não
  // depende da conta de fichas (que erra se algum post vier sem tipo).
  const acoes = (mao.streets ?? []).flatMap((r) => r.actions ?? []).filter((a) => a.player === heroi);
  const foiAllIn = acoes.some((a) => a.isAllIn || a.action === "allin");
  const recebeuDeVolta = acoes.some((a) => a.action === "uncalled_return" && (Number(a.amount) || 0) > 0);
  if (foiAllIn && !recebeuDeVolta) return true;

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
