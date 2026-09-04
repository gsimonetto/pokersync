"use client";

import Link from "next/link";
import { Lock, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { MODULE_COPY } from "@/lib/plans/module-copy";
import { cheapestPlanUnlocking, type ModuleKey } from "@/lib/plans/plans-data";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Modal de upsell: abre quando o jogador clica num modulo travado no menu
// (components/app-shell.tsx) ou cai aqui via redirect do middleware
// (?locked=<modulo>, ver lib/supabase/middleware.ts). Conteudo por
// modulo vem de lib/plans/module-copy.ts -- foco no beneficio pro
// jogador, nao em lista de feature tecnica solta.
export function PlanLockModal({ moduleKey, onClose }: { moduleKey: ModuleKey | null; onClose: () => void }) {
  if (!moduleKey) return null;
  const copy = MODULE_COPY[moduleKey];
  const plan = cheapestPlanUnlocking(moduleKey);

  return (
    <Modal open title={copy.title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-muted">
          <Lock size={14} />
          <span className="text-[11px] font-bold uppercase tracking-wider">Bloqueado no seu plano atual</span>
        </div>

        <p className="text-sm leading-relaxed text-ink">{copy.blurb}</p>

        <ul className="flex flex-col gap-2">
          {copy.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-muted">
              <Check size={14} className="mt-0.5 shrink-0 text-positive" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <p className="rounded-lg border border-hairline bg-elevated p-3 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-ink">Diferencial PokerSync: </span>
          {copy.differential}
        </p>

        {plan && (
          <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">
              Disponível a partir do plano <strong>{plan.name}</strong>
              {plan.priceCents ? ` — ${BRL.format(plan.priceCents / 100)}/mês` : ""}
            </p>
            <Link
              href="/planos"
              onClick={onClose}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90"
            >
              Ver planos
            </Link>
          </div>
        )}
      </div>
    </Modal>
  );
}
