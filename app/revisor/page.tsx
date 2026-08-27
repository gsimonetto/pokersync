"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Bookmark, ListChecks, PieChart } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TabNav } from "@/components/ui/tab-nav";
import { RevisorFila } from "@/components/revisor/revisor-fila";
import { RevisorNovaMao } from "@/components/revisor/revisor-nova-mao";
import { RevisorDetalhe } from "@/components/revisor/revisor-detalhe";
import { RevisorSessao } from "@/components/revisor/revisor-sessao";
import { AderenciaRange } from "@/components/revisor/aderencia-range";
import { RevisorSpotsSalvos } from "@/components/revisor/revisor-spots-salvos";

type Screen = "fila" | "salvos" | "nova" | "sessao" | "detalhe" | "aderencia";

// Navegacao interna do Revisor de Maos (2026-08 v2): agora inclui a tela
// "sessao" (master-detail de torneio/cash). Fluxo esperado:
//   fila -> clica em sessao -> sessao (lista de maos + mesa lateral)
//     -> clica em "Analisar essa mao" -> detalhe (perguntas guiadas etc.)
//   fila -> clica em "Nova mao" -> nova (modal de tipo/bounty) -> ...
//
// Voltar do detalhe volta pra sessao de origem (nao pra fila) — a gente
// guarda o sessionId enquanto navega pra manter contexto.
//
// Deep-link ?shared=<reviewId> (2026-08): abre direto no "detalhe" —
// vem do clique na notificacao de "mao compartilhada" (coach recebendo
// mao de um jogador do time). O coach nao tem contexto de sessao dessa
// mao (e' do torneio de outra pessoa), entao "voltar" cai na propria
// fila do coach, nao numa sessao — comportamento aceitavel pro caso de
// uso (o coach normalmente so chega aqui via notificacao mesmo).

function RevisorPageInner() {
  const searchParams = useSearchParams();
  const [screen, setScreen] = useState<Screen>("fila");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // De onde "detalhe" foi aberto (fila normal ou biblioteca de salvos) —
  // sem isso, voltar de um spot salvo caia sempre na fila em vez de
  // voltar pra biblioteca de onde o usuario realmente veio.
  const [detalheOrigin, setDetalheOrigin] = useState<"fila" | "salvos">("fila");

  useEffect(() => {
    const shared = searchParams.get("shared");
    if (shared) {
      setSelectedReviewId(shared);
      setScreen("detalhe");
      return;
    }
    // Acao rapida do painel de leaks da Banca: "vi onde perco, quero
    // registrar a mao agora" cai direto na captura, sem passar pela fila.
    if (searchParams.get("nova")) setScreen("nova");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goFila() {
    setSelectedReviewId(null);
    setSelectedSessionId(null);
    setScreen("fila");
  }
  function goSalvos() {
    setSelectedReviewId(null);
    setSelectedSessionId(null);
    setScreen("salvos");
  }
  function goNova() {
    setScreen("nova");
  }
  function goSessao(sessionId: string) {
    setSelectedSessionId(sessionId);
    setScreen("sessao");
  }
  function goDetalhe(reviewId: string) {
    setDetalheOrigin("fila");
    setSelectedReviewId(reviewId);
    setScreen("detalhe");
  }
  function goDetalheFromSalvos(reviewId: string) {
    setDetalheOrigin("salvos");
    setSelectedReviewId(reviewId);
    setScreen("detalhe");
  }
  // Voltar do detalhe: se ha sessao ativa no contexto, volta pra ela;
  // senao volta pra onde a mao foi aberta (fila normal ou biblioteca de
  // salvos).
  function backFromDetalhe() {
    if (selectedSessionId) {
      setSelectedReviewId(null);
      setScreen("sessao");
    } else if (detalheOrigin === "salvos") {
      goSalvos();
    } else {
      goFila();
    }
  }

  return (
    <AppShell>
    <main className="w-full px-6 py-10 text-ink">
      {/* Container externo unico, igual ao Funil e ao Painel do Time:
          nav (alternador Fila/Salvos/Aderencia ou botao de voltar) e
          conteudo moram dentro da MESMA caixa, em vez de boiar soltos
          contra o fundo. Sem AppHeader (barra sticky) de proposito. */}
      <div className="rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
        {(screen === "fila" || screen === "salvos" || screen === "aderencia") && (
          <TabNav
            className="mb-4"
            value={screen}
            onChange={(s) => (s === "fila" ? goFila() : s === "salvos" ? goSalvos() : setScreen("aderencia"))}
            options={[
              { value: "fila", label: "Fila", icon: ListChecks },
              { value: "salvos", label: "Salvos", icon: Bookmark },
              { value: "aderencia", label: "Aderência a Range", icon: PieChart },
            ]}
          />
        )}
        {(screen === "nova" || screen === "sessao" || screen === "detalhe") && (
          <button
            onClick={screen === "detalhe" ? backFromDetalhe : goFila}
            aria-label="Voltar"
            className="mb-4 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {screen === "fila" && <RevisorFila onNova={goNova} onOpen={goDetalhe} onOpenSession={goSessao} />}
        {screen === "salvos" && <RevisorSpotsSalvos onOpen={goDetalheFromSalvos} />}
        {screen === "aderencia" && <AderenciaRange />}
        {screen === "nova" && (
          <RevisorNovaMao onSaved={goFila} onSavedAndReview={goDetalhe} onSavedToSession={goSessao} onCancel={goFila} />
        )}
        {screen === "sessao" && selectedSessionId && (
          <RevisorSessao sessionId={selectedSessionId} onOpenHand={goDetalhe} />
        )}
        {screen === "detalhe" && selectedReviewId && (
          <RevisorDetalhe reviewId={selectedReviewId} onBack={backFromDetalhe} />
        )}
      </div>
    </main>
    </AppShell>
  );
}

export default function RevisorPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main className="w-full px-6 py-10 text-ink">
            <p className="text-sm text-muted">Carregando…</p>
          </main>
        </AppShell>
      }
    >
      <RevisorPageInner />
    </Suspense>
  );
}
