"use client";

import { useEffect, useRef, useState } from "react";
import { Radar as RadarIcon, History, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import {
  fetchRadarModuleScope,
  setRadarModuleScope,
  clearRadarModuleScope,
  type RadarModule,
  type RadarModuleScope,
} from "@/lib/services/radar-module-scope-service";

// Botão do Radar dentro de cada módulo que recebe dado automático do
// Agente (Gestão de Banca, Revisor de Mãos, Performance) -- pedido
// explícito: cada aba precisa poder "trazer desde o início", "trazer de
// agora em diante" e "zerar módulo" sozinha, sem passar pela tela
// separada do Radar. Ver comentário da migration
// 20260921120000_radar_module_scope.sql pra entender que isso é só um
// filtro de EXIBIÇÃO por módulo (instantâneo), não pede o Agente pra
// escanear de novo.
export function RadarModuleMenu({
  module,
  moduleLabel,
  onScopeChange,
  onReset,
}: {
  module: RadarModule;
  /** Nome do módulo em português, usado só nos textos de confirmação. */
  moduleLabel: string;
  /** Chamado depois de mudar o escopo (full_history/from_now) -- o módulo decide como refiltrar/recarregar. */
  onScopeChange: (state: { scope: RadarModuleScope; since: string | null }) => void;
  /** Chamado depois de "zerar módulo" -- o módulo decide como recarregar a lista. */
  onReset: () => void;
}) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<RadarModuleScope | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRadarModuleScope(module)
      .then((s) => setScope(s.scope))
      .catch(() => {});
  }, [module]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function choose(next: RadarModuleScope) {
    setBusy(true);
    setOpen(false);
    try {
      await setRadarModuleScope(module, next);
      const since = next === "from_now" ? new Date().toISOString() : null;
      setScope(next);
      onScopeChange({ scope: next, since });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setOpen(false);
    const ok = await confirm({
      title: `Zerar ${moduleLabel}`,
      message: `Isso apaga os dados que o Radar importou automaticamente pra ${moduleLabel} — o que você registrou manualmente continua intacto. Não dá pra desfazer.`,
      confirmLabel: "Zerar",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await onReset();
      await clearRadarModuleScope(module);
      setScope(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title="Radar PokerSync"
        aria-label="Radar PokerSync"
        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors disabled:opacity-50 ${
          open ? "border-[#E8B93C] bg-[#E8B93C]/15 text-[#E8B93C]" : "border-hairline bg-elevated text-muted hover:border-[#E8B93C]/50 hover:text-[#E8B93C]"
        }`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <RadarIcon size={16} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-hairline bg-surface p-2 shadow-lg">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted/60">Radar PokerSync</p>
          <button
            type="button"
            onClick={() => choose("full_history")}
            className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-elevated"
          >
            <History size={15} className="mt-0.5 shrink-0 text-training" />
            <span>
              <span className="block text-[13px] font-semibold text-ink">Trazer desde o início</span>
              <span className="block text-[11.5px] leading-snug text-muted">Mostra aqui tudo que o Radar já importou, desde o começo.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => choose("from_now")}
            className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-elevated"
          >
            <Sparkles size={15} className="mt-0.5 shrink-0 text-training" />
            <span>
              <span className="block text-[13px] font-semibold text-ink">Trazer de agora em diante</span>
              <span className="block text-[11.5px] leading-snug text-muted">
                Esconde aqui o que já foi importado antes de agora — só entra o que acontecer daqui pra frente.
              </span>
            </span>
          </button>
          <div className="my-1 h-px bg-hairline" />
          <button
            type="button"
            onClick={handleReset}
            className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-negative/10"
          >
            <RotateCcw size={15} className="mt-0.5 shrink-0 text-negative/80" />
            <span>
              <span className="block text-[13px] font-semibold text-negative/90">Zerar módulo</span>
              <span className="block text-[11.5px] leading-snug text-muted">Apaga o que o Radar trouxe pra {moduleLabel}. O que você registrou à mão fica.</span>
            </span>
          </button>
          {scope && (
            <p className="mt-1 px-2 pb-0.5 text-[10.5px] text-muted/70">
              Hoje: {scope === "full_history" ? "mostrando desde o início" : "mostrando só a partir de quando você escolheu"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
