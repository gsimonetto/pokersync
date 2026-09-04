"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Target, X } from "lucide-react";
import { RfiJamDrill } from "@/components/drill/rfi-jam-drill";
import { AppShell } from "@/components/app-shell";
import { F } from "@/lib/poker/drill-theme";
import { fetchSuggestionTarget, fetchTodayTrainingCount } from "@/lib/services/drill-service";
import { fetchSessions } from "@/lib/services/bankroll-service";
import { fetchMyPlanId } from "@/lib/services/plan-service";
import { fetchHasActiveTeamAccess } from "@/lib/services/team-service";
import { getModuleLimitFor } from "@/lib/plans/plans-data";
import { groupStats } from "@/lib/bankroll/calc";
import { fmtPct, TOURNEY_FORMATS } from "@/lib/bankroll/format";

// bb curto tipico de late-stage torneio -- e' o valor que a gente tenta
// achar entre os spots reais do RFI/Jam quando sugere foco em MTT/SNG/Spin.
const SHORT_STACK_BB = 15;

interface LeakTip {
  label: string;
  roi: number;
  n: number;
  suggestStackBb: number | null;
}

// Puxa o leak mais forte da Gestao de Banca (mesma logica de
// groupStats "format" que alimenta o painel de leaks em /banca) e
// transforma numa dica acionavel aqui no treino -- ponte entre "onde
// eu perco dinheiro" e "o que eu deveria praticar agora". So considera
// grupos com pelo menos 3 sessoes (amostra minima) e ROI negativo.
function useBankrollLeakTip(): LeakTip | null {
  const [tip, setTip] = useState<LeakTip | null>(null);
  useEffect(() => {
    let alive = true;
    fetchSessions()
      .then((sessions) => {
        if (!alive) return;
        const stats = groupStats(sessions, "format").filter((g) => g.n >= 3 && g.roi < 0);
        if (stats.length === 0) return;
        const worst = stats[0];
        setTip({
          label: worst.key,
          roi: worst.roi,
          n: worst.n,
          suggestStackBb: TOURNEY_FORMATS.has(worst.key) ? SHORT_STACK_BB : null,
        });
      })
      .catch(() => {
        // sem sessao/banca ainda -- treino funciona normal sem a dica
      });
    return () => {
      alive = false;
    };
  }, []);
  return tip;
}

interface AppliedSuggestion {
  title: string;
  matchup: string;
  stackBb?: number;
}

// O Revisor manda o jogador pra ca com /treino?suggestionId=<id> quando ele
// clica "Treinar" num leak recorrente. Ate agora essa tela ignorava o
// parametro e abria o drill padrao — o jogador clicava em "treinar esse
// leak" e caia num spot qualquer, sem relacao com o erro dele.
function useSuggestedSpot(): AppliedSuggestion | null {
  const suggestionId = useSearchParams().get("suggestionId");
  const [suggestion, setSuggestion] = useState<AppliedSuggestion | null>(null);
  useEffect(() => {
    if (!suggestionId) return;
    let alive = true;
    fetchSuggestionTarget(suggestionId)
      .then((res) => {
        if (!alive || !res) return;
        setSuggestion({ title: res.title, matchup: res.target.position, stackBb: res.target.stackBb });
      })
      .catch(() => {
        // sugestao invalida/inativa — treino abre normal, sem banner
      });
    return () => {
      alive = false;
    };
  }, [suggestionId]);
  return suggestion;
}

// Stack pedido por quem linkou pra ca (hoje: acao rapida do painel de leaks
// da Banca). So' aceita numero positivo -- lixo na URL vira "sem
// preferencia", nao erro de tela.
function useStackFromUrl(): number | undefined {
  const raw = useSearchParams().get("stack");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// Limite diario do Free (10 sessoes/dia, ver PLANS.free.modules.drill.limit
// em lib/plans/plans-data.ts). "loading" nunca libera nem trava por conta
// propria -- so' decide depois que plano + contagem de hoje chegam, pra nao
// deixar o jogador comecar um drill que o banco vai recusar salvar no final
// (trigger training_sessions_check_free_limit).
interface DailyTrainingLimit {
  status: "loading" | "ok" | "locked";
  // Free (limit.random em PLANS.free.modules.drill): sorteia sozinho e
  // nao deixa escolher o spot, mesmo antes de bater as 10/dia.
  filtersLocked: boolean;
  // Chamar a cada mao respondida -- ver comentario em recordRound abaixo.
  recordRound: () => void;
}

// So' busca plano/contagem UMA VEZ, no mount -- mas o limite precisa
// reagir a cada mao jogada NA MESMA sessao, sem esperar reload de
// pagina, senao o jogador passa de 10 sem nunca ver a tela de bloqueio
// (bug reportado: contagem so' era checada uma vez ao abrir /treino).
// `count` local comeca no valor real do banco e incrementa a cada
// registerTraining disparado pelo RfiJamDrill (ver onRoundComplete),
// sem precisar reconsultar o banco a cada mao.
function useDailyTrainingLimit(): DailyTrainingLimit {
  const [status, setStatus] = useState<"loading" | "ok" | "locked">("loading");
  const [filtersLocked, setFiltersLocked] = useState(false);
  const limitAmountRef = useRef<number | null>(null);
  const countRef = useRef(0);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchMyPlanId(), fetchTodayTrainingCount(), fetchHasActiveTeamAccess()])
      .then(([plan, count, hasTeamAccess]) => {
        if (!alive) return;
        // Membro ativo de time usa o acesso do time -- sem limite, sem
        // sorteio forcado, mesmo que o proprio plano ainda diga 'free'.
        const limit = getModuleLimitFor(plan, "drill", hasTeamAccess);
        limitAmountRef.current = limit?.amount ?? null;
        countRef.current = count;
        setFiltersLocked(Boolean(limit?.random));
        setStatus(limit && count >= limit.amount ? "locked" : "ok");
      })
      .catch(() => {
        // erro ao checar plano/contagem nao pode travar quem tem direito
        if (alive) setStatus("ok");
      });
    return () => {
      alive = false;
    };
  }, []);

  const recordRound = useCallback(() => {
    countRef.current += 1;
    const limit = limitAmountRef.current;
    if (limit !== null && countRef.current >= limit) setStatus("locked");
  }, []);

  return { status, filtersLocked, recordRound };
}

function TrainingLimitCard() {
  return (
    <div className="fade-in-up flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="grid size-12 place-items-center rounded-full border" style={{ borderColor: "rgba(224,178,76,0.4)", background: "rgba(224,178,76,0.1)" }}>
        <Lock size={20} className="icon-glow" style={{ color: "#E0B24C" }} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-ink">Limite diário do Free atingido</h2>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
          Você já treinou suas 10 sessões de hoje. Volte amanhã ou faça upgrade pra treinar sem limite, escolhendo o
          próprio spot em vez de esperar o sorteio do dia.
        </p>
      </div>
      <Link
        href="/planos"
        className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90"
      >
        Ver planos
      </Link>
    </div>
  );
}

function TreinoShell() {
  // Altura disponível medida, não chutada. O card usava
  // `calc(100vh - 32px)`, ignorando o header global do app que fica
  // acima desta página — o card ficava mais alto que o espaço real e o
  // rodapé (barra de apostas) caía fora da tela (bug reportado: "cadê o
  // botão de aposta? sumiu"). Medindo o offset real do topo do
  // container, isso funciona com qualquer header, sem hardcode.
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  // Mesmo offset medido, exposto como CSS var pro breakpoint mobile
  // (ver treino-responsive-styles.tsx): la a altura precisa sair de
  // 100dvh -- pra acompanhar a barra de endereco que abre/fecha -- mas
  // descontando o que fica acima do card, senao a tela estoura pra
  // baixo e a barra de apostas cai fora da dobra.
  const [topOffset, setTopOffset] = useState(0);
  const leakTip = useBankrollLeakTip();
  const suggestion = useSuggestedSpot();
  const stackFromUrl = useStackFromUrl();
  const { status: dailyLimit, filtersLocked, recordRound } = useDailyTrainingLimit();
  const [tipDismissed, setTipDismissed] = useState(false);
  const [appliedStackBb, setAppliedStackBb] = useState<number | undefined>(undefined);

  // py-10 (2.5rem = 40px) do container padrao entra embaixo tambem —
  // sem descontar isso aqui o card calculava altura ate' a base da
  // viewport e o padding inferior nunca aparecia (ficava cortado).
  const BOTTOM_PADDING_PX = 40;

  useEffect(() => {
    function measure() {
      const el = pageRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setTopOffset(top);
      setAvailableHeight(Math.max(320, window.innerHeight - top - BOTTOM_PADDING_PX));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    // Margem padrao do app (px-6 py-10, full-width) — consistencia entre
    // todo modulo, entao entra aqui tambem.
    <AppShell>
    <main className="w-full px-6 py-10">
    <div
      ref={pageRef}
      className="ps-treino-page"
      style={{
        fontFamily: F,
        height: availableHeight ? `${availableHeight}px` : "100vh",
        background: "transparent",
        padding: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        ["--ps-treino-top" as string]: `${topOffset}px`,
      }}
    >
      <div
        className="ps-treino-card"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "100%",
          margin: "0 auto",
          // Antes #050505 -- praticamente identico ao void (#000000) do
          // resto do app, a margem existia no layout mas era invisivel a
          // olho nu por falta de contraste. bg-surface (#111111) e' o
          // mesmo tom que todo outro painel do produto usa contra o void.
          background: "#111111",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 14,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {suggestion && (
          <div
            className="fade-in-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(168,85,247,0.08)",
              border: "1px solid rgba(168,85,247,0.3)",
              fontFamily: F,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <Target size={14} style={{ flexShrink: 0, color: "#A855F7" }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              Treinando o leak que o Revisor apontou: <strong>{suggestion.title}</strong>.
            </span>
          </div>
        )}

        {!suggestion && leakTip && !tipDismissed && (
          <div
            className="fade-in-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              fontFamily: F,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              Seu maior leak na banca é <strong>{leakTip.label}</strong> ({fmtPct(leakTip.roi)} ROI,{" "}
              {leakTip.n} sessões).
              {leakTip.suggestStackBb != null &&
                (appliedStackBb === leakTip.suggestStackBb
                  ? " Treino ajustado pra stack curto."
                  : " Bora praticar stack curto?")}
            </span>
            {leakTip.suggestStackBb != null && appliedStackBb !== leakTip.suggestStackBb && (
              <button
                onClick={() => setAppliedStackBb(leakTip.suggestStackBb!)}
                style={{
                  flexShrink: 0,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "#F59E0B",
                  color: "#050505",
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  border: "none",
                }}
              >
                Focar treino
              </button>
            )}
            <button
              onClick={() => setTipDismissed(true)}
              aria-label="Dispensar"
              style={{ flexShrink: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.5)", background: "none", border: "none" }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
          {dailyLimit === "locked" ? (
            <TrainingLimitCard />
          ) : dailyLimit === "ok" ? (
            <RfiJamDrill
              initialMatchup={suggestion?.matchup}
              initialStackBb={suggestion?.stackBb ?? appliedStackBb ?? stackFromUrl}
              filtersLocked={filtersLocked}
              onRoundComplete={recordRound}
            />
          ) : null}
        </div>
      </div>
    </div>
    </main>
    </AppShell>
  );
}

export default function TreinoPage() {
  return (
    <Suspense fallback={null}>
      <TreinoShell />
    </Suspense>
  );
}
