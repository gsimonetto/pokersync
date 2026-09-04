import { Target, TrendingUp, BookOpen, LineChart, Layers, Users, Trophy, Radar as RadarIcon } from "lucide-react";
import type { ModuleDef } from "@/components/module-card";

export const ACCENT = {
  green: "#2FB89A",
  blue: "#5AA6E0",
  purple: "#A855F7",
  amber: "#E0B24C",
  pink: "#E0559E",
  cyan: "#22D3EE",
  indigo: "#6366F1",
  gold: "#E8B93C",
};

// Espelha o array `modules` de src/components/Dashboard.jsx (projeto Vite).
export const modules: ModuleDef[] = [
  {
    key: "drill",
    icon: Target,
    title: "Modo Treino",
    subtitle: "Ranges e frequencias GTO",
    accent: ACCENT.green,
    available: true,
    href: "/treino",
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
    href: "/revisor",
  },
  {
    key: "hub",
    icon: Trophy,
    title: "Hub de Evolução",
    subtitle: "XP, missões e ranking",
    accent: ACCENT.amber,
    available: true,
    href: "/hub",
  },
  {
    key: "time",
    icon: Users,
    title: "Meu Time",
    subtitle: "Membros, papeis e convites",
    // Antes usava o mesmo verde do Modo Treino -- cor deixava de
    // diferenciar os dois modulos numa varredura rapida do grid.
    accent: ACCENT.indigo,
    available: true,
    href: "/time",
  },
  {
    key: "performance",
    icon: LineChart,
    title: "Player Evolution",
    subtitle: "Preflop, postflop, torneios e leaks",
    // Amber liberado pro Hub (que ja usa essa cor como identidade
    // propria em app/hub/page.tsx) -- Performance passa pro cyan.
    accent: ACCENT.cyan,
    available: true,
    href: "/performance",
  },
  {
    key: "ranges",
    icon: Layers,
    title: "Construtor de Ranges",
    subtitle: "Mapeamento estrategico",
    accent: ACCENT.pink,
    available: true,
    href: "/ranges",
  },
  {
    // "radar" nao e' um ModuleKey (lib/plans/plans-data.ts) -- e' um
    // AddonKey, vendido a parte do plano base. O AppShell (nav) trata
    // esta chave como caso especial: checa hasAddon() em vez de
    // isModuleUnlocked() antes de decidir se cadeado.
    key: "radar",
    icon: RadarIcon,
    title: "Radar PokerSync",
    subtitle: "Agente desktop de sincronização",
    accent: ACCENT.gold,
    available: true,
    href: "/radar",
  },
];
