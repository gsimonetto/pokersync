"use client";

import { Fragment } from "react";
import { Card } from "./card";
import { F, POS, ACT, num } from "@/lib/poker/drill-theme";
import type { SeatLayoutSlot } from "@/lib/poker/seat-layout";

export interface SeatState {
  status: "empty" | "live" | "acting" | "folded";
  stack?: number;
  action?: { type: string; size?: number } | null;
  cards?: (string | null)[];
}

export interface HistoryStep {
  street: string;
  current?: boolean;
  actions: { pos: string; label: string }[];
}

export interface TableHand {
  pot: number;
  spr: number | null;
  board: (string | null)[];
  history: HistoryStep[];
  seats: Record<string, SeatState>;
}

const NEUTRAL = "#3A4048";
const NEUTRAL_GLOW = "#5A6270";

// Ver commit de UI (2026-08): valores unicos, calibrados pro modo replay
// onde NINGUEM esta "acting" — a escala antiga (0.15/0.1/0.08) fazia a
// mesa inteira sumir. Aqui todo seat vivo continua legivel.
const SEAT_OPACITY = {
  acting: 1,
  live: 0.85,
  folded: 0.45,
  empty: 0.25,
} as const;

// Escala unica de texto — 3 papeis, alinhada com paleta oficial (#FFF/grafite).
const TEXT = {
  critical: "#FFFFFF",
  secondary: "rgba(255,255,255,0.72)",
  decorative: "rgba(255,255,255,0.45)",
  disabled: "rgba(255,255,255,0.28)",
} as const;

// Icone flat de ficha de poker — 2 discos empilhados com anel fino de
// borda (sem gradiente radial "brilhante" que dava ar cartoon). Estilo
// alinhado com o que replayers de referencia usam (Hand2Note, PokerTracker,
// GTO Wizard): disco solido + friso de borda, nunca gloss/glow.
function ChipStackIcon({ size = 13 }: { size?: number }) {
  const disc = (bottom: number, z: number) => (
    <div
      key={z}
      style={{
        position: "absolute",
        bottom,
        left: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#C9A227",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,.85), inset 0 0 0 3px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.5)",
        zIndex: z,
      }}
    />
  );
  return (
    <div style={{ position: "relative", width: size, height: size + 5, flexShrink: 0 }}>
      {disc(0, 1)}
      {disc(3, 2)}
    </div>
  );
}

// Rotulo de valor: icone de ficha + numero em texto puro (mesma fonte
// monoespacada usada no stack/pot), sem pill colorida ao redor — o
// numero fica solto, igual HUD de replayer profissional em vez de "badge"
// de app mobile. Usado so no pote/ficha voadora agora — a pilha parada
// por assento virou um badge fixo ancorado no proprio avatar (ver Seat).

// Pilha de fichas do POTE — 3 discos empilhados em verde (distinto do
// dourado usado nos seats), pra leitura instantanea "essas fichas ja
// estao consolidadas no meio da mesa". Substitui o antigo ponto verde
// solto por um empilhamento de verdade.
function PotChipStack() {
  const disc = (bottom: number, z: number) => (
    <div
      key={z}
      style={{
        position: "absolute",
        bottom,
        left: 0,
        width: 14,
        height: 14,
        borderRadius: "50%",
        background: "#1F9D6B",
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,.85), inset 0 0 0 3px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.5)",
        zIndex: z,
      }}
    />
  );
  return (
    <div style={{ position: "relative", width: 14, height: 20, flexShrink: 0 }}>
      {disc(0, 1)}
      {disc(3, 2)}
      {disc(6, 3)}
    </div>
  );
}

function ActionBadge({ action }: { action?: SeatState["action"] }) {
  if (!action) return null;
  const a = ACT[action.type.toLowerCase()] || ACT.check;
  return (
    <div
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        fontFamily: F,
        background: a.bg,
        color: a.fg,
        border: `1px solid ${a.bd}`,
        fontSize: 10.5,
        fontWeight: 500,
        ...num,
        animation: "fadeInUp 200ms ease-out",
      }}
    >
      {a.label}
      {action.size ? ` ${action.size}bb` : ""}
    </div>
  );
}

// Pilha de fichas PARADA em frente ao seat, representando quanto esse
// jogador ja colocou na rua atual. Diferente de ChipAnimation (que voa e
// some) — essa fica visivel ate a rua terminar (fixo durante toda a rua,
// confirmado). Refinada (2026-08): saiu o pill dourado com bolinha dentro
// (lido como "cartoon"); entra o icone de ficha real + numero solto, sem
// container colorido.
// Limite minimo pra exibir a pilha — pedido explicito: "pode tirar o
// rake (0.1 de fichas no pre flop), desnecessario na nossa mesa". 0.1bb
// e' tipicamente o ante de MTT, postado por todos os jogadores igual —
// nao carrega informacao de decisao, so poluia a mesa. Apostas/calls/
// raises reais (>= 0.5bb) continuam aparecendo normalmente.
const MIN_COMMITTED_TO_SHOW = 0.5;

// Pilha de fichas parada — "as apostas" — voltou pro fluxo normal do
// layout do assento (nao mais ancorada no avatar). Pedido explicito:
// "nao quero as apostas grudadas na posicao, mantenha do jeito que
// estava antes". Componente pequeno reaproveitado tanto pro hero (ao
// lado/acima das cartas) quanto pros demais assentos (abaixo do bloco).
function CommittedPill({ amount }: { amount: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: "#0A0A0A",
        border: "1px solid rgba(255,255,255,.18)",
        borderRadius: 999,
        padding: "2px 8px 2px 4px",
        boxShadow: "0 3px 8px rgba(0,0,0,.5)",
        animation: "fadeInUp 220ms ease-out both",
        whiteSpace: "nowrap",
      }}
    >
      <ChipStackIcon size={11} />
      <span style={{ fontFamily: F, fontSize: 11, fontWeight: 600, color: TEXT.critical, ...num }}>
        {amount}
        <span style={{ fontSize: 9, fontWeight: 500, color: TEXT.secondary, marginLeft: 2 }}>bb</span>
      </span>
    </div>
  );
}

function Seat({
  seat, state, committed, isDealer,
}: {
  seat: SeatLayoutSlot;
  state: SeatState;
  committed?: number;
  // BTN — badge do dealer agora vive ANCORADO no proprio avatar (ver
  // abaixo), nao mais como elemento flutuante calculado por x/y.
  isDealer?: boolean;
}) {
  const posCol = POS[seat.posLabel];
  const { status = "empty", stack, action, cards } = state;
  const hero = seat.isHero;
  const acting = status === "acting";
  const empty = status === "empty";
  const revealedVillainCards = !hero && !!cards && cards.length > 0 && cards.every(Boolean);

  const col = acting ? posCol : { base: NEUTRAL, glow: NEUTRAL_GLOW };
  const opacity = SEAT_OPACITY[status];

  // Hero agora usa o MESMO padrao vertical dos demais seats na parte de
  // baixo da mesa (cardSide "below": cartas em cima, seatInfo embaixo) —
  // pedido explicito: "cartas em cima e nome em baixo como as outras
  // posicoes". Antes era row (cartas do lado, tamanho "hero" grande);
  // ficou maior e mais dissonante do resto da mesa do que o necessario.
  const layout: React.CSSProperties = hero
    ? { flexDirection: "column", alignItems: "center", gap: 6 }
    : (
        {
          // Gap zerado pra "above" — pedido explicito: "cartas muito
          // afastadas da posicao, dando a impressao de soltas".
          below: { flexDirection: "column", gap: 4 },
          above: { flexDirection: "column", gap: 0 },
          left: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
          right: { flexDirection: "row", alignItems: "center", gap: 12 },
        } as const
      )[seat.cardSide];

  // "VOCÊ" removido — hero sempre embaixo, orientacao natural da mesa
  // ja identifica quem e o jogador. "NA AÇÃO" tambem removido (2026-08,
  // pedido explicito): o anel dourado pulsante ao redor do avatar (ver
  // seatInfo abaixo) ja e' sinal suficiente de quem esta agindo — texto
  // adicional era redundante, replayers de referencia (Hand2Note,
  // PokerTracker) usam so o realce visual do assento, sem rotulo.
  const badgeArea = !acting ? (
    <div style={{ minHeight: 17, display: "flex", alignItems: "center", gap: 5 }}>
      <ActionBadge action={action} />
    </div>
  ) : null;

  // Redesenho estilo GG Poker (2026-08 v6, pedido explicito): saiu o
  // avatar redondo com a posicao dentro. Agora sao 2 chips empilhados,
  // os dois no MESMO formato pill (nunca redondos):
  //  1) chip da posicao sozinha, em cima;
  //  2) chip combinado nome + stack, embaixo — antes eram 2 elementos
  //     separados (pill de nome + texto solto de stack).
  // O badge do dealer ("D") continua ancorado, agora no canto do chip
  // de posicao em vez do avatar circular que deixou de existir.
  const seatInfo = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ position: "relative" }}>
        {isDealer && (
          <div
            style={{
              position: "absolute",
              bottom: -6,
              left: -10,
              zIndex: 6,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#B91C1C",
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,.85), inset 0 0 0 3px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: F,
              fontSize: 10,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            D
          </div>
        )}
        <div
          style={{
            padding: "3px 11px",
            borderRadius: 6,
            fontFamily: F,
            fontWeight: 700,
            fontSize: 11.5,
            letterSpacing: 0.3,
            textAlign: "center",
            color: empty ? TEXT.disabled : "#FFFFFF",
            background: empty
              ? "rgba(255,255,255,.03)"
              : acting
              ? `linear-gradient(160deg, ${col.glow}, ${col.base})`
              : `${(posCol?.base ?? NEUTRAL)}CC`,
            border: empty ? "1px dashed rgba(255,255,255,.15)" : acting ? "1px solid rgba(255,255,255,.4)" : "1px solid rgba(255,255,255,.14)",
            boxShadow: acting ? `0 0 14px ${col.glow}` : "0 2px 6px rgba(0,0,0,.45)",
            transition: "all 200ms ease",
          }}
        >
          {seat.posLabel}
        </div>
      </div>

      {/* Chip unico com nome + stack — so existe em modo replay
          (Revisor), onde SeatLayoutSlot.playerName vem do hand history
          real. Brilho (glow) quando o jogador esta agindo, mesmo padrao
          que ja existia no chip de nome antigo. */}
      {!empty && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontFamily: F,
            fontSize: 11,
            fontWeight: 500,
            color: acting ? "#FFFFFF" : "rgba(255,255,255,.72)",
            background: acting ? `${col.base}33` : "rgba(0,0,0,.55)",
            border: acting ? `1px solid ${col.glow}` : "1px solid rgba(255,255,255,.08)",
            borderRadius: 999,
            padding: "3px 9px",
            maxWidth: 118,
            lineHeight: 1.3,
            boxShadow: acting ? `0 0 10px ${col.glow}` : "none",
            textShadow: acting ? `0 0 6px ${col.glow}` : "none",
            transition: "all 200ms ease",
          }}
        >
          {/* Hero nao repete o nome aqui — ja aparece sobreposto nas
              cartas (nameplate estilo GG, ver bloco do hero abaixo). */}
          {seat.playerName && !hero && (
            <span
              style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={seat.playerName}
            >
              {seat.playerName}
            </span>
          )}
          {seat.playerName && !hero && <span style={{ opacity: 0.4 }}>·</span>}
          <span style={{ whiteSpace: "nowrap", ...num }}>{stack} bb</span>
        </div>
      )}

      {badgeArea}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        transform: "translate(-50%,-50%)",
        opacity,
        // Dessaturacao leve no fold — reforca "fora da mao" so com
        // tratamento visual (opacidade + cinza), sem precisar de texto
        // "FOLD". Acompanha o pedido de manter so o estado visual.
        filter: status === "folded" ? "grayscale(0.5)" : "none",
        transition: "opacity 220ms ease, filter 220ms ease",
        zIndex: acting ? 5 : 2,
        animation: acting ? "seatPulse 2s ease-in-out infinite" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", ...layout }}>
        {hero ? (
          <>
            {/* Ficha da aposta acima das cartas do hero (nao mais grudada
                no avatar) — pedido explicito: "as apostas serem
                visualizadas ao lado ou em cima das cartas". Quando ha
                aposta, empurra as cartas um pouco pra baixo (marginTop)
                pra abrir espaco — "a carta do hero pode baixar um pouco
                mais". */}
            {!!committed && committed >= MIN_COMMITTED_TO_SHOW && (
              <div style={{ marginBottom: 2 }}>
                <CommittedPill amount={committed} />
              </div>
            )}
            {cards && cards.length > 0 && (
              // Cards do hero: tamanho "board" (mesmo das cartas comunitarias),
              // sem rotacao. Antes usava size="hero" (bem maior) em layout
              // row — pedido explicito: diminuir e trocar pro mesmo padrao
              // vertical dos outros assentos (cartas em cima, seatInfo embaixo).
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  gap: 5,
                  marginTop: committed && committed >= MIN_COMMITTED_TO_SHOW ? 4 : 0,
                  // Espaco extra embaixo pra nameplate sobreposta nao
                  // colidir com o seatInfo logo abaixo.
                  marginBottom: seat.playerName ? 10 : 0,
                }}
              >
                {cards.map((c, i) => (
                  <div key={i} style={{ animation: "fadeInUp 260ms ease-out both", animationDelay: `${i * 60}ms` }}>
                    <Card card={c} size="board" />
                  </div>
                ))}
                {/* Nameplate sobreposta na base das cartas, estilo GG Poker
                    (pedido explicito): "as cartas do hero podem vir tambem
                    igual ao GG, com o nome um pouco sobreposto a parte de
                    baixo da carta". */}
                {seat.playerName && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: 0,
                      transform: "translate(-50%, 50%)",
                      background: "rgba(0,0,0,.85)",
                      border: "1px solid rgba(255,255,255,.18)",
                      borderRadius: 999,
                      padding: "2px 10px",
                      fontFamily: F,
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "#FFFFFF",
                      whiteSpace: "nowrap",
                      maxWidth: 110,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      boxShadow: "0 3px 8px rgba(0,0,0,.6)",
                      zIndex: 2,
                    }}
                    title={seat.playerName}
                  >
                    {seat.playerName}
                  </div>
                )}
              </div>
            )}
            {seatInfo}
          </>
        ) : (
          (() => {
            const cardsBlock = revealedVillainCards ? (
              <div style={{ display: "flex", gap: 5 }}>
                {cards!.map((c, i) => (
                  <div key={i} style={{ transform: `rotate(${i ? 4 : -4}deg)`, animation: "fadeInUp 260ms ease-out both", animationDelay: `${i * 60}ms` }}>
                    <Card card={c} size="board" />
                  </div>
                ))}
              </div>
            ) : null; // Verso da carta removido (pedido explicito) — sem
            // cartas reveladas, o assento so mostra o chip de posicao/nome.
            // Ordem trocada explicitamente por cardSide em vez de depender
            // de flex-direction reverso (mais previsivel) — pedido
            // explicito: "o vilao de cima esta com as cartas quase no
            // meio da mesa". Pra assentos "above" (topo da mesa), as
            // cartas ficam ANTES do seatInfo no fluxo, ou seja, mais
            // proximas da borda superior (longe do centro); pra "below"/
            // "left"/"right", mantem a ordem original (seatInfo primeiro).
            if (seat.cardSide === "above") {
              return (
                <>
                  {cardsBlock}
                  {seatInfo}
                </>
              );
            }
            return (
              <>
                {seatInfo}
                {cardsBlock}
              </>
            );
          })()
        )}
      </div>

      {/* Ficha da aposta pros demais assentos — voltou pro fluxo normal,
          abaixo do bloco inteiro do assento, do jeito que estava antes
          da tentativa de ancorar no avatar. */}
      {!hero && !!committed && committed >= MIN_COMMITTED_TO_SHOW && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
          <CommittedPill amount={committed} />
        </div>
      )}
    </div>
  );
}

// Pilha de fichas que anima do seat de quem agiu ate o pote central.
// Renderizada uma unica vez por step (key = stepIndex do replay) — quando
// o step muda, o componente remonta e a animacao dispara do zero. Nao
// altera o estado da mesa; e' puramente visual, coordenada por CSS.
// O destino (50,44) e' o mesmo ponto onde o pote e' desenhado (ver
// PokerTable abaixo) — a animacao ja converge pro centro, nunca pra fora
// da mesa; se algum seat aparentar "jogar fichas pra fora" o problema
// esta nas coordenadas x/y desse seat especifico (seat-layout.ts), nao
// aqui no vetor de destino.
function ChipAnimation({
  fromSeat,
  amount,
  animKey,
}: {
  fromSeat: SeatLayoutSlot;
  amount: number;
  animKey: string | number;
}) {
  // Distancia do seat ate o centro em unidades relativas (translate).
  // fromSeat.x/y estao em %, mesa centrada em 50/44 (mesmo top-center
  // usado pelo pote no PokerTable). O CSS custom prop passa o vetor.
  const dx = 50 - fromSeat.x;
  const dy = 44 - fromSeat.y;
  return (
    <div
      key={animKey}
      style={{
        position: "absolute",
        left: `${fromSeat.x}%`,
        top: `${fromSeat.y}%`,
        transform: "translate(-50%,-50%)",
        zIndex: 4,
        pointerEvents: "none",
        // Anima translacao percentual do proprio elemento — usa CSS var
        // pra endpoint ser configuravel por chip sem inline animation.
        ["--chip-dx" as string]: `${dx}%`,
        ["--chip-dy" as string]: `${dy}%`,
        animation: "chipTravel 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <ChipStackIcon size={13} />
        <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 500, color: TEXT.critical, ...num, textShadow: "0 1px 3px rgba(0,0,0,.9)" }}>
          +{amount}bb
        </span>
      </div>
    </div>
  );
}

// Icone do dealer button (disco branco com "D") — agora renderizado
// DENTRO do Seat, ancorado no avatar do assento BTN (ver isDealer no
// Seat acima). Removida a versao antiga como elemento flutuante
// calculado por x/y — colidia com as cartas do BTN quando puxado em
// direcao ao centro (bug reportado com print).

export function PokerTable({
  hand,
  seats,
  onStreetClick,
  chipAnimation,
  streetCommitments,
}: {
  hand: TableHand | null;
  seats: SeatLayoutSlot[];
  // Presente so no modo replay — clicavel na barra de historico pra
  // pular pra rua correspondente. No Treino, undefined = labels nao clicaveis.
  onStreetClick?: (streetIndex: number) => void;
  // Fichas animadas no replay: partem do seat que agiu ate o pote.
  // A key deve mudar a cada step novo pra forcar remount + re-anim.
  chipAnimation?: { fromPosLabel: string; amount: number; key: string | number } | null;
  // Quanto cada jogador (por posLabel) ja colocou na rua atual — pilha
  // PARADA em frente ao seat, complementar ao chipAnimation (que e' so
  // o voo momentaneo). Vem de ReplayState.streetCommitments; ausente no
  // modo Treino (mao unica, sem conceito de rua acumulada).
  streetCommitments?: Record<string, number>;
}) {
  const active = !!hand;
  const history = hand?.history || [];
  const hasHistory = history.length > 0;
  const seatData = (p: string): SeatState => (hand?.seats && hand.seats[p]) || { status: "empty" };
  const chipFromSeat = chipAnimation ? seats.find((s) => s.posLabel === chipAnimation.fromPosLabel) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <style>{`
        @keyframes seatPulse { 0%, 100% { filter: drop-shadow(0 0 0px rgba(255,255,255,0)); } 50% { filter: drop-shadow(0 0 6px rgba(255,255,255,0.15)); } }
        @keyframes cardDeal { from { opacity: 0; transform: translateY(-8px) rotate(-4deg); } to { opacity: 1; transform: translateY(0) rotate(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes chipTravel {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          85% { opacity: 1; transform: translate(calc(-50% + var(--chip-dx)), calc(-50% + var(--chip-dy))) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--chip-dx)), calc(-50% + var(--chip-dy))) scale(0.85); }
        }
      `}</style>

      {active && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
            padding: "6px 12px",
            minHeight: 32,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          {/* Resumo de acao — rolavel horizontalmente, ocupa o espaco
              disponivel. Antes essa barra so aparecia com historico
              (hasHistory); agora aparece sempre que a mao esta ativa,
              com placeholder quando ainda nao ha nenhuma acao (step 0).
              Valores em BB (nao mais fichas cruas) — convertidos ja no
              hand-replay-projector.ts, esse componente so exibe o label
              pronto (ex: "call 6bb"). */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", flex: 1, minWidth: 0 }}>
            {hasHistory ? (
              history.map((h, i) => (
                <Fragment key={i}>
                  <button
                    type="button"
                    onClick={onStreetClick ? () => onStreetClick(i) : undefined}
                    disabled={!onStreetClick}
                    style={{
                      all: "unset",
                      cursor: onStreetClick ? "pointer" : "default",
                      fontFamily: F,
                      fontSize: 9.5,
                      fontWeight: 500,
                      letterSpacing: 1.2,
                      color: h.current ? TEXT.critical : TEXT.decorative,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.street}
                  </button>
                  <div style={{ display: "flex", gap: 5 }}>
                    {h.actions.map((a, j) => (
                      <span
                        key={j}
                        style={{
                          fontFamily: F,
                          fontSize: 10.5,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          color: POS[a.pos]?.glow,
                          opacity: h.current ? 1 : 0.7,
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: `${POS[a.pos]?.base}1F`,
                          border: `1px solid ${POS[a.pos]?.base}55`,
                          ...num,
                        }}
                      >
                        {a.pos} {a.label}
                      </span>
                    ))}
                  </div>
                  {i < history.length - 1 && <span style={{ color: "rgba(255,255,255,.1)" }}>|</span>}
                </Fragment>
              ))
            ) : (
              <span style={{ fontFamily: F, fontSize: 11, color: TEXT.decorative }}>Nenhuma ação ainda</span>
            )}
          </div>

          {/* SPR movido pro topo (pedido explicito) — antes ficava solto
              embaixo do pote, no centro da mesa. Fixo a direita da barra,
              nao rola com o resumo de acao. */}
          {hand.spr != null && (
            <div
              style={{
                fontFamily: F,
                fontSize: 10.5,
                fontWeight: 500,
                letterSpacing: 0.6,
                color: TEXT.secondary,
                whiteSpace: "nowrap",
                flexShrink: 0,
                paddingLeft: 10,
                borderLeft: "1px solid rgba(255,255,255,0.08)",
                ...num,
              }}
            >
              SPR {hand.spr}
            </div>
          )}
        </div>
      )}

      <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            // Inset vertical maior que o horizontal (9% vs 6%) — pedido:
            // "esta cortando os nomes" em telas maiores (notebook 1080p).
            // Os assentos de cima/baixo (posLabel proximo de y=0/100) tem
            // o nome do jogador logo abaixo/acima do avatar; com inset
            // simetrico a elipse chegava perto demais da borda do
            // container (que tem overflow:hidden), cortando esse texto.
            // Vertical maior da mais respiro sem encolher a largura da
            // mesa.
            inset: "9% 6%",
            borderRadius: "50%",
            background: "radial-gradient(65% 75% at 50% 40%, #0F5A42 0%, #0A4231 30%, #062E22 60%, #031810 100%)",
            border: "2px solid #000000",
            boxShadow: [
              "0 0 0 6px #000000",
              "0 0 0 7px rgba(255,255,255,.08)",
              "0 0 40px rgba(15,90,66,.35)",
              "0 24px 60px rgba(0,0,0,.75)",
              "inset 0 2px 30px rgba(255,255,255,.06)",
              "inset 0 -30px 80px rgba(0,0,0,.65)",
            ].join(", "),
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              pointerEvents: "none",
              background: "radial-gradient(55% 35% at 50% 25%, rgba(255,255,255,.09), transparent 70%)",
            }}
          />
          <div style={{ position: "absolute", inset: "3%", borderRadius: "50%", pointerEvents: "none", border: "1px solid rgba(255,255,255,.06)" }} />
        </div>

        <div style={{ position: "absolute", left: "50%", top: "44%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 3 }}>
          {active && hand ? (
            <>
              <div style={{ display: "flex", gap: 7 }}>
                {hand.board.map((c, i) => (
                  <div key={i} style={{ animation: "cardDeal 300ms ease-out both", animationDelay: `${i * 70}ms` }}>
                    <Card card={c} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontFamily: F,
                    background: "linear-gradient(180deg,#000000,#0A0A0A)",
                    border: "1px solid rgba(255,255,255,.20)",
                    boxShadow: "0 8px 22px rgba(0,0,0,.7), 0 0 20px rgba(52,211,153,.20)",
                  }}
                >
                  {/* Pote agora mostra empilhamento de fichas de verdade
                      (3 discos) em vez do ponto verde solto — pedido
                      explicito de "empilhamento no centro". Cor separada
                      do dourado usado nos seats, pra distinguir visualmente
                      "ficha do jogador" (dourada) de "ficha no pote" (verde). */}
                  <PotChipStack />
                  <span style={{ color: TEXT.critical, fontWeight: 500, fontSize: 15, ...num }}>{hand.pot}</span>
                  <span style={{ color: TEXT.secondary, fontSize: 11, fontWeight: 500 }}>bb</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", maxWidth: 290, fontFamily: F }}>
              <div style={{ display: "flex", gap: 7, justifyContent: "center", marginBottom: 14 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Card key={i} card={null} />
                ))}
              </div>
              <div style={{ color: TEXT.critical, fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Escolha os filtros pra começar</div>
              <div style={{ color: TEXT.secondary, fontSize: 12, lineHeight: 1.5 }}>
                Posição, situação e rua ficam no painel à esquerda. Só mãos que existem na base aparecem aqui.
              </div>
            </div>
          )}
        </div>

        {seats.map((s) => (
          <Seat
            key={s.posLabel}
            seat={s}
            state={seatData(s.posLabel)}
            committed={streetCommitments?.[s.posLabel]}
            isDealer={s.posLabel === "BTN"}
          />
        ))}

        {chipAnimation && chipFromSeat && chipAnimation.amount > 0 && (
          <ChipAnimation fromSeat={chipFromSeat} amount={chipAnimation.amount} animKey={chipAnimation.key} />
        )}
      </div>
    </div>
  );
}
