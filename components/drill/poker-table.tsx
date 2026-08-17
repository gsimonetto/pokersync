"use client";

import { Card } from "./card";
import { F, POS, ACT, num } from "@/lib/poker/drill-theme";
import type { SeatLayoutSlot } from "@/lib/poker/seat-layout";

export interface SeatState {
  status: "empty" | "live" | "acting" | "folded";
  stack?: number;
  action?: { type: string; size?: number } | null;
  cards?: (string | null)[];
}

const NAME_MAX_CHARS = 12;
function truncateName(name: string): string {
  return name.length > NAME_MAX_CHARS ? `${name.slice(0, NAME_MAX_CHARS)}...` : name;
}

// Stack sempre com no máximo 1 casa decimal (pedido explícito: "21.5 no
// máximo, não mais que isso"). 21.515 -> "21.5"; 21 -> "21" (sem ".0"
// solto quando o valor já é redondo).
function formatStack(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
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

const SEAT_OPACITY = {
  acting: 1,
  live: 0.85,
  folded: 0.45,
  empty: 0.25,
} as const;

const TEXT = {
  critical: "#FFFFFF",
  secondary: "rgba(255,255,255,0.72)",
  decorative: "rgba(255,255,255,0.45)",
  disabled: "rgba(255,255,255,0.28)",
} as const;

// Paleta de feltro por variante da mesa (pedido explicito, 2026-08):
// Modo Treino usa AZUL, Hand Replayer mantem o BORDÔ original. So a
// cor/glow do feltro muda — geometria, seats, cartas e pote continuam
// identicos entre variantes.
const FELT_PALETTES = {
  replay: {
    background: "radial-gradient(65% 75% at 50% 40%, #7A1830 0%, #5C1224 30%, #3D0C18 60%, #1F0509 100%)",
    glow: "rgba(122,24,48,.35)",
  },
  treino: {
    background: "radial-gradient(65% 75% at 50% 40%, #123A6E 0%, #0F2C54 30%, #0A1D38 60%, #05101F 100%)",
    glow: "rgba(24,88,168,.38)",
  },
} as const;

export type TableVariant = keyof typeof FELT_PALETTES;

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

const MIN_COMMITTED_TO_SHOW = 0.5;

const TABLE_CENTER = { x: 50, y: 44 };
const COMMITTED_OFFSET_PX = 56;
const HERO_COMMITTED_OFFSET_PX = 104;
const ABOVE_SEAT_EXTRA_OFFSET_PX = 14;

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

function CommittedChip({ seat, amount }: { seat: SeatLayoutSlot; amount: number }) {
  const dx = TABLE_CENTER.x - seat.x;
  const dy = TABLE_CENTER.y - seat.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let offsetPx = seat.isHero ? HERO_COMMITTED_OFFSET_PX : COMMITTED_OFFSET_PX;
  if (!seat.isHero && seat.cardSide === "above") {
    offsetPx += ABOVE_SEAT_EXTRA_OFFSET_PX;
  }
  return (
    <div
      style={{
        position: "absolute",
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        transform: `translate(-50%,-50%) translate(${ux * offsetPx}px, ${uy * offsetPx}px)`,
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

  const badgeArea = (
    <div style={{ minHeight: 17, display: "flex", alignItems: "center", gap: 5 }}>
      {!acting && <ActionBadge action={action} />}
    </div>
  );

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
          <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", ...num }}>{stack != null ? formatStack(stack) : stack} bb</span>
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

// Badge de SPR — antes vivia como linha de texto dentro da caixa de
// ruas (acima da mesa). Pedido explicito: mover pra DENTRO do layout
// da mesa, no espaço preto da moldura (canto superior esquerdo, fora
// do oval do feltro — mesma área onde ficaria um HUD de replayer
// tradicional). Ancorado no wrapper externo do PokerTable (fora do
// container com overflow:hidden do feltro), pra nunca ser clipado.
function SprBadge({ spr }: { spr: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 6,
        display: "flex",
        alignItems: "baseline",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 8,
        fontFamily: F,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        pointerEvents: "none",
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: TEXT.decorative }}>SPR</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: TEXT.secondary, ...num }}>{spr}</span>
    </div>
  );
}

export function PokerTable({
  hand,
  seats,
  onStreetClick,
  chipAnimation,
  streetCommitments,
  variant = "replay",
}: {
  hand: TableHand | null;
  seats: SeatLayoutSlot[];
  onStreetClick?: (streetIndex: number) => void;
  chipAnimation?: { fromPosLabel: string; amount: number; key: string | number } | null;
  streetCommitments?: Record<string, number>;
  variant?: TableVariant;
}) {
  const active = !!hand;
  const history = hand?.history || [];
  const hasHistory = history.length > 0;
  const seatData = (p: string): SeatState => (hand?.seats && hand.seats[p]) || { status: "empty" };
  const chipFromSeat = chipAnimation ? seats.find((s) => s.posLabel === chipAnimation.fromPosLabel) : null;
  const felt = FELT_PALETTES[variant];

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
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

      {active && hand.spr != null && <SprBadge spr={hand.spr} />}

      {/* Caixa de ruas ("Nenhuma ação ainda" + histórico por rua) só faz
          sentido no Replayer, que tem ação real pra mostrar. No Modo
          Treino ela sempre ficava vazia (pedido explícito: "retire
          aquele quadrado... no modo treino") — a mesa ganha o espaço
          vertical que essa caixa ocupava. */}
      {active && variant === "replay" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            marginBottom: 8,
            padding: "6px 10px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            flexShrink: 0,
            background: "rgba(255,255,255,0.03)",
            minHeight: 108,
          }}
        >
          {hasHistory ? (
            history.map((h, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 20 }}>
                <span
                  onClick={onStreetClick ? () => onStreetClick(i) : undefined}
                  style={{
                    fontFamily: F,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1,
                    color: h.current ? TEXT.critical : TEXT.decorative,
                    whiteSpace: "nowrap",
                    width: 34,
                    flexShrink: 0,
                    cursor: onStreetClick ? "pointer" : "default",
                  }}
                >
                  {h.street}
                </span>
                <div style={{ display: "flex", gap: 5, overflowX: "auto", flex: 1, minWidth: 0 }}>
                  {h.actions.length === 0 ? (
                    <span style={{ fontFamily: F, fontSize: 10, color: TEXT.disabled }}>—</span>
                  ) : (
                    h.actions.map((a, j) => (
                      <span
                        key={j}
                        style={{
                          fontFamily: F,
                          fontSize: 10,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          color: POS[a.pos]?.glow,
                          opacity: h.current ? 1 : 0.65,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: `${POS[a.pos]?.base}1F`,
                          border: `1px solid ${POS[a.pos]?.base}55`,
                          ...num,
                        }}
                      >
                        {a.pos} {a.label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))
          ) : (
            <span style={{ fontFamily: F, fontSize: 11, color: TEXT.decorative }}>Nenhuma ação ainda</span>
          )}
        </div>
      )}

      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          width: "100%",
          overflow: "hidden",
          borderRadius: "50%",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "8% 1.5%",
            borderRadius: "50%",
            pointerEvents: "none",
            background: "conic-gradient(from 200deg, #4A4E55, #8A8F98, #3A3D42, #6E727A, #4A4E55)",
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "9.6% 2.6%",
            borderRadius: "50%",
            pointerEvents: "none",
            background: [
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 4px)",
              "repeating-linear-gradient(-45deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 4px)",
              "radial-gradient(circle at 50% 50%, #2A2C30 0%, #1C1D20 55%, #0E0F10 100%)",
            ].join(", "),
            boxShadow: "inset 0 0 24px rgba(0,0,0,.7)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "9.6% 2.6%",
            borderRadius: "50%",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.05,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontFamily: F,
              fontWeight: 800,
              fontSize: 46,
              letterSpacing: 4,
              color: "#FFFFFF",
              transform: "rotate(-8deg)",
              whiteSpace: "nowrap",
            }}
          >
            POKERSYNC
          </span>
        </div>

        <div
          style={{
            position: "absolute",
            inset: "9% 2%",
            borderRadius: "50%",
            background: felt.background,
            border: "2px solid #000000",
            boxShadow: [
              "0 0 0 6px #000000",
              "0 0 0 7px rgba(255,255,255,.08)",
              `0 0 40px ${felt.glow}`,
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
