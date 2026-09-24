"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bookmark, ListChecks, Plus, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PainelVisual } from "@/components/dashboard/kit";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { RadarModuleMenu } from "@/components/radar/radar-module-menu";
import { resetRevisorRadarImports } from "@/lib/services/hand-review-service";
import { BOTAO_OURO } from "@/components/banca/util";
import { RevisorFila } from "@/components/revisor/revisor-fila";
import { RevisorNovaMao } from "@/components/revisor/revisor-nova-mao";
import { RevisorDetalhe } from "@/components/revisor/revisor-detalhe";
import { RevisorSessao } from "@/components/revisor/revisor-sessao";
import { RevisorSpotsSalvos } from "@/components/revisor/revisor-spots-salvos";
import { RevisorFiltrosAvancados } from "@/components/revisor/revisor-filtros-avancados";

type Screen = "fila" | "salvos" | "filtros" | "filtro-replay" | "nova" | "sessao" | "detalhe";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [screen, setScreen] = useState<Screen>(() => (searchParams.get("hands") ? "filtro-replay" : "fila"));
  // Deep-link "?hands=id1,id2&label=..." — vem da Performance (posição,
  // decisões, c-bet, matriz de mãos, ruas): abre direto a MESA com a lista
  // dessas mãos pra ver uma a uma (pedido explícito: "quero ver todas as
  // jogadas do UTG" não pode cair no "Analisar mão").
  const handsParam = searchParams.get("hands");
  const filterHandIds = handsParam ? handsParam.split(",").filter(Boolean) : undefined;
  const filterLabel = searchParams.get("label") ?? undefined;
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  // Resultado dos Filtros avancados que o jogador clicou pra ver na mesa
  // (replayer) -- guardado enquanto ele navega pro "Analisar mao" e volta,
  // pra reabrir o mesmo conjunto de maos filtradas em vez de voltar pro
  // formulario de filtro.
  const [filtroReviewIds, setFiltroReviewIds] = useState<string[]>(filterHandIds ?? []);
  // De onde veio a lista aberta na mesa: Filtros avançados, Salvos ou um
  // link com filtro (Performance) -- decide o título e pra onde "voltar".
  const [filtroOrigem, setFiltroOrigem] = useState<"filtros" | "salvos" | "link">(filterHandIds?.length ? "link" : "filtros");
  // De onde "detalhe" foi aberto (fila normal, salvos ou replayer dos
  // filtros avancados) — sem isso, voltar de um spot salvo/filtrado caia
  // sempre na fila em vez de voltar pra onde o usuario realmente veio.
  const [detalheOrigin, setDetalheOrigin] = useState<"fila" | "salvos" | "filtro-replay">("fila");
  // Muda quando o menu do Radar (agora no cabecalho da pagina) troca o
  // corte ou apaga as importacoes -- remonta a Fila, que relê o corte e as
  // listas do zero.
  const [filaVersao, setFilaVersao] = useState(0);

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
  function goFiltros() {
    setSelectedReviewId(null);
    setSelectedSessionId(null);
    setScreen("filtros");
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
  // Abre o replayer (mesa + lista, igual a uma sessao) com o resultado do
  // filtro -- pedido explicito: clicar numa mao filtrada deve mostrar ela
  // na mesa de verdade, nao ir direto pro fluxo de "Analisar mao".
  function goFiltroReplay(reviewIds: string[], selectedId: string) {
    setFiltroOrigem("filtros");
    setFiltroReviewIds(reviewIds);
    setSelectedReviewId(selectedId);
    setScreen("filtro-replay");
  }
  // Salvos: mesma mesa com a lista dos spots salvos, a partir do clicado.
  function goSalvosNaMesa(selectedId: string, reviewIds: string[]) {
    setFiltroOrigem("salvos");
    setFiltroReviewIds(reviewIds);
    setSelectedReviewId(selectedId);
    setScreen("filtro-replay");
  }
  // Voltar da mesa filtrada: pra lista de onde ela veio. Do link com
  // filtro (Performance) volta pra fila, limpando o filtro da URL.
  function voltarDaMesaFiltrada() {
    if (filtroOrigem === "salvos") goSalvos();
    else if (filtroOrigem === "link") {
      router.replace("/revisor");
      goFila();
    } else goFiltros();
  }
  function goDetalheFromFiltroReplay(reviewId: string) {
    setDetalheOrigin("filtro-replay");
    setSelectedReviewId(reviewId);
    setScreen("detalhe");
  }
  // Voltar do detalhe: se ha sessao ativa no contexto, volta pra ela;
  // senao volta pra onde a mao foi aberta (fila normal, biblioteca de
  // salvos ou replayer dos filtros avancados).
  function backFromDetalhe() {
    if (selectedSessionId) {
      setSelectedReviewId(null);
      setScreen("sessao");
    } else if (detalheOrigin === "salvos") {
      goSalvos();
    } else if (detalheOrigin === "filtro-replay") {
      setScreen("filtro-replay");
    } else {
      goFila();
    }
  }

  const emLista = screen === "fila" || screen === "salvos" || screen === "filtros";

  return (
    <AppShell>
    <PainelVisual value="vidro">
    <main className="perf w-full px-4 pb-6 pt-6 text-ink md:px-6">
      <PerfEstilos />
      {/* Cabecalho + abas so' nas telas de lista -- na mesa (sessao) e no
          "Analisar mao" cada pixel de altura vai pra mesa/formulario. */}
      {emLista && (
        <>
          <header className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Revisor de Mãos</h1>
              <p className="mt-1 text-[12.5px] text-muted">
                Reveja seus torneios mão a mão, na mesa. Anote o que aprendeu e treine o spot depois.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RadarModuleMenu
                module="revisor"
                moduleLabel="o Revisor de Mãos"
                onScopeChange={() => setFilaVersao((v) => v + 1)}
                onReset={async () => {
                  await resetRevisorRadarImports();
                  setFilaVersao((v) => v + 1);
                }}
              />
              <button type="button" onClick={goNova} className={`${BOTAO_OURO} whitespace-nowrap`}>
                <Plus size={16} strokeWidth={2.2} /> Nova mão
              </button>
            </div>
          </header>
          <div className="sticky top-0 z-30 -mx-4 mb-3.5 border-b border-white/[0.06] bg-black/70 px-4 pt-1 backdrop-blur-xl md:-mx-6 md:px-6">
            <AbasAnimadas
              value={screen as "fila" | "salvos" | "filtros"}
              onChange={(s) => (s === "fila" ? goFila() : s === "salvos" ? goSalvos() : goFiltros())}
              rotulo="Seções do Revisor de Mãos"
              options={[
                { value: "fila", label: "Fila", icon: ListChecks },
                { value: "salvos", label: "Salvos", icon: Bookmark },
                { value: "filtros", label: "Filtros avançados", icon: SlidersHorizontal },
              ]}
            />
          </div>
        </>
      )}
      <div>

        {/* "sessao" saiu daqui (pedido explicito: "botão de voltar
            aparecer ao lado do nome do torneio, tirando de lá de cima,
            pode subir mais o layout pra preencher aquele espaço") -- o
            botao de voltar da sessao agora vive dentro do header da
            propria mesa (RevisorHandTable), ao lado do chip do torneio,
            no lugar dessa linha solta que so' empurrava tudo pra baixo. */}
        {(screen === "nova" || screen === "detalhe") && (
          <button
            onClick={screen === "detalhe" ? backFromDetalhe : goFila}
            aria-label="Voltar"
            className="mb-4 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-muted transition-colors hover:border-white/20 hover:text-ink"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {screen === "fila" && (
          <RevisorFila key={filaVersao} onNova={goNova} onOpen={goDetalhe} onOpenSession={goSessao} />
        )}
        {screen === "salvos" && <RevisorSpotsSalvos onOpen={goDetalheFromSalvos} onOpenNaMesa={goSalvosNaMesa} />}
        {screen === "filtros" && <RevisorFiltrosAvancados onOpen={goFiltroReplay} />}
        {screen === "filtro-replay" && filtroReviewIds.length > 0 && (
          <RevisorSessao
            reviewIds={filtroReviewIds}
            title={filtroOrigem === "salvos" ? "Salvos" : filtroOrigem === "link" ? filterLabel ?? "Mãos filtradas" : "Filtros avançados"}
            initialSelectedId={selectedReviewId ?? undefined}
            onOpenHand={goDetalheFromFiltroReplay}
            onBack={voltarDaMesaFiltrada}
          />
        )}
        {screen === "nova" && (
          <RevisorNovaMao onSaved={goFila} onSavedAndReview={goDetalhe} onSavedToSession={goSessao} onCancel={goFila} />
        )}
        {screen === "sessao" && selectedSessionId && (
          <RevisorSessao sessionId={selectedSessionId} onOpenHand={goDetalhe} onBack={goFila} />
        )}
        {screen === "detalhe" && selectedReviewId && (
          <RevisorDetalhe reviewId={selectedReviewId} onBack={backFromDetalhe} />
        )}
      </div>
    </main>
    </PainelVisual>
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
