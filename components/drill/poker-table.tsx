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

// Trunca por CONTAGEM de caracteres (nao so por CSS text-overflow em px) —
// pedido explicito: nomes longos estouram o chip antes do ellipsis de CSS
// conseguir cortar de forma previsivel em telas menores. Corta em 12
// chars fixos + "..." (o title="" no elemento mantem o nome completo
// disponivel via tooltip/hover pra quem precisar conferir).
const NAME_MAX_CHARS = 12;
function truncateName(name: string): string {
  return name.length > NAME_MAX_CHARS ? `${name.slice(0, NAME_MAX_CHARS)}...` : name;
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
// confirmado).
// Limite minimo pra exibir a pilha — pedido explicito: "pode tirar o
// rake (0.1 de fichas no pre flop), desnecessario na nossa mesa". 0.1bb
// e' tipicamente o ante de MTT, postado por todos os jogadores igual —
// nao carrega informacao de decisao, so poluia a mesa. Apostas/calls/
// raises reais (>= 0.5bb) continuam aparecendo normalmente.
const MIN_COMMITTED_TO_SHOW = 0.5;

// 2026-08 v7 (pedido explicito): as fichas estavam "soltas" na mesa —
// posicionadas no fluxo normal do card do assento, sem relacao com a
// geometria da mesa. Assentos perto da borda empurravam a ficha praticamente
// pra fora do feltro. Agora a ficha e' ancorada em coordenadas absolutas,
// calculadas a partir do proprio x/y do assento na direcao do centro da
// mesa — sempre dentro do oval, bem proxima da posicao (pouco deslocamento,
// pedido explicito), nunca colada no avatar/chip do jogador.
const TABLE_CENTER = { x: 50, y: 44 }; // mesmo ponto onde o pote e' desenhado
const COMMITTED_APPROACH_FRACTION = 0.16; // "bem proxima da posicao"

function CommittedPill({ amount }: { amount: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: "#0A0A0A",
        border: "1px solid rgba(255,255,255,.18)",
        borderRadius: 999,
        padding: "3px 10px 3px 5px",
        boxShadow: "0 3px 8px rgba(0,0,0,.5)",
        animation: "fadeInUp 220ms ease-out both",
        whiteSpace: "nowrap",
      }}
    >
      <ChipStackIcon size={13} />
      <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: TEXT.critical, ...num }}>
        {amount}
        <span style={{ fontSize: 11, fontWeight: 600, color: TEXT.secondary, marginLeft: 3 }}>bb</span>
      </span>
    </div>
  );
}

// Ancora a CommittedPill num ponto absoluto da mesa, entre o assento e o
// centro (fracao pequena = fica perto do assento). Renderizada como
// irma do <Seat>, no mesmo sistema de coordenadas em % usado por
// ChipAnimation — por isso nunca escapa do oval da mesa.
function CommittedChip({ seat, amount }: { seat: SeatLayoutSlot; amount: number }) {
  const dx = TABLE_CENTER.x - seat.x;
  const dy = TABLE_CENTER.y - seat.y;
  const left = seat.x + dx * COMMITTED_APPROACH_FRACTION;
  const top = seat.y + dy * COMMITTED_APPROACH_FRACTION;
  return (
    <div
      style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        transform: "translate(-50%,-50%)",
        zIndex: 3,
        pointerEvents: "none",
      }}
    >
      <CommittedPill amount={amount} />
    </div>
  );
}

function Seat({
  seat, state, isDealer,
}: {
  seat: SeatLayoutSlot;
  state: SeatState;
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

  // Hero usa o MESMO padrao vertical dos demais seats na parte de baixo
  // da mesa (cardSide "below": cartas em cima, seatInfo embaixo) —
  // pedido explicito: "cartas em cima e nome em baixo como as outras
  // posicoes".
  const layout: React.CSSProperties = hero
    ? { flexDirection: "column", alignItems: "center", gap: 6 }
    : (
        {
          below: { flexDirection: "column", gap: 4 },
          above: { flexDirection: "column", gap: 0 },
          left: { flexDirection: "row-reverse", alignItems: "center", gap: 12 },
          right: { flexDirection: "row", alignItems: "center", gap: 12 },
        } as const
      )[seat.cardSide];

  const badgeArea = !acting ? (
    <div style={{ minHeight: 17, display: "flex", alignItems: "center", gap: 5 }}>
      <ActionBadge action={action} />
    </div>
  ) : null;

  // Redesenho estilo GG Poker: 2 chips empilhados, ambos no MESMO
  // formato pill:
  //  1) chip da posicao sozinha, em cima;
  //  2) chip combinado nome + stack, embaixo — com uma linha fina
  //     separando nome e stack (pedido explicito), pra deixar claro que
  //     sao dois dados diferentes dentro do mesmo chip.
  // Hero agora usa exatamente o mesmo chip 2 (nome + linha + stack) que
  // os demais assentos, em vez do nameplate sobreposto nas cartas —
  // pedido explicito: "hero com posicao em cima + nome e stack embaixo,
  // igual as outras posicoes".
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

      {!empty && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            fontFamily: F,
            color: acting ? "#FFFFFF" : "rgba(255,255,255,.72)",
            background: acting ? `${col.base}33` : "rgba(0,0,0,.55)",
            border: acting ? `1px solid ${col.glow}` : "1px solid rgba(255,255,255,.08)",
            borderRadius: 10,
            padding: "4px 10px",
            maxWidth: 118,
            lineHeight: 1.25,
            boxShadow: acting ? `0 0 10px ${col.glow}` : "none",
            textShadow: acting ? `0 0 6px ${col.glow}` : "none",
            transition: "all 200ms ease",
          }}
        >
          {seat.playerName && (
            <>
              <span
                style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}
                title={seat.playerName}
              >
                {truncateName(seat.playerName)}
              </span>
              {/* Risco fino separando nome e stack (pedido explicito) —
                  deixa visualmente claro que sao 2 dados distintos dentro
                  do mesmo chip. */}
              <div
                style={{
                  width: "100%",
                  height: 1,
                  background: acting ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.14)",
                  margin: "2px 0",
                }}
              />
            </>
          )}
          <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", ...num }}>{stack} bb</span>
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
        filter: status === "folded" ? "grayscale(0.5)" : "none",
        transition: "opacity 220ms ease, filter 220ms ease",
        zIndex: acting ? 5 : 2,
        animation: acting ? "seatPulse 2s ease-in-out infinite" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", ...layout }}>
        {hero ? (
          <>
            {cards && cards.length > 0 && (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  gap: 5,
                }}
              >
                {cards.map((c, i) => (
                  <div key={i} style={{ animation: "fadeInUp 260ms ease-out both", animationDelay: `${i * 60}ms` }}>
                    <Card card={c} size="board" />
                  </div>
                ))}
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
            ) : null;
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
    </div>
  );
}

// Pilha de fichas que anima do seat de quem agiu ate o pote central.
function ChipAnimation({
  fromSeat,
  amount,
  animKey,
}: {
  fromSeat: SeatLayoutSlot;
  amount: number;
  animKey: string | number;
}) {
  const dx = TABLE_CENTER.x - fromSeat.x;
  const dy = TABLE_CENTER.y - fromSeat.y;
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

export function PokerTable({
  hand,
  seats,
  onStreetClick,
  chipAnimation,
  streetCommitments,
}: {
  hand: TableHand | null;
  seats: SeatLayoutSlot[];
  onStreetClick?: (streetIndex: number) => void;
  chipAnimation?: { fromPosLabel: string; amount: number; key: string | number } | null;
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
            isDealer={s.posLabel === "BTN"}
          />
        ))}

        {/* Fichas de aposta ancoradas por assento — sempre dentro do
            oval, na direcao do centro, bem proximas de cada posicao. */}
        {seats.map((s) => {
          const amt = streetCommitments?.[s.posLabel];
          if (!amt || amt < MIN_COMMITTED_TO_SHOW) return null;
          return <CommittedChip key={`bet-${s.posLabel}`} seat={s} amount={amt} />;
        })}

        {chipAnimation && chipFromSeat && chipAnimation.amount > 0 && (
          <ChipAnimation fromSeat={chipFromSeat} amount={chipAnimation.amount} animKey={chipAnimation.key} />
        )}
      </div>
    </div>
  );
}
