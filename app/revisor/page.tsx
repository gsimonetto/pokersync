"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RevisorFila } from "@/components/revisor/revisor-fila";
import { RevisorNovaMao } from "@/components/revisor/revisor-nova-mao";
import { RevisorDetalhe } from "@/components/revisor/revisor-detalhe";
import { RevisorSessao } from "@/components/revisor/revisor-sessao";
import { AderenciaRange } from "@/components/revisor/aderencia-range";

type Screen = "fila" | "nova" | "sessao" | "detalhe" | "aderencia";

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

  useEffect(() => {
    const shared = searchParams.get("shared");
    if (shared) {
      setSelectedReviewId(shared);
      setScreen("detalhe");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goFila() {
    setSelectedReviewId(null);
    setSelectedSessionId(null);
    setScreen("fila");
  }
  function goNova() {
    setScreen("nova");
  }
  function goSessao(sessionId: string) {
    setSelectedSessionId(sessionId);
    setScreen("sessao");
  }
  function goDetalhe(reviewId: string) {
    setSelectedReviewId(reviewId);
    setScreen("detalhe");
  }
  // Voltar do detalhe: se ha sessao ativa no contexto, volta pra ela;
  // senao (fluxo antigo de mao avulsa), volta direto pra fila.
  function backFromDetalhe() {
    if (selectedSessionId) {
      setSelectedReviewId(null);
      setScreen("sessao");
    } else {
      goFila();
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <AppHeader
        backHref={screen === "fila" || screen === "aderencia" ? "/modulos" : undefined}
        onBack={screen === "fila" || screen === "aderencia" ? undefined : (screen === "detalhe" ? backFromDetalhe : goFila)}
        icon={BookOpen}
        iconColor="var(--color-review)"
        title="Revisão de Mãos"
        right={
          (screen === "fila" || screen === "aderencia") && (
            <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
              <button
                onClick={goFila}
                className={`rounded-md px-3 py-1 text-xs font-medium ${screen === "fila" ? "bg-ink text-void" : "text-muted"}`}
              >
                Fila
              </button>
              <button
                onClick={() => setScreen("aderencia")}
                className={`rounded-md px-3 py-1 text-xs font-medium ${screen === "aderencia" ? "bg-ink text-void" : "text-muted"}`}
              >
                Aderência a Range
              </button>
            </div>
          )
        }
      />

      {screen === "fila" && <RevisorFila onNova={goNova} onOpen={goDetalhe} onOpenSession={goSessao} />}
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
    </main>
  );
}

export default function RevisorPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
          <p className="text-sm text-muted">Carregando…</p>
        </main>
      }
    >
      <RevisorPageInner />
    </Suspense>
  );
}
