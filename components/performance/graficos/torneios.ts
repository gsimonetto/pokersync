import { invested, net } from "@/lib/bankroll/calc";
import { TOURNEY_FORMATS } from "@/lib/bankroll/format";
import type { Session } from "@/lib/bankroll/types";

// Sessões de TORNEIO da Gestão de Banca numa moeda só -- a mesma fonte do
// "Lucro total"/ROI da aba Estatísticas. Somar real com dólar daria um
// número sem sentido, então fica a moeda com mais torneios (sessão sem
// moeda = BRL, convenção da Gestão de Banca).
export function torneiosNumaMoeda(sessoes: Session[]): { lista: Session[]; moeda: string } {
  const torneios = sessoes.filter((s) => TOURNEY_FORMATS.has(s.format));
  const contagem = new Map<string, number>();
  for (const s of torneios) {
    const m = s.currency || "BRL";
    contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  const moeda = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "BRL";
  return { lista: torneios.filter((s) => (s.currency || "BRL") === moeda), moeda };
}

export function formatadorMoeda(moeda: string, compacto = false) {
  const f = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: moeda,
    maximumFractionDigits: compacto ? 0 : 2,
    minimumFractionDigits: compacto ? 0 : 2,
  });
  return (n: number) => f.format(n);
}

export { invested, net };
