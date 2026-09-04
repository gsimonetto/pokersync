// Fonte unica de verdade da estrutura de precos: o que cada plano libera,
// bloqueia ou limita por modulo. Espelha `lib/modules-data.tsx` nas chaves
// de modulo (`ModuleKey` == `ModuleDef["key"]`) pra ficar facil cruzar os
// dois na hora de renderizar o grid de /modulos com o plano do usuario.
//
// `user_plans.plan` (Supabase) guarda qual `PlanId` o usuario esta -- esse
// arquivo e' quem decide o que cada `PlanId` significa em termos de acesso.

export type PlanId = "free" | "individual" | "individual_pro" | "team" | "team_pro";

export type ModuleKey = "drill" | "bankroll" | "revisor" | "hub" | "time" | "performance" | "ranges";

// Radar PokerSync ainda nao e' um card em `lib/modules-data.tsx` -- e'
// vendido como complemento avulso (add-on), por isso fica fora da matriz
// de modulos e tem a propria checagem (`hasAddon`).
export type AddonKey = "radar";

export interface ModuleLimit {
  amount: number;
  period: "day" | "month";
  // Free no Modo Treino: 10 sessoes sorteadas por dia, o jogador nao
  // escolhe qual vai treinar.
  random?: boolean;
}

export interface ModuleAccess {
  unlocked: boolean;
  // So' existe quando o modulo e' liberado com restricao (planos pagos
  // nao tem `limit`, ficam ilimitados).
  limit?: ModuleLimit;
}

export interface PlanDef {
  id: PlanId;
  name: string;
  // null = gratuito. Nos demais, valor em centavos pra nao arredondar
  // errado (R$ 99,90 == 9990).
  priceCents: number | null;
  // So' Team/Team Pro: quantos acessos de jogador o plano inclui.
  seats?: number;
  modules: Record<ModuleKey, ModuleAccess>;
  addons: Record<AddonKey, boolean>;
}

const TEAM_MODULES: Record<ModuleKey, ModuleAccess> = {
  drill: { unlocked: true },
  bankroll: { unlocked: true },
  revisor: { unlocked: true },
  hub: { unlocked: true },
  time: { unlocked: true },
  performance: { unlocked: true },
  ranges: { unlocked: true },
};

const INDIVIDUAL_MODULES: Record<ModuleKey, ModuleAccess> = {
  ...TEAM_MODULES,
  // Meu Time e' exclusivo dos planos Team -- gerenciar jogadores nao faz
  // sentido pra quem esta sozinho no plano.
  time: { unlocked: false },
};

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceCents: 0,
    modules: {
      drill: { unlocked: true, limit: { amount: 10, period: "day", random: true } },
      bankroll: { unlocked: true, limit: { amount: 10, period: "month" } },
      revisor: { unlocked: false },
      // Bloqueado inclui nao poder participar dos eventos/temporadas do Hub.
      hub: { unlocked: false },
      time: { unlocked: false },
      performance: { unlocked: false },
      ranges: { unlocked: false },
    },
    addons: { radar: false },
  },
  individual: {
    id: "individual",
    name: "Individual",
    priceCents: 9990,
    modules: INDIVIDUAL_MODULES,
    addons: { radar: false },
  },
  individual_pro: {
    id: "individual_pro",
    name: "Individual Pro",
    priceCents: 19990,
    modules: INDIVIDUAL_MODULES,
    // Unica diferenca hoje entre Individual e Individual Pro: o Radar.
    addons: { radar: true },
  },
  team: {
    id: "team",
    name: "Team",
    priceCents: 49990,
    seats: 10,
    modules: TEAM_MODULES,
    addons: { radar: true },
  },
  team_pro: {
    id: "team_pro",
    name: "Team Pro",
    priceCents: 99990,
    seats: 50,
    modules: TEAM_MODULES,
    addons: { radar: true },
  },
};

export const PLAN_IDS: PlanId[] = ["free", "individual", "individual_pro", "team", "team_pro"];

function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as string[]).includes(value);
}

// `user_plans.plan` pode vir de uma linha antiga, de uma migracao futura,
// ou simplesmente nao existir ainda (usuario sem linha == free) -- nunca
// confiar que o valor bate com `PlanId` sem checar.
export function toPlanId(value: string | null | undefined): PlanId {
  if (value && isPlanId(value)) return value;
  return "free";
}

export function isModuleUnlocked(plan: PlanId, module: ModuleKey): boolean {
  return PLANS[plan].modules[module].unlocked;
}

export function getModuleLimit(plan: PlanId, module: ModuleKey): ModuleLimit | null {
  return PLANS[plan].modules[module].limit ?? null;
}

export function hasAddon(plan: PlanId, addon: AddonKey): boolean {
  return PLANS[plan].addons[addon];
}

// Plano mais barato (na ordem de PLAN_IDS, que ja e' crescente por preco)
// que libera o modulo -- usado no texto "disponivel a partir do plano X"
// da modal de bloqueio e da pagina /planos.
export function cheapestPlanUnlocking(module: ModuleKey): PlanDef | null {
  const id = PLAN_IDS.find((planId) => isModuleUnlocked(planId, module));
  return id ? PLANS[id] : null;
}

// --------------------------------------------------------------
// Rotas -> modulo (pra gating de URL, ver lib/supabase/middleware.ts)
// --------------------------------------------------------------
//
// So' entram aqui modulos que podem ficar TOTALMENTE bloqueados em algum
// plano (ver PLANS acima). Treino e Banca nunca ficam totalmente
// bloqueados -- no Free eles sao liberados com limite (sessoes/mes), o
// que e' uma restricao de uso dentro do modulo, nao uma rota inteira
// vetada, entao ficam de fora do gating de middleware por enquanto.
export const MODULE_ROUTES: { prefix: string; module: ModuleKey; exclude?: string[] }[] = [
  { prefix: "/revisor", module: "revisor", exclude: ["/revisor/admin"] },
  { prefix: "/hub", module: "hub" },
  { prefix: "/performance", module: "performance" },
  { prefix: "/ranges", module: "ranges" },
  // "/time/convite" fica de fora por proposito (ver PUBLIC_ROUTES em
  // lib/supabase/middleware.ts): o convidado ainda nao tem plano nem
  // sessao resolvida quando abre o link do convite.
  { prefix: "/time", module: "time", exclude: ["/time/convite"] },
];

export function resolveModuleForRoute(pathname: string): ModuleKey | null {
  for (const route of MODULE_ROUTES) {
    const matchesPrefix = pathname === route.prefix || pathname.startsWith(`${route.prefix}/`);
    if (!matchesPrefix) continue;
    const excluded = route.exclude?.some((ex) => pathname === ex || pathname.startsWith(`${ex}/`));
    if (excluded) return null;
    return route.module;
  }
  return null;
}
