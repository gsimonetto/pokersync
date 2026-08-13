"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, ChevronRight, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RevisorHandTable } from "./revisor-hand-table";
import { HalfCard } from "@/components/drill/card";
import type { HandSession } from "@/lib/services/hand-session-service";
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
//
// Cabecalho da sessao REMOVIDO (2026-08 v3, pedido explicito): "tirar
// essa barra, esta mais atrapalhando do que ajudando". Antes havia um
// bloco no topo com nome/formato/bounty da sessao — a lista de maos (na
// coluna esquerda) ja identifica a sessao pelo contexto de navegacao, o
// bloco extra so ocupava espaco vertical sem ajudar. Edicao de bounty
// (updateSessionBounty) removida junto — se precisar editar bounty de
// novo, precisa de um lugar novo pra isso (ex: dentro da lista ou um
// menu de opcoes da sessao).
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
    // Presente quando kind === "parsed" (import de hand history) — usado
    // so pra achar o stack inicial do heroi na busca da lista (nao
    // reparseia a mao inteira so pra isso, ja vem no JSON salvo).
    seats?: { playerName: string; startingChips: number; isHero: boolean }[];
  } | null;
  created_at: string;
  status: string;
  // Marcadores da mao (pedido explicito: filtrar maos marcadas na lista).
  hand_review_tag_links?: { tag_id: string; hand_review_tags: { id: string; label: string }[] | null }[];
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyWithAction, setOnlyWithAction] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

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
            .select("id, title, hand_history, parsed_data, created_at, status, hand_review_tag_links ( tag_id, hand_review_tags ( id, label ) )")
            .eq("hand_session_id", sessionId)
            .order("created_at", { ascending: true }),
        ]);
        if (cancelled) return;
        if (sErr) throw sErr;
        if (hErr) throw hErr;
        setSession(s as HandSession);
        setHands((hs as HandInListing[]) ?? []);
        setSelectedId(hs && hs.length > 0 ? (hs[0] as HandInListing).id : null);
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

  // Busca (lupa): filtra por posicao do hero, stack inicial do hero, ou
  // numero da mao ("Mão 5" casa com "5"). Um unico campo de texto livre
  // pra cobrir os 3 casos pedidos ("stack ou posições") — mais simples
  // pro jogador que 3 campos separados. "So com acao" e' um toggle a
  // parte, e' booleano, nao cabe bem como texto livre.
  // Tags distintas presentes nas maos DESSA sessao — so mostra no filtro
  // o que existe de fato aqui, nao a lista inteira de marcadores do
  // sistema (a maioria nao se aplica a um torneio especifico).
  const availableTags = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of hands) {
      for (const link of h.hand_review_tag_links ?? []) {
        for (const t of link.hand_review_tags ?? []) {
          map.set(t.id, t.label);
        }
      }
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [hands]);

  const filteredHands = useMemo(() => {
    return hands
      .map((h, i) => ({ hand: h, index: i }))
      .filter(({ hand, index }) => {
        if (onlyWithAction) {
          const entered = didHeroEnterHand(hand.parsed_data?.heroName, hand.parsed_data?.streets);
          if (entered !== true) return false;
        }
        if (tagFilter) {
          const hasTag = (hand.hand_review_tag_links ?? []).some((l) => l.tag_id === tagFilter);
          if (!hasTag) return false;
        }
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        const heroPosition = hand.parsed_data?.heroPosition?.toLowerCase() ?? "";
        const heroSeat = hand.parsed_data?.seats?.find((s) => s.isHero);
        const heroStack = heroSeat ? String(Math.round(heroSeat.startingChips)) : "";
        const handNumber = String(index + 1);
        return heroPosition.includes(q) || heroStack.includes(q) || handNumber === q;
      });
  }, [hands, searchQuery, onlyWithAction, tagFilter]);

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

  return (
    <div style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 14 }}>
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
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                Mãos ({filteredHands.length}{filteredHands.length !== hands.length ? `/${hands.length}` : ""})
              </span>
              <button
                onClick={() => {
                  setSearchOpen((v) => !v);
                  if (searchOpen) setSearchQuery("");
                }}
                title="Buscar mãos"
                style={{
                  all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
                  width: 22, height: 22, borderRadius: 6,
                  background: searchOpen ? "rgba(168,85,247,0.18)" : "transparent",
                  color: searchOpen ? "#C4B5FD" : "rgba(255,255,255,0.4)",
                }}
              >
                <Search size={13} />
              </button>
            </div>

            {searchOpen && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div
                  style={{
                    flex: 1, display: "flex", alignItems: "center", gap: 5,
                    background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 8, padding: "5px 8px",
                  }}
                >
                  <Search size={11} color="rgba(255,255,255,0.35)" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Posição, stack ou nº da mão"
                    style={{
                      all: "unset", flex: 1, fontFamily: F, fontSize: 11.5,
                      color: "#FFFFFF", minWidth: 0,
                    }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} style={{ all: "unset", cursor: "pointer", display: "grid", placeItems: "center" }}>
                      <X size={11} color="rgba(255,255,255,0.4)" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {searchOpen && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                <button
                  onClick={() => setOnlyWithAction((v) => !v)}
                  style={{
                    all: "unset", cursor: "pointer",
                    fontFamily: F, fontSize: 10.5, fontWeight: 500,
                    padding: "4px 9px", borderRadius: 999,
                    border: `1px solid ${onlyWithAction ? "#34D399" : "rgba(255,255,255,0.14)"}`,
                    background: onlyWithAction ? "rgba(52,211,153,0.14)" : "transparent",
                    color: onlyWithAction ? "#34D399" : "rgba(255,255,255,0.5)",
                  }}
                >
                  Só com ação
                </button>

                {/* Filtro por marcador (pedido explicito) — so lista tags
                    que realmente aparecem em alguma mao dessa sessao. */}
                {availableTags.map((t) => {
                  const active = tagFilter === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTagFilter(active ? null : t.id)}
                      style={{
                        all: "unset", cursor: "pointer",
                        fontFamily: F, fontSize: 10.5, fontWeight: 500,
                        padding: "4px 9px", borderRadius: 999,
                        border: `1px solid ${active ? "#C4B5FD" : "rgba(255,255,255,0.14)"}`,
                        background: active ? "rgba(168,85,247,0.18)" : "transparent",
                        color: active ? "#C4B5FD" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
            {hands.length === 0 && (
              <p style={{ padding: 14, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Nenhuma mão nessa sessão ainda.</p>
            )}
            {hands.length > 0 && filteredHands.length === 0 && (
              <p style={{ padding: 14, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Nenhuma mão encontrada pra essa busca.</p>
            )}
            {filteredHands.map(({ hand: h, index: i }) => {
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
                    borderBottom:
                      filteredHands.findIndex((f) => f.hand.id === h.id) < filteredHands.length - 1
                        ? "1px solid rgba(255,255,255,0.04)"
                        : "none",
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
