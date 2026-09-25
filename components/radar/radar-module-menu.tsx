"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Loader2, Radar as RadarIcon, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { InfoHover } from "@/components/painel/info-hover";
import { fetchRadarImportScope, type RadarImportScope } from "@/lib/services/agent-status-service";
import {
  fetchRadarModuleScope,
  setRadarModuleScope,
  clearRadarModuleScope,
  type RadarModule,
  type RadarModuleScope,
} from "@/lib/services/radar-module-scope-service";

// Seletor do Radar dentro de cada módulo que recebe dado automático do
// Radar (Gestão de Banca, Revisor de Mãos, Performance) -- pedido
// explícito: cada módulo escolhe sozinho se mostra tudo o que o Radar já
// trouxe ou só de hoje em diante, com a opção ATIVA sempre visível (antes
// era um menu escondido atrás de um ícone, sem mostrar o que estava
// valendo), um "?" explicando o que o Radar traz pra aquele módulo e o
// "apagar". É só um filtro de EXIBIÇÃO (instantâneo, não apaga nem pede o
// Radar pra varrer de novo) -- o que o Radar busca no computador é outra
// escolha, feita no próprio Radar ou na página do Radar
// (profiles.radar_import_scope). Ver migration
// 20260921120000_radar_module_scope.sql.

const OPCOES: { value: RadarModuleScope; rotulo: string }[] = [
  { value: "full_history", rotulo: "Tudo" },
  { value: "from_now", rotulo: "De hoje em diante" },
];

const O_QUE_O_RADAR_BUSCA: Record<RadarImportScope, string> = {
  from_now: "só de agora em diante",
  last_3_months: "os últimos 3 meses",
  full_history: "tudo no computador",
};

// O que o Radar traz pra cada módulo (o "?") e o que o "apagar" apaga.
const TEXTOS: Record<RadarModule, { titulo: string; traz: string; apagar: string }> = {
  banca: {
    titulo: "Radar na Gestão de Banca",
    traz: "O Radar traz pra cá os torneios que você jogou — buy-in, prêmio e colocação — lidos das mãos e dos resumos de torneio do seu computador. Cada torneio vira uma sessão, convertida de dólar pra real pela cotação do dia.",
    apagar: "Apaga as sessões que o Radar criou na Gestão de Banca. As que você registrou à mão ficam. Não dá pra desfazer.",
  },
  revisor: {
    titulo: "Radar no Revisor de Mãos",
    traz: "O Radar traz pra cá as mãos das suas hand histories, agrupadas por torneio, prontas pra revisar na mesa.",
    apagar: "Apaga do Revisor as mãos importadas (pelo Radar ou por arquivo). As que você colou à mão ficam. Não dá pra desfazer.",
  },
  performance: {
    titulo: "Radar no Performance",
    traz: "O Radar alimenta as estatísticas daqui — VPIP, PFR, 3-bet, ROI e o resto — com as mãos e torneios que importou.",
    apagar: "Zera as estatísticas do Performance. As mãos continuam salvas no Revisor de Mãos. Não dá pra desfazer.",
  },
};

function dataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function RadarModuleMenu({
  module,
  onScopeChange,
  onReset,
}: {
  module: RadarModule;
  /** Nome do módulo em português (mantido por compatibilidade; os textos vêm de TEXTOS). */
  moduleLabel?: string;
  /** Chamado depois de mudar o que aparece (full_history/from_now) -- o módulo decide como refiltrar/recarregar. */
  onScopeChange: (state: { scope: RadarModuleScope; since: string | null }) => void;
  /** Chamado ao confirmar o "apagar" -- o módulo apaga o que é dele e recarrega. */
  onReset: () => void | Promise<void>;
}) {
  const confirm = useConfirm();
  const [scope, setScope] = useState<RadarModuleScope | null>(null);
  const [since, setSince] = useState<string | null>(null);
  // undefined = carregando; null = o jogador ainda não escolheu o que o Radar busca.
  const [busca, setBusca] = useState<RadarImportScope | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState<"escolha" | "apagar" | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetchRadarModuleScope(module)
      .then((s) => {
        setScope(s.scope);
        setSince(s.since);
      })
      .catch(() => {});
    fetchRadarImportScope()
      .then(setBusca)
      .catch(() => setBusca(null));
  }, [module]);

  // Nunca mexeu = mostra tudo (comportamento de sempre) — e o seletor diz isso.
  const ativo: RadarModuleScope = scope ?? "full_history";
  const desde = dataCurta(since);
  const textos = TEXTOS[module];

  async function escolher(next: RadarModuleScope) {
    if (ocupado || next === ativo) return;
    setOcupado("escolha");
    setErro("");
    try {
      await setRadarModuleScope(module, next);
      const novoSince = next === "from_now" ? new Date().toISOString() : null;
      setScope(next);
      setSince(novoSince);
      onScopeChange({ scope: next, since: novoSince });
    } catch {
      setErro("Não deu pra trocar agora. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  async function apagar() {
    const ok = await confirm({
      title: "Apagar o que o Radar trouxe pra cá",
      message: textos.apagar,
      confirmLabel: "Apagar",
      tone: "danger",
    });
    if (!ok) return;
    setOcupado("apagar");
    setErro("");
    try {
      await onReset();
      await clearRadarModuleScope(module);
      setScope(null);
      setSince(null);
    } catch {
      setErro("Não deu pra apagar agora. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div role="group" aria-label="O que o Radar mostra aqui" className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <span className="flex items-center gap-1.5 pl-1.5 pr-0.5 text-[12px] text-muted">
          <RadarIcon size={14} className="text-[#E8B93C]" aria-hidden />
          <span className="hidden sm:inline">Mostrar:</span>
        </span>
        {OPCOES.map((o) => {
          const on = ativo === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              disabled={ocupado !== null}
              onClick={() => escolher(o.value)}
              title={on && o.value === "from_now" && desde ? `Mostrando o que foi jogado desde ${desde}` : undefined}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-default ${
                on
                  ? "bg-[#E8B93C]/15 text-[#E8B93C] ring-1 ring-inset ring-[#E8B93C]/40"
                  : "text-muted hover:bg-white/[0.05] hover:text-ink"
              }`}
            >
              {ocupado === "escolha" && !on && <Loader2 size={12} className="animate-spin" aria-hidden />}
              {o.rotulo}
            </button>
          );
        })}
        <InfoHover
          className="rounded-lg"
          explicacao={{
            titulo: textos.titulo,
            oQueE: textos.traz,
            itens: [
              {
                rotulo: "Radar busca",
                valor: busca ? O_QUE_O_RADAR_BUSCA[busca] : busca === null ? "falta escolher" : "…",
              },
              {
                rotulo: "Aparece aqui",
                valor: ativo === "full_history" ? "tudo que ele trouxe" : desde ? `desde ${desde}` : "de hoje em diante",
              },
            ],
            origem: "Radar PokerSync (programa no seu computador)",
            comoCalcula:
              "“Tudo” mostra tudo o que o Radar já trouxe; “De hoje em diante” esconde o que veio antes, sem apagar nada. O que o Radar busca no computador você escolhe no próprio Radar ou na página do Radar.",
          }}
        >
          <span className="grid h-7 w-7 place-items-center text-muted transition-colors hover:text-ink" aria-label={`O que o Radar traz: ${textos.titulo}`}>
            <HelpCircle size={15} aria-hidden />
          </span>
        </InfoHover>
        <button
          type="button"
          onClick={apagar}
          disabled={ocupado !== null}
          title="Apagar o que o Radar trouxe pra cá"
          aria-label="Apagar o que o Radar trouxe pra cá"
          className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-negative/10 hover:text-negative disabled:opacity-50"
        >
          {ocupado === "apagar" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
      {erro && <p className="text-[11px] text-negative">{erro}</p>}
    </div>
  );
}
