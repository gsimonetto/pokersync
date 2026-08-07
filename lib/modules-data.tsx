import { Target, TrendingUp, BookOpen, LineChart, Layers } from "lucide-react";
import type { ModuleDef } from "@/components/module-card";

export const ACCENT = {
  green: "#2FB89A",
  blue: "#5AA6E0",
  purple: "#A855F7",
  amber: "#E0B24C",
  pink: "#E0559E",
};

// Espelha o array `modules` de src/components/Dashboard.jsx (projeto Vite).
export const modules: ModuleDef[] = [
  {
    key: "drill",
    icon: Target,
    title: "Modo Treino",
    subtitle: "Ranges e frequencias GTO",
    accent: ACCENT.green,
    tag: "ATIVO",
    available: true,
  },
  {
    key: "bankroll",
    icon: TrendingUp,
    title: "Gestao de Banca",
    subtitle: "Controle de risco e ROI",
    accent: ACCENT.blue,
    available: true,
    href: "/banca",
  },
  {
    key: "revisor",
    icon: BookOpen,
    title: "Revisao de Maos",
    subtitle: "Analise tecnica de jogadas",
    accent: ACCENT.purple,
    available: true,
  },
  {
    key: "performance",
    icon: LineChart,
    title: "Player Evolution",
    subtitle: "ROI, ABI e tendencias de performance",
    accent: ACCENT.amber,
    available: false,
  },
  {
    key: "ranges",
    icon: Layers,
    title: "Construtor de Ranges",
    subtitle: "Mapeamento estrategico",
    accent: ACCENT.pink,
    available: false,
  },
];
