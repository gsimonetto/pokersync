"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, ChevronRight, Search, X, List, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RevisorHandTable } from "./revisor-hand-table";
import { HalfCard } from "@/components/drill/card";
import { RevisorResponsiveStyles } from "./revisor-responsive-styles";
import { ModalPortal } from "@/components/modal-portal";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
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
//
// 2026-08 v4 (pedido explicito): filtro "Só com ação" deixou de ficar
// escondido atras do icone de lupa — agora e' um toggle sempre visivel
// no topo da lista, junto do contador de maos. A lupa continua so pra
// busca por texto (posicao/stack/numero) e pros marcadores da sessao,
// que sao mais situacionais. Nome do torneio/numero de jogadores e o
// botao "Analisar mao" saem daqui — agora vivem no header da propria
// mesa (RevisorHandTable), reposicionados pro canto superior direito
// como pedido.
// Altura medida de verdade (nao mais um calc(100vh - Npx) chutado) --
// mesma tecnica do Modo Treino (app/treino/page.tsx: useDailyTrainingLimit
// / medicao de altura), pedido explicito pra as duas telas ficarem "bem
// parecidas" em tamanho. Mede o offset real do topo do grid (que muda
// conforme header global, breadcrumb etc.) e usa o espaco que sobra ate'
// o fim da viewport, com o mesmo respiro inferior de 40px do Treino.
const GRID_FALLBACK_HEIGHT = "calc(100vh - 240px)"; // usado so' ate a 1a medicao real
const GRID_MIN_HEIGHT = 480;
const BOTTOM_PADDING_PX = 40;

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

// Tamanho "mini" (era "board" -- pedido explicito de voltar atras: a
// listagem inteira ficou grande demais depois do aumento). Mantem o
// MESMO formato visual da carta (corte na metade + borda preta solida,
// ver HalfCard em components/drill/card.tsx), so' no tamanho compacto
// de antes.
function HeroCardsPreview({ cards }: { cards: string[] }) {
  return (
    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
      {cards.map((c, i) => (
        <HalfCard key={i} card={c} size="mini" />
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
  onBack,
}: {
  sessionId: string;
  onOpenHand: (reviewId: string) => void;
  // Botao de voltar do modo tela-cheia no celular (ver ModalPortal
  // abaixo) -- a tela normal (fora do celular) ja tem seu proprio botao
  // de voltar renderizado pelo componente pai (app/revisor/page.tsx),
  // mas esse fica ESCONDIDO atras do portal em tela cheia no mobile, entao
  // o portal precisa do proprio caminho de volta.
  onBack: () => void;
}) {
  const isMobile = useIsMobile();
  const [session, setSession] = useState<HandSession | null>(null);
  const [hands, setHands] = useState<HandInListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyWithAction, setOnlyWithAction] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridHeight, setGridHeight] = useState<number | null>(null);
  // Gaveta da lista de maos no mobile (pedido explicito: "adapte o
  // revisor de maos igual ao modo treino") -- mesmo padrao da gaveta de
  // filtros do Treino: lista some por padrao no celular, abre como
  // overlay deslizante, fecha sozinha ao selecionar uma mao (a mesa e' o
  // destino, nao a lista).
  const [listOpen, setListOpen] = useState(false);
  // Alvo pra onde RevisorHandTable porta os botoes Salvar/Compartilhar/
  // Analisar no modo tela-cheia (pedido explicito: "os icones precisam
  // ficar ao lado do filtro la em cima") -- state (nao ref simples)
  // porque o portal so pode renderizar depois que esse node existir de
  // verdade no DOM; guardar em state garante o re-render assim que o
  // callback ref abaixo dispara.
  const [actionsSlotEl, setActionsSlotEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    function measure() {
      const el = gridRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setGridHeight(Math.max(GRID_MIN_HEIGHT, window.innerHeight - top - BOTTOM_PADDING_PX));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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
  // pro jogador que 3 campos separados. "So com acao" saiu daqui — agora
  // e' um toggle sempre visivel fora da busca (ver JSX abaixo).
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

  // Se o filtro "so com acao" tirar a mao selecionada da lista visivel,
  // pula pra primeira mao que sobrou — pedido explicito: "quando
  // selecionar, pode pular a sequencia de maos e so usar com as ações".
  // Sem isso a mesa continuaria mostrando uma mao que sumiu da lista
  // (selecao "orfa"), confuso pro jogador acompanhar qual mao esta
  // olhando.
  useEffect(() => {
    if (filteredHands.length === 0) return;
    const stillVisible = filteredHands.some((f) => f.hand.id === selectedId);
    if (!stillVisible) {
      setSelectedId(filteredHands[0].hand.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredHands]);

  // Avança pra próxima mão da fila quando o replay da mão atual falha
  // (ex: checagem de pote do projector) — pedido explicito (2026-08):
  // "ao finalizar de ver a ação daquela mão... preciso que vá para a
  // próxima mão ao invés de sair ou aparecer essa info", confirmado pra
  // valer "independente do que causou o erro". Avança dentro da lista
  // FILTRADA (não da lista bruta) — se "só com ação" está ativo, pular
  // pra próxima mão de verdade significa a próxima que também tem ação,
  // não qualquer mão da sessão. Se já é a última mão visível, mantém a
  // seleção.
  const goToNextHand = useCallback(() => {
    setSelectedId((current) => {
      const idx = filteredHands.findIndex((f) => f.hand.id === current);
      if (idx === -1 || idx >= filteredHands.length - 1) return current;
      return filteredHands[idx + 1].hand.id;
    });
  }, [filteredHands]);

  // Navegacao manual entre maos (pedido explicito: "ir pra proxima mao"
  // dentro do proprio chip de controles da mesa, no modo tela-cheia do
  // celular) -- mesma lista FILTRADA de goToNextHand acima, mas aqui e'
  // um clique deliberado do jogador, nao uma recuperacao automatica de
  // erro. Indice atual computado a cada render (lista pequena, sem
  // necessidade de memoizar) pra saber se ha mao anterior/seguinte.
  const currentHandIndex = filteredHands.findIndex((f) => f.hand.id === selectedId);
  const hasPrevHand = currentHandIndex > 0;
  const hasNextHand = currentHandIndex !== -1 && currentHandIndex < filteredHands.length - 1;
  const goToPrevHandManual = useCallback(() => {
    setSelectedId((current) => {
      const idx = filteredHands.findIndex((f) => f.hand.id === current);
      if (idx <= 0) return current;
      return filteredHands[idx - 1].hand.id;
    });
  }, [filteredHands]);
  const goToNextHandManual = useCallback(() => {
    setSelectedId((current) => {
      const idx = filteredHands.findIndex((f) => f.hand.id === current);
      if (idx === -1 || idx >= filteredHands.length - 1) return current;
      return filteredHands[idx + 1].hand.id;
    });
  }, [filteredHands]);

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

  // Lista de maos (header com busca/toggle "so com acao" + itens
  // clicaveis) -- fatorada numa variavel pra ser usada TANTO na coluna
  // fixa do desktop QUANTO na gaveta em tela cheia do celular (JSX
  // identico, so' o wrapper externo muda entre os dois modos).
  const listPanel = (
    <>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
            Mãos ({filteredHands.length}{filteredHands.length !== hands.length ? `/${hands.length}` : ""})
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => {
                setSearchOpen((v) => !v);
                if (searchOpen) setSearchQuery("");
              }}
              title="Buscar mãos"
              style={{
                all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
                width: 22, height: 22, borderRadius: 6,
                background: searchOpen ? "rgba(255,255,255,0.14)" : "transparent",
                color: searchOpen ? "#FFFFFF" : "rgba(255,255,255,0.4)",
              }}
            >
              <Search size={13} />
            </button>
            {isMobile && (
              <button
                onClick={() => setListOpen(false)}
                title="Fechar"
                style={{
                  all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
                  width: 22, height: 22, borderRadius: 6, color: "rgba(255,255,255,0.5)",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* "Só com ação" agora é um toggle sempre visível (pedido
            explicito) — não depende mais de abrir a busca pra
            aparecer. Selecionar pula a mão atual, se ela ficar de
            fora do filtro, pra próxima mão visível (ver useEffect
            acima). */}
        <button
          onClick={() => setOnlyWithAction((v) => !v)}
          style={{
            all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            fontFamily: F, fontSize: 11.5, fontWeight: 600,
            padding: "7px 10px", borderRadius: 9,
            border: `1px solid ${onlyWithAction ? "#34D399" : "rgba(255,255,255,0.14)"}`,
            background: onlyWithAction ? "rgba(52,211,153,0.16)" : "rgba(255,255,255,0.03)",
            color: onlyWithAction ? "#34D399" : "rgba(255,255,255,0.65)",
          }}
        >
          <span
            style={{
              width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
              background: onlyWithAction ? "#34D399" : "rgba(255,255,255,0.25)",
              boxShadow: onlyWithAction ? "0 0 6px #34D399" : "none",
            }}
          />
          Só com ação
        </button>

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

        {/* Filtro por marcador (pedido explicito) — so lista tags
            que realmente aparecem em alguma mao dessa sessao.
            Continua dentro da busca (searchOpen), e' mais
            situacional que "so com acao". */}
        {searchOpen && availableTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
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
                    border: `1px solid ${active ? "#FFFFFF" : "rgba(255,255,255,0.14)"}`,
                    background: active ? "rgba(255,255,255,0.14)" : "transparent",
                    color: active ? "#FFFFFF" : "rgba(255,255,255,0.5)",
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
              onClick={() => {
                setSelectedId(h.id);
                // No mobile a lista e' uma gaveta -- selecionar uma
                // mao fecha ela sozinha pra revelar a mesa na hora,
                // sem precisar de um segundo toque no X.
                setListOpen(false);
              }}
              style={{
                all: "unset", cursor: "pointer", display: "block", width: "100%",
                padding: "10px 14px",
                borderBottom:
                  filteredHands.findIndex((f) => f.hand.id === h.id) < filteredHands.length - 1
                    ? "1px solid rgba(255,255,255,0.04)"
                    : "none",
                background: active ? "rgba(255,255,255,0.06)" : "transparent",
                borderLeft: active ? "2px solid #FFFFFF" : "2px solid transparent",
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
    </>
  );

  // Mesa (ou estado de erro/vazio) -- tambem fatorada, mesmo motivo do
  // listPanel acima: identica nos dois modos, so' o wrapper muda.
  const tablePanel: ReactNode = selectedId && parsedForSelected ? (
    <RevisorHandTable
      parsedHand={parsedForSelected}
      tournamentName={session.label ?? null}
      reviewId={selectedId}
      onOpenHand={() => selectedId && onOpenHand(selectedId)}
      onFatalError={goToNextHand}
      actionsSlot={isMobile ? actionsSlotEl : undefined}
      onPrevHand={hasPrevHand ? goToPrevHandManual : undefined}
      onNextHand={hasNextHand ? goToNextHandManual : undefined}
      // RevisorHandTable so' renderiza esse botao no proprio header
      // desktop (ver isMobile la' dentro) -- no celular o modo tela-cheia
      // acima ja tem seu proprio ArrowLeft, entao passar aqui sem
      // condicional nao duplica nada.
      onBack={onBack}
    />
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
        Essa mão não tem hand history parseável — abra em &quot;Analisar mão&quot; pra revisar sem a mesa visual.
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
  );

  // Modo tela-cheia no celular (pedido explicito: "deixe fora igual e' no
  // modo treino") -- Portal (foge de QUALQUER container/padding da pagina,
  // mesmo padrao ja usado no modo mesa-cheia do Treino em
  // rfi-jam-drill.tsx) em vez de so' colapsar o grid via CSS: o botao de
  // voltar e o de "Mãos" ficam soltos por cima da mesa (nao dentro do
  // card com borda/padding do container padrao da pagina), e a mesa
  // ocupa o viewport inteiro de verdade -- sem isso, o card com borda
  // arredondada + padding do app/revisor/page.tsx sempre sobrava altura
  // e empurrava a pagina inteira pra fora da tela (causa da barra de
  // rolagem reportada).
  if (isMobile) {
    return (
      <ModalPortal>
        <RevisorResponsiveStyles />
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column", fontFamily: F }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", flexShrink: 0 }}>
            <button
              onClick={onBack}
              aria-label="Voltar"
              title="Voltar"
              style={{
                all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                width: 34, height: 34, borderRadius: 9, background: "#1A1A1A",
                border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)", flexShrink: 0,
              }}
            >
              <ArrowLeft size={16} />
            </button>
            {/* So' o icone -- rotulo "Mãos" + contagem saem daqui (pedido
                explicito) e continuam so' dentro da propria gaveta, que
                ja mostra "Mãos (N)" no topo do listPanel quando abre. */}
            <button
              onClick={() => setListOpen(true)}
              aria-label={`Mãos (${filteredHands.length}${filteredHands.length !== hands.length ? `/${hands.length}` : ""})`}
              title="Mãos da sessão"
              style={{
                all: "unset", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                width: 34, height: 34, borderRadius: 9, background: "#1A1A1A",
                border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)", flexShrink: 0,
              }}
            >
              <List size={16} />
            </button>

            {/* Alvo do portal de RevisorHandTable (Salvar/Compartilhar/
                Analisar) -- pedido explicito: "os icones precisam ficar
                ao lado do filtro la em cima". */}
            <div ref={setActionsSlotEl} style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }} />
          </div>

          <div style={{ flex: 1, minHeight: 0, padding: "0 8px 8px", display: "flex", flexDirection: "column" }}>
            {tablePanel}
          </div>
        </div>

        {/* Gaveta da lista + backdrop -- por cima do modo tela-cheia
            (z-index maior que o container de 100 acima). */}
        <div
          onClick={() => setListOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.55)",
            opacity: listOpen ? 1 : 0, pointerEvents: listOpen ? "auto" : "none",
            transition: "opacity 220ms ease",
          }}
        />
        <aside
          style={{
            position: "fixed", inset: 0, zIndex: 160, width: "82%", maxWidth: 320,
            background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
            display: "flex", flexDirection: "column",
            transform: listOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 220ms ease",
          }}
        >
          {listPanel}
        </aside>
      </ModalPortal>
    );
  }

  return (
    <div
      style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Master-detail: coluna esquerda com maos, coluna direita com mesa.
          Altura TRAVADA (nao so minHeight) — pedido explicito: "a mesa
          some quando desce a listagem". Com altura fixa + overflow proprio
          em cada coluna, a lista rola por dentro e a mesa nunca sai da
          tela. Colunas 220px / 1fr (era 260px) — mesa ganha mais espaco,
          "precisa ser maior, ocupar mais espaço". Abaixo de 769px isso nao
          renderiza mais -- vira o modo tela-cheia acima. */}
      <div
        ref={gridRef}
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 12,
          height: gridHeight ? `${gridHeight}px` : GRID_FALLBACK_HEIGHT,
          minHeight: GRID_MIN_HEIGHT,
        }}
      >
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
          {listPanel}
        </aside>

        {/* overflow "auto" (era "hidden") — pedido explicito: "botoes de
            acao de apostas desaparecidos". Quando mesa+controles ficam
            mais altos que o espaco disponivel nessa coluna, "hidden"
            cortava os botoes (que ficam embaixo da mesa) junto com o
            excesso. "auto" so cria uma rolagem interna nesse caso raro,
            nunca esconde os controles. */}
        <section style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
          {tablePanel}
        </section>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
