import "server-only";
import Stripe from "stripe";
import type { AddonKey, PlanId } from "@/lib/plans/plans-data";

// SERVER-ONLY -- nunca importar isto de um Client Component (o pacote
// `stripe` usa APIs de Node, quebraria o bundle do navegador). A pagina
// /planos (client) so' conhece SELF_SERVE_PLAN_IDS/ADDON_PRICES, que vivem
// em lib/plans/plans-data.ts (dado puro) por causa disso.

// Price ID do Stripe (Dashboard -> Product catalog) por plano/addon --
// nenhum existe ainda: a conta Stripe esta com os documentos em
// validacao. Assim que a conta liberar e os produtos forem criados, so'
// preencher as env vars abaixo -- checkout e webhook ja estao prontos
// pra usar.
const PRICE_ENV_BY_PLAN: Partial<Record<PlanId, string>> = {
  individual: "STRIPE_PRICE_INDIVIDUAL",
  team: "STRIPE_PRICE_TEAM",
  team_pro: "STRIPE_PRICE_TEAM_PRO",
};

const PRICE_ENV_BY_ADDON: Record<AddonKey, string> = {
  radar: "STRIPE_PRICE_RADAR",
};

export function priceIdForPlan(planId: PlanId): string | null {
  const envName = PRICE_ENV_BY_PLAN[planId];
  return envName ? process.env[envName] || null : null;
}

export function priceIdForAddon(addon: AddonKey): string | null {
  return process.env[PRICE_ENV_BY_ADDON[addon]] || null;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

// Lazy + cacheado: instanciar no import quebraria toda rota que importar
// este arquivo antes da chave existir (ou em build, sem env carregada) --
// so' falha quando algo de fato TENTA chamar o Stripe sem
// STRIPE_SECRET_KEY configurada.
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_NAO_CONFIGURADO");
  if (!cached) cached = new Stripe(key);
  return cached;
}
