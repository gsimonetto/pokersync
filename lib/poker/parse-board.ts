// Normaliza dados de carta vindos do banco para o formato que o
// componente Card espera: string crua ("Ah") ou null para slot vazio.
// Portado de utils/parseBoard.js.

export function parseBoard(boardArr: unknown): (string | null)[] {
  const cards: (string | null)[] = Array.isArray(boardArr)
    ? boardArr.map((s) => {
        const str = String(s).trim();
        return str.length >= 2 ? str : null;
      })
    : [];
  while (cards.length < 5) cards.push(null);
  return cards;
}

// Converte a mao sorteada pelo solver (ex: "AsKd") em duas cartas cruas.
export function parseHeroCombo(comboStr: string | null | undefined): [string | null, string | null] {
  if (typeof comboStr !== "string" || comboStr.length !== 4) return [null, null];
  return [comboStr.slice(0, 2), comboStr.slice(2, 4)];
}
