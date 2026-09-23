"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Target } from "lucide-react";
import { RfiJamDrill } from "@/components/drill/rfi-jam-drill";
import { AppShell } from "@/components/app-shell";
import { F } from "@/lib/poker/drill-theme";
import { fetchSuggestionTarget, fetchTodayTrainingCount } from "@/lib/services/drill-service";
import { fetchMyPlanId } from "@/lib/services/plan-service";
import { fetchHasActiveTeamAccess } from "@/lib/services/team-service";
import { getModuleLimitFor } from "@/lib/plans/plans-data";

interface AppliedSuggestion {
  title: string;
  matchup: string;
  stackBb?: number;
}

// O AI Coach da tela inicial (Leak Finder) manda o jogador pra ca com
// /treino?suggestionId=<id> quando ele clica "Treinar esse leak". Ate agora essa tela ignorava o
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

// Stack pedido por quem linkou pra ca (hoje: dica de vazamento em torneio
// do AI Coach da tela inicial, que manda ?stack=15). So' aceita numero positivo -- lixo na URL vira "sem
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
  const suggestion = useSuggestedSpot();
  const stackFromUrl = useStackFromUrl();
  const { status: dailyLimit, filtersLocked, recordRound } = useDailyTrainingLimit();

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

        {/* O aviso "Seu maior leak na banca é X" que ficava aqui foi para o
            AI Coach da tela inicial: a dica de vazamento em torneio manda
            pra cá com ?stack=15, que o treino já lê (useStackFromUrl). */}

        <div style={{ flex: 1, minHeight: 0 }}>
          {dailyLimit === "locked" ? (
            <TrainingLimitCard />
          ) : dailyLimit === "ok" ? (
            <RfiJamDrill
              initialMatchup={suggestion?.matchup}
              initialStackBb={suggestion?.stackBb ?? stackFromUrl}
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
