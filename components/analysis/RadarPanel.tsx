import { Check, Download, Radar as RadarIcon } from "lucide-react";
import { RADAR_COPY } from "@/lib/plans/module-copy";

// Conteudo do addon Radar PokerSync, agora reaproveitado dentro de Player
// Evolution (aba "Radar", pedido explicito: "radar pokersync deve ficar
// dentro do player evolution") -- app/radar/page.tsx continua existindo
// como rota standalone pra manter o gating de addon (ver ADDON_ROUTES em
// lib/plans/plans-data.ts), so' que agora envolve este mesmo componente
// em vez de duplicar o conteudo.
//
// O agente em si vive no repo gsimonetto/pokersync-agent (Tauri + Rust) --
// este link aponta pra pagina de Releases de la.
const AGENT_RELEASES_URL = "https://github.com/gsimonetto/pokersync-agent/releases";

export function RadarPanel() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#E8B93C]/30 bg-[#E8B93C]/10 text-[#E8B93C]">
          <RadarIcon size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink">{RADAR_COPY.title}</h2>
          <p className="text-sm text-muted">{RADAR_COPY.blurb}</p>
        </div>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted/60">O que ele faz</p>
        <ul className="mt-3 flex flex-col gap-2.5">
          {RADAR_COPY.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-ink">
              <Check size={14} className="mt-0.5 shrink-0 text-positive" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-hairline bg-elevated p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted/60">Como funciona</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Depois de instalado, o Radar roda em segundo plano (fica na bandeja do sistema) e varre as pastas de hand
          history do seu computador — PokerStars, GGPoker, PartyPoker, 888poker e ACR. Só o que mudou desde a última
          varredura é reenviado, e cada mão importada alimenta automaticamente o Revisor e o Player Evolution, sem
          precisar colar hand history na mão.
        </p>
      </div>

      <div className="flex flex-col items-start gap-3 rounded-xl border border-hairline bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Disponível para Windows, macOS e Linux</p>
          <p className="mt-0.5 text-xs text-muted">Faça login com a mesma conta do PokerSync depois de instalar.</p>
        </div>
        <a
          href={AGENT_RELEASES_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90"
        >
          <Download size={15} />
          Baixar o Agente
        </a>
      </div>
    </div>
  );
}
