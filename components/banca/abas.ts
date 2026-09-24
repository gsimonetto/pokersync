import { FileBarChart, History, LayoutGrid, ShieldAlert, Wallet } from "lucide-react";

// As 5 abas da Gestão de Banca (mesmo menu animado da Performance e do Time).
export type AbaBanca = "geral" | "sessoes" | "risco" | "dinheiro" | "relatorios";

export const ABAS_BANCA: { value: AbaBanca; label: string; icon: typeof LayoutGrid }[] = [
  { value: "geral", label: "Visão geral", icon: LayoutGrid },
  { value: "sessoes", label: "Sessões", icon: History },
  { value: "risco", label: "Risco & BRM", icon: ShieldAlert },
  { value: "dinheiro", label: "Dinheiro", icon: Wallet },
  { value: "relatorios", label: "Relatórios", icon: FileBarChart },
];
