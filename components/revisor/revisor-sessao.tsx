"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Target, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RevisorHandTable } from "./revisor-hand-table";
import { HalfCard } from "@/components/drill/card";
import { updateSessionBounty, type HandSession } from "@/lib/services/hand-session-service";
import { parseHand, HandParseError, type ParsedHand } from "@/lib/poker/hand-parser";
import { F, T } from "@/lib/poker/drill-theme";

// Tela nova (2026-08): abre uma sessao/torneio e mostra o master-detail —
// coluna esquerda com lista de MAOS daquela sessao (clicaveis), coluna
// direita com a mesa grande da mao selecionada. Pedido explicito:
// "mesa mais em evidencia ao lado direito, as acoes do lado esquerdo em
// lista daquele torneio". "Acoes" = maos, confirmado.
//
// Nao substitui RevisorDetalhe (que tem perguntas guiadas, self-eval por
// street, learning note, drill suggestion). Clicar em "Analisar mao" leva
// pra la; essa tela e' pra NAVEGAR/consultar mesas do torneio rapido.
//
// Layout (2026-08 v2, pedido explicito):
// - Lista mais estreita (220px, era 260px) / mesa ganha o espaco restante.
// - Coluna da lista tem scroll PROPRIO — a mesa nao some quando o usuario
//   rola a lista pra ver maos mais antigas. Isso exige o grid ter altura
//   travada (nao so minHeight) e cada coluna gerenciar seu proprio overflow.
const GRID_HEIGHT = "calc(100vh - 240px)"; // aproximado — depende do header
// fixo da pagina (fora deste componente). Se ainda sobrar scroll da
// pagina inteira ao abrir a tela, o ajuste fino de altura do
// header/breadcrumb fica no componente pai (nao presente neste arquivo).

interface HandInListing {
  id: string;
  title: string | null;
  hand_history: string | null;
  // heroCards/heroPosition/heroName/streets so existem quando parsed_data.
  // kind === "parsed" (import via hand history). Usado so pra preview na
  // lista — nunca reparseia o hand_history inteiro so pra isso (custo
  // desnecessario pra 147+ maos). streets/heroName servem so pra derivar
  // "hero entrou na mao?" — nao guardamos a acao exata, so o booleano.
  parsed_data: {
    kind?: string;
    heroCards?: string[];
    heroPosition?: string;
    heroName?: string;
    streets?: { actions: { player: string; action: string }[] }[];
  } | null;
  created_at: string;
  status: string;
}

function HeroCardsPreview({ cards }: { cards: string[] }) {
  return (
    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
      {cards.map((c, i) => (
        <HalfCard key={i} card={c} />
      ))}
    </div>
  );
}

// "Hero entrou na mao?" — pedido explicito: "nao quero saber ela exata,
// so precisamos saber se o hero entrou na mao ou nao". Entrou = fez
// alguma acao voluntaria alem dos blinds/ante obrigatorios (call, raise,
// bet, all-in, ou ate um check em rua postflop conta como "seguiu
// jogando"). So "posts" (blind/ante) e "folds" como unica acao = nao
// entrou (largou a mao assim que teve que decidir).
function didHeroEnterHand(
  heroName: string | undefined,
  streets: { actions: { player: string; action: string }[] }[] | undefined
): boolean | null {
  if (!heroName || !streets) return null;
  const heroActions = streets.flatMap((s) => s.actions).filter((a) => a.player === heroName);
  const decisions = heroActions.filter((a) => a.action !== "posts");
  if (decisions.length === 0) return null; // sem dados suficientes pra afirmar
  return decisions.some((a) => a.action !== "folds");
}

export function RevisorSessao({
  sessionId,
  onOpenHand,
}: {
  sessionId: string;
  onOpenHand: (reviewId: string) => void;
}) {
  const [session, setSession] = useState<HandSession | null>(null);
  const [hands, setHands] = useState<HandInListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingBounty, setEditingBounty] = useState(false);
  const [bountyInput, setBountyInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const [{ data: s, error: sErr }, { data: hs, error: hErr }] = await Promise.all([
          supabase.from("hand_sessions").select("*").eq("id", sessionId).single(),
          supabase
            .from("hand_reviews")
            .select("id, title, hand_history, parsed_data, created_at, status")
            .eq("hand_session_id", sessionId)
            .order("created_at", { ascending: true }),
        ]);
        if (cancelled) return;
        if (sErr) throw sErr;
        if (hErr) throw hErr;
        setSession(s as HandSession);
        setHands((hs as HandInListing[]) ?? []);
        setSelectedId(hs && hs.length > 0 ? (hs[0] as HandInListing).id : null);
        setBountyInput(s?.bounty_current != null ? String(s.bounty_current) : "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar a sessão.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Parse da mao selecionada — feito lazy (so quando o usuario seleciona).
  // Cacheia por id pra nao reparsear ao trocar de volta.
  const [parsedCache, setParsedCache] = useState<Record<string, ParsedHand | null>>({});
  const selectedHand = useMemo(() => hands.find((h) => h.id === selectedId) ?? null, [hands, selectedId]);
  const parsedForSelected: ParsedHand | null | undefined = selectedId ? parsedCache[selectedId] : null;

  useEffect(() => {
    if (!selectedHand || selectedId == null) return;
    if (selectedId in parsedCache) return; // ja resolvido
    let parsed: ParsedHand | null = null;
    // Se ja veio parseado do import (parsed_data.kind === "parsed"), usa
    // direto — evita reparsear texto. Fluxo de colagem manual, precisa
    // parsear do hand_history bruto.
    if (selectedHand.parsed_data && (selectedHand.parsed_data as { kind?: string }).kind === "parsed") {
      parsed = selectedHand.parsed_data as unknown as ParsedHand;
    } else if (selectedHand.hand_history) {
      try {
        parsed = parseHand(selectedHand.hand_history);
      } catch (e) {
        if (!(e instanceof HandParseError)) console.warn("[RevisorSessao] parse falhou:", e);
        parsed = null;
      }
    }
    setParsedCache((prev) => ({ ...prev, [selectedId]: parsed }));
  }, [selectedHand, selectedId, parsedCache]);

  // Avança pra próxima mão da fila quando o replay da mão atual falha
  // (ex: checagem de pote do projector) — pedido explicito (2026-08):
  // "ao finalizar de ver a ação daquela mão... preciso que vá para a
  // próxima mão ao invés de sair ou aparecer essa info", confirmado pra
  // valer "independente do que causou o erro". Se já é a última mão da
  // lista, não tem pra onde avançar — mantém a seleção (RevisorHandTable
  // mostra o indicador de transição, mas sem próxima mão real ele fica
  // parado; aceitável, é o fim da fila).
  const goToNextHand = useCallback(() => {
    setSelectedId((current) => {
      const idx = hands.findIndex((h) => h.id === current);
      if (idx === -1 || idx >= hands.length - 1) return current;
      return hands[idx + 1].id;
    });
  }, [hands]);

  const saveBounty = useCallback(async () => {
    if (!session) return;
    const val = bountyInput.trim() ? Number(bountyInput.replace(",", ".")) : null;
    if (val != null && !Number.isFinite(val)) return;
    try {
      await updateSessionBounty(session.id, val);
      setSession({ ...session, bounty_current: val });
      setEditingBounty(false);
    } catch (e) {
      console.error("[RevisorSessao] bounty save failed:", e);
    }
  }, [session, bountyInput]);

  if (loading) {
    return (
      <div style={{ fontFamily: F, padding: 24, display: "flex", justifyContent: "center", color: "rgba(255,255,255,0.4)" }}>
        <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ fontFamily: F, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <AlertTriangle size={22} color={T.bad} />
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{error ?? "Sessão não encontrada."}</p>
      </div>
    );
  }

  const isTournament = session.kind === "tournament";
  const showsBounty = isTournament && (session.format_type === "pko" || session.format_type === "mystery");

  return (
    <div style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Cabecalho da sessao — nome, tipo, buy-in, bounty (se PKO/Mystery) */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "14px 16px", borderRadius: 14,
          background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session.label}
          </h2>
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            {isTournament && session.format_type && (
              <span style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>
                {session.format_type === "pko" ? "PKO" : session.format_type === "mystery" ? "Mystery Bounty" : "Regular"}
              </span>
            )}
            {!isTournament && session.stakes && <span>{session.stakes}</span>}
            <span>· {hands.length} mão{hands.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        {showsBounty && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Ícone trocado de cifrão/troféu pra alvo (Target) — pedido
                explicito: "quero que apareça o icone de um alvo, que é
                de fato o bounty nas mesas". Alvo e' o simbolo universal
                de bounty em torneios PKO/Mystery, mais reconhecivel que
                cifrao pra esse contexto especifico. */}
            <Target size={14} color="#FBBF24" />
            {editingBounty ? (
              <input
                type="number"
                step="0.01"
                value={bountyInput}
                onChange={(e) => setBountyInput(e.target.value)}
                onBlur={saveBounty}
                onKeyDown={(e) => e.key === "Enter" && saveBounty()}
                autoFocus
                style={{
                  background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.2)",
                  color: "#FFFFFF", borderRadius: 8, padding: "4px 8px",
                  fontSize: 13, fontFamily: F, width: 80, outline: "none",
                }}
              />
            ) : (
              <button
                onClick={() => setEditingBounty(true)}
                style={{
                  all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                  fontSize: 13, fontWeight: 500, color: "#FBBF24",
                }}
                title="Editar bounty atual"
              >
                <span>{session.bounty_current != null ? `$${session.bounty_current}` : "—"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Master-detail: coluna esquerda com maos, coluna direita com mesa.
          Altura TRAVADA (nao so minHeight) — pedido explicito: "a mesa
          some quando desce a listagem". Com altura fixa + overflow proprio
          em cada coluna, a lista rola por dentro e a mesa nunca sai da
          tela. Colunas 220px / 1fr (era 260px) — mesa ganha mais espaco,
          "precisa ser maior, ocupar mais espaço". */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, height: GRID_HEIGHT, minHeight: 480 }}>
        <aside
          style={{
            borderRadius: 14,
            background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
              Mãos ({hands.length})
            </span>
          </div>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {hands.length === 0 && (
              <p style={{ padding: 14, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Nenhuma mão nessa sessão ainda.</p>
            )}
            {hands.map((h, i) => {
              const active = selectedId === h.id;
              const heroCards = h.parsed_data?.heroCards;
              const heroPosition = h.parsed_data?.heroPosition;
              const heroEntered = didHeroEnterHand(h.parsed_data?.heroName, h.parsed_data?.streets);
              return (
                <button
                  key={h.id}
                  onClick={() => setSelectedId(h.id)}
                  style={{
                    all: "unset", cursor: "pointer", display: "block", width: "100%",
                    padding: "10px 14px",
                    borderBottom: i < hands.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    background: active ? "rgba(168,85,247,0.12)" : "transparent",
                    borderLeft: active ? "2px solid #A855F7" : "2px solid transparent",
                  }}
                >
                  {/* alignItems "flex-end" (era "center") — pedido
                      explicito: "deixe as imagens grudadas na parte de
                      baixo do card". */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
                    {heroCards && heroCards.length > 0 && <HeroCardsPreview cards={heroCards} />}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Numero da mao (sequencial na sessao) — pedido
                          explicito: "quero nesta tela tambem qual o
                          numero da mao... isso e bom para filtros
                          depois". Titulo (formato/stakes) e data
                          continuam removidos. */}
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: active ? "#FFFFFF" : "rgba(255,255,255,0.75)" }}>
                        Mão {i + 1}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        {h.status === "concluida" && <span style={{ color: T.ok }}>✓</span>}
                        {heroPosition && <span>{heroPosition}</span>}
                        {heroEntered !== null && (
                          <span
                            title={heroEntered ? "Hero entrou na mão (fez alguma ação)" : "Hero foldou assim que teve que decidir"}
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: heroEntered ? "#34D399" : "rgba(255,255,255,0.25)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    </div>
                    {active && <ChevronRight size={12} color="rgba(255,255,255,0.4)" />}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* overflow "auto" (era "hidden") — pedido explicito: "botoes de
            acao de apostas desaparecidos". Quando mesa+controles ficam
            mais altos que o espaco disponivel nessa coluna, "hidden"
            cortava os botoes (que ficam embaixo da mesa) junto com o
            excesso. "auto" so cria uma rolagem interna nesse caso raro,
            nunca esconde os controles. */}
        <section style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
          {selectedId && parsedForSelected ? (
            <RevisorHandTable parsedHand={parsedForSelected} onFatalError={goToNextHand} />
          ) : selectedId && parsedForSelected === null ? (
            <div
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, padding: 40, borderRadius: 14,
                background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
                border: "1px solid rgba(255,255,255,0.08)", minHeight: 400,
              }}
            >
              <AlertTriangle size={22} color={T.warn} />
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12.5, textAlign: "center", maxWidth: 380 }}>
                Essa mão não tem hand history parseável — abra em "Analisar mão" pra revisar sem a mesa visual.
              </p>
              <button
                onClick={() => selectedId && onOpenHand(selectedId)}
                style={{ background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontWeight: 500, fontSize: 12.5 }}
              >
                Abrir análise
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", padding: 40,
                borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
                border: "1px solid rgba(255,255,255,0.08)", minHeight: 400,
                color: "rgba(255,255,255,0.4)", fontSize: 12.5,
              }}
            >
              Selecione uma mão na lista.
            </div>
          )}

          {selectedId && parsedForSelected && (
            <button
              onClick={() => onOpenHand(selectedId)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
                color: "#C4B5FD", borderRadius: 10, padding: "10px 16px",
                fontFamily: F, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              Analisar essa mão em detalhe
            </button>
          )}
        </section>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
