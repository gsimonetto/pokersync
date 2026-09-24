import type { RangeOption } from "@/lib/bankroll/calc";
import type { TransactionType } from "@/lib/bankroll/types";

// Peças pequenas da Gestão de Banca usadas por mais de uma aba.

// Mesmas cores dos gráficos da Performance (components/performance/graficos/base.tsx).
export { COR_NEGATIVO, COR_POSITIVO, COR_UNICA } from "@/components/performance/graficos/base";

export const COR_ALERTA = "#f59e0b";

export const PERIODOS: { value: RangeOption; label: string }[] = [
  { value: "7D", label: "7D" },
  { value: "30D", label: "30D" },
  { value: "1Y", label: "Ano" },
  { value: "all", label: "Tudo" },
];

export const PERIODO_EXTENSO: Record<RangeOption, string> = {
  "7D": "Últimos 7 dias",
  "30D": "Últimos 30 dias",
  "1Y": "Último ano",
  all: "Todo o período",
};

// Mesmos cortes do filtro de buy-in da Performance (types/analysis.ts),
// mas cobrindo cash e torneio.
export const FAIXAS_BUYIN: { value: string; label: string; test: (v: number) => boolean }[] = [
  { value: "all", label: "Qualquer buy-in", test: () => true },
  { value: "0-10", label: "Até 10", test: (v) => v > 0 && v <= 10 },
  { value: "10-50", label: "10–50", test: (v) => v > 10 && v <= 50 },
  { value: "50-200", label: "50–200", test: (v) => v > 50 && v <= 200 },
  { value: "200+", label: "Acima de 200", test: (v) => v > 200 },
];

export const TIPO_TX: Record<TransactionType, string> = {
  deposito: "Depósito",
  saque: "Saque",
  caixinha: "Caixinha",
  rakeback: "Rakeback",
  bonus: "Bônus",
  despesa: "Despesa",
};

export const CATEGORIAS_DESPESA: { value: string; label: string }[] = [
  { value: "coach", label: "Coach" },
  { value: "software", label: "Software" },
  { value: "viagem", label: "Viagem/Live" },
  { value: "outros", label: "Outros" },
];
export const nomeCategoria = (c?: string) => CATEGORIAS_DESPESA.find((x) => x.value === c)?.label ?? "Outros";

// Cor de cada tipo de movimentação (entrada verde, saída vermelha,
// reserva âmbar, extras dourado, despesa roxa).
export const COR_TX: Record<TransactionType, string> = {
  deposito: "#22c55e",
  saque: "#e0555a",
  caixinha: "#f59e0b",
  rakeback: "#d4af37",
  bonus: "#d4af37",
  despesa: "#a855f7",
};

// Em cash o jogador recompra/recarrega; "reentrada" é termo de torneio.
export const ROTULO_REENTRADA: Record<string, string> = {
  MTT: "Reentradas",
  SNG: "Reentradas",
  Spin: "Reentradas",
  Cash: "Rebuys/add-on",
};

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-09-24" -> "24/09" */
export function dataCurta(iso: string): string {
  const [, m, d] = (iso || "").split("-");
  return d && m ? `${d}/${m}` : iso;
}

/** "2026-09-24" -> "24/09/2026" */
export function dataBR(iso: string): string {
  const [a, m, d] = (iso || "").split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** "2026-09-24" -> "24 set" */
export function dataEixo(iso: string): string {
  const [, m, d] = (iso || "").split("-");
  const mes = MESES_CURTOS[Number(m) - 1];
  return mes ? `${Number(d)} ${mes}` : iso;
}

/** "2026-09" -> "Setembro de 2026" */
export function mesExtenso(anoMes: string): string {
  const [a, m] = anoMes.split("-");
  const nome = MESES[Number(m) - 1] ?? m;
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

/** "Há 5 min" pro status do Radar. */
export function haQuanto(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

/** Aceita o jeito brasileiro de digitar: "1.234,56", "12,5" ou "12.5". */
export function numero(v: string): number {
  const t = String(v ?? "").trim();
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

export const num1 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Classe dos campos de formulário no visual de vidro.
export const CAMPO =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-[#d4af37]/60";

// Botão principal (dourado) e secundário do produto.
export const BOTAO_OURO =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e2c35a] active:scale-[0.97] disabled:opacity-50";
export const BOTAO_VIDRO =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-ink/90 transition hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.97]";
export const BOTAO_ICONE =
  "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted transition hover:border-white/20 hover:text-ink";
