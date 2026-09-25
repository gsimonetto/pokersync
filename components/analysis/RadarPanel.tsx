"use client";

import { useEffect, useState } from "react";
import { CalendarRange, Check, Download, History, Loader2, RotateCcw, Radar as RadarIcon, Sparkles } from "lucide-react";
import { RADAR_COPY } from "@/lib/plans/module-copy";
import {
  fetchMostRecentAgentDevice,
  fetchRadarImportScope,
  radarLigadoAgora,
  setRadarImportScope,
  type AgentDeviceStatus,
  type RadarImportScope,
} from "@/lib/services/agent-status-service";
import { resetPerformanceStats } from "@/lib/services/analysis-service";
import { haQuanto } from "@/components/banca/util";
import { useConfirm } from "@/components/confirm-dialog";

// Conteudo do addon Radar PokerSync, agora reaproveitado dentro de Player
// Evolution (aba "Radar", pedido explicito: "radar pokersync deve ficar
// dentro do player evolution") -- app/radar/page.tsx continua existindo
// como rota standalone pra manter o gating de addon (ver ADDON_ROUTES em
// lib/plans/plans-data.ts), so' que agora envolve este mesmo componente
// em vez de duplicar o conteudo.
//
// O Radar em si vive no repo gsimonetto/pokersync-radar (Tauri + Rust).
// Download direto do instalador da versão oficial mais recente: o workflow
// de release de lá publica uma cópia de cada instalador com nome fixo (sem
// número de versão), então o link nunca muda. Antes o botão levava pra
// página do GitHub, com 7 arquivos, nome antigo e o aviso "para teste".
const DOWNLOAD_BASE = "https://github.com/gsimonetto/pokersync-radar/releases/latest/download";
type Sistema = "windows" | "mac" | "linux";
const DOWNLOADS: Record<Sistema, { rotulo: string; arquivo: string }> = {
  windows: { rotulo: "Windows", arquivo: "Radar-PokerSync-Windows.exe" },
  mac: { rotulo: "Mac (chip Apple)", arquivo: "Radar-PokerSync-Mac.dmg" },
  linux: { rotulo: "Linux", arquivo: "Radar-PokerSync-Linux.AppImage" },
};

function sistemaDoNavegador(): Sistema {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return "mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "windows";
}

// Mesmas três opções que o próprio Radar mostra no primeiro login (pedido
// explícito: a escolha fica no Radar e no site) — ver
// app/api/agent/import-scope e profiles.radar_import_scope.
const SCOPE_OPTIONS: { value: RadarImportScope; icon: typeof Sparkles; title: string; desc: string }[] = [
  {
    value: "from_now",
    icon: Sparkles,
    title: "Só de agora em diante",
    desc: "O Radar importa só os torneios e mãos que você jogar depois de responder isso — o que já existe no computador fica de fora.",
  },
  {
    value: "last_3_months",
    icon: CalendarRange,
    title: "Os últimos 3 meses",
    desc: "O Radar importa os torneios e mãos dos últimos 3 meses que já estão no computador, e tudo o que vier daqui pra frente.",
  },
  {
    value: "full_history",
    icon: History,
    title: "Tudo",
    desc: "O Radar importa tudo que encontrar no computador, incluindo torneios e mãos antigos, além do que vier daqui pra frente.",
  },
];

export function RadarPanel({ onReset }: { onReset?: () => void }) {
  // undefined = ainda carregando, null = ainda não respondeu.
  const [scope, setScope] = useState<RadarImportScope | null | undefined>(undefined);
  const [saving, setSaving] = useState<RadarImportScope | null>(null);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [sistema, setSistema] = useState<Sistema>("windows");
  // undefined = carregando; null = nenhum Radar instalado nesta conta ainda.
  const [aparelho, setAparelho] = useState<AgentDeviceStatus | null | undefined>(undefined);
  const confirm = useConfirm();

  useEffect(() => {
    fetchRadarImportScope()
      .then(setScope)
      .catch(() => setError("Não foi possível carregar sua preferência de importação."));
    setSistema(sistemaDoNavegador());
    // Status é complemento: se falhar, a tela segue sem ele.
    fetchMostRecentAgentDevice()
      .then(setAparelho)
      .catch(() => setAparelho(null));
  }, []);

  async function choose(value: RadarImportScope) {
    setSaving(value);
    setError("");
    try {
      await setRadarImportScope(value);
      setScope(value);
    } catch {
      setError("Não foi possível salvar sua escolha. Tente de novo.");
    } finally {
      setSaving(null);
    }
  }

  // "Começar do zero" (pedido explícito) -- zera só as estatísticas do
  // Performance (hand_tags), sem apagar as mãos do Revisor nem os
  // torneios da Gestão de Banca. Também limpa a escolha de escopo acima,
  // pra voltar a perguntar (útil se o jogador quer mudar de ideia sobre
  // importar histórico completo).
  async function handleReset() {
    const ok = await confirm({
      title: "Resetar Performance",
      message:
        "Isso zera todas as estatísticas do Performance (VPIP, PFR, C-Bet, ROI de mãos etc.) e volta a perguntar o escopo de importação. As mãos continuam salvas no Revisor de Mãos e os torneios na Gestão de Banca — só os números daqui somem, até você reimportar ou reabrir as mãos.",
      confirmLabel: "Resetar",
    });
    if (!ok) return;
    setResetting(true);
    setError("");
    try {
      await resetPerformanceStats();
      setScope(null);
      onReset?.();
    } catch {
      setError("Não foi possível resetar agora. Tente de novo.");
    } finally {
      setResetting(false);
    }
  }

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

      {/* Pergunta obrigatória (pedido explicito: "isso precisa ser
          perguntado antes de comecar a importar qualquer mao ou
          torneio") -- enquanto nao responder, nem o resto do conteudo
          (benefícios/como funciona/baixar) aparece, pra ninguem instalar
          o agente sem antes decidir o escopo. O backend (endpoints
          /api/agent/sync*) tambem recusa qualquer import enquanto
          profiles.radar_import_scope estiver null, entao mesmo quem ja
          tinha o agente instalado antes dessa pergunta existir fica
          pausado ate' responder aqui. */}
      {scope === undefined ? (
        <div className="flex items-center justify-center rounded-xl border border-hairline bg-surface p-8">
          <Loader2 size={18} className="animate-spin text-muted" />
        </div>
      ) : scope === null ? (
        <div className="rounded-xl border border-training/40 bg-training/[0.06] p-5">
          <p className="text-sm font-semibold text-ink">O que o Radar deve importar?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Antes de ativar, escolha uma opção (o Radar também pergunta isso no primeiro login) — vale pra Gestão de
            Banca, Revisor de Mãos e Performance. Dá pra trocar depois: se você ampliar (por exemplo, de “só de agora”
            pra “tudo”), o Radar manda sozinho o que faltou; se reduzir, o que já entrou continua.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => choose(opt.value)}
                disabled={saving !== null}
                className="flex flex-col items-start gap-2 rounded-lg border border-hairline bg-surface p-4 text-left transition-colors hover:border-training/50 disabled:opacity-50"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {saving === opt.value ? <Loader2 size={14} className="animate-spin" /> : <opt.icon size={14} className="text-training" />}
                  {opt.title}
                </span>
                <span className="text-xs leading-relaxed text-muted">{opt.desc}</span>
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-xs text-negative">{error}</p>}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline bg-elevated px-4 py-2.5">
            <p className="text-xs text-muted">
              Importando: <span className="font-semibold text-ink">{SCOPE_OPTIONS.find((o) => o.value === scope)?.title}</span>
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setScope(null)} className="text-[11.5px] font-semibold text-muted hover:text-ink">
                Trocar
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                title="Zera as estatísticas do Performance pra começar do zero"
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-negative/80 hover:text-negative disabled:opacity-50"
              >
                {resetting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Resetar Performance
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-negative">{error}</p>}

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
              Depois de instalado, o Radar abre junto com o computador e fica perto do relógio, varrendo as pastas de
              hand history — PokerStars e GGPoker (PartyPoker, 888poker e ACR ainda em fase de teste). Só as mãos
              novas são enviadas, e cada mão importada alimenta automaticamente o Revisor e o Performance, sem precisar
              colar hand history na mão.
            </p>
          </div>

          {aparelho !== undefined && (
            <p className="flex items-center gap-2 px-1 text-xs text-muted">
              <span
                className={`inline-block size-2 rounded-full ${radarLigadoAgora(aparelho) ? "bg-positive" : "bg-muted/50"}`}
                aria-hidden
              />
              {aparelho === null
                ? "Nenhum Radar conectado a esta conta ainda."
                : radarLigadoAgora(aparelho)
                  ? `Seu Radar está ligado agora em “${aparelho.deviceName}”.`
                  : `Seu Radar (“${aparelho.deviceName}”) foi visto ${aparelho.lastSeenAt ? haQuanto(aparelho.lastSeenAt) : "há algum tempo"}. Se o computador está ligado, abra o Radar e confira se ele pede pra entrar de novo.`}
            </p>
          )}

          <div className="flex flex-col items-start gap-3 rounded-xl border border-hairline bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Windows 10/11, Mac com chip Apple (M1 ou mais novo) e Linux</p>
              <p className="mt-0.5 text-xs text-muted">
                Depois de instalar, entre com a mesma conta do PokerSync. No Windows, se aparecer “O Windows protegeu o
                computador”, clique em “Mais informações” → “Executar assim mesmo”.
              </p>
              <p className="mt-1.5 text-xs text-muted">
                Outros sistemas:{" "}
                {(Object.keys(DOWNLOADS) as Sistema[])
                  .filter((s) => s !== sistema)
                  .map((s, i) => (
                    <span key={s}>
                      {i > 0 && " · "}
                      <a href={`${DOWNLOAD_BASE}/${DOWNLOADS[s].arquivo}`} className="font-semibold text-ink/80 underline-offset-2 hover:underline">
                        {DOWNLOADS[s].rotulo}
                      </a>
                    </span>
                  ))}
              </p>
            </div>
            <a
              href={`${DOWNLOAD_BASE}/${DOWNLOADS[sistema].arquivo}`}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90"
            >
              <Download size={15} />
              Baixar para {DOWNLOADS[sistema].rotulo}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
