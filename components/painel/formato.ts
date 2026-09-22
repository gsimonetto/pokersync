// Formatação de números e datas do Painel, sempre em português do Brasil.
//
// Motivo de existir: cada card formatava do seu jeito, e escapavam
// números em formato americano ("+18.4%", "8450 XP") e datas com "De"
// maiúsculo no meio ("22 De Set."), porque a classe CSS `capitalize`
// põe maiúscula em TODA palavra, não só na primeira.

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const umaCasa = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const ateUmaCasa = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** 8450 -> "8.450" */
export function num(n: number): string {
  return inteiro.format(Math.round(n));
}

/** 18.4 -> "+18,4%" (com sinal) ou "18,4%" */
export function pct(n: number, { sinal = false, casas = 1 }: { sinal?: boolean; casas?: 0 | 1 } = {}): string {
  const txt = casas === 0 ? inteiro.format(Math.round(n)) : umaCasa.format(n);
  return `${sinal && n > 0 ? "+" : ""}${txt}%`;
}

/**
 * Horas de estudo. `goalProgress` devolve o estudo em HORAS com uma casa
 * (0,4 = 24 minutos); arredondar pra inteiro escondia o progresso de
 * quem estudou menos de uma hora ("0 de 5 horas"). Abaixo de 1 h mostra
 * em minutos, que é como o jogador pensa nesse caso.
 */
export function horas(h: number): string {
  if (h > 0 && h < 1) return `${Math.round(h * 60)} min`;
  return `${ateUmaCasa.format(h)} h`;
}

/** "terça-feira, 22 de setembro" -> "Terça-feira, 22 de setembro" */
export function primeiraMaiuscula(txt: string): string {
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : txt;
}

export function dataLonga(d: Date): string {
  return primeiraMaiuscula(
    d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }),
  );
}

export function dataCurta(d: Date): string {
  return primeiraMaiuscula(
    d.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  );
}

export function mesAno(d: Date): string {
  return primeiraMaiuscula(d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
}
