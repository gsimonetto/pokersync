import { T, F, SUITS, num } from "@/lib/poker/drill-theme";

/* <Card card="Ah" />            carta aberta
   <Card card={null} />          slot vazio (board nao distribuido)
   <Card card="7s" size="hero"/> carta do heroi (maior)
   card: string RANK+NAIPE minusculo — "Ah", "Td", "5c", "Ks".
   Figuras (J/Q/K) exibem naipe, sem ilustracao — regra do projeto. */

const SIZES = {
  board: { w: 50, h: 71, rank: 18, suit: 27 },
  hero: { w: 58, h: 82, rank: 21, suit: 32 },
  mini: { w: 34, h: 48, rank: 13, suit: 18 },
};

export function Card({ card, size = "board" }: { card: string | null; size?: keyof typeof SIZES }) {
  const s = SIZES[size] || SIZES.board;

  if (!card) {
    return (
      <div
        aria-hidden="true"
        style={{ width: s.w, height: s.h, borderRadius: 9, border: `1px dashed ${T.line}`, background: "rgba(255,255,255,.02)" }}
      />
    );
  }

  const rank = card.slice(0, -1);
  const su = SUITS[card.slice(-1).toLowerCase()];
  if (!su) return null;

  return (
    <div
      role="img"
      aria-label={`${rank}${su.g}`}
      style={{
        width: s.w,
        height: s.h,
        borderRadius: 9,
        position: "relative",
        overflow: "hidden",
        fontFamily: F,
        color: su.c,
        background: "linear-gradient(160deg,#FFFFFF 0%,#F2F6FA 55%,#E4EBF2 100%)",
        boxShadow: "0 8px 18px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.9) inset",
      }}
    >
      <span style={{ position: "absolute", top: 4, left: 6, fontSize: s.rank, fontWeight: 800, lineHeight: 1, ...num }}>
        {rank}
      </span>
      <span style={{ position: "absolute", top: s.rank + 5, left: 7, fontSize: Math.round(s.rank * 0.66) }}>{su.g}</span>
      <span style={{ position: "absolute", right: 6, bottom: 5, fontSize: s.suit, opacity: 0.9 }}>{su.g}</span>
    </div>
  );
}

// Par virado em leque. O wrapper tem padding proprio e usa drop-shadow
// em vez de overflow, entao a rotacao nunca corta a carta.
export function CardBackPair({ side = "right" }: { side?: "left" | "right" }) {
  const back = (rot: number, overlap: boolean, key: number) => (
    <div
      key={key}
      style={{
        width: 24,
        height: 34,
        borderRadius: 5,
        transform: `rotate(${rot}deg)`,
        marginLeft: overlap ? -8 : 0,
        position: "relative",
        background: "linear-gradient(150deg,#1E3A5F,#16324F 50%,#0E2338)",
        boxShadow: "0 4px 10px rgba(0,0,0,.6), 0 0 0 1px rgba(120,180,255,.28) inset",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 4,
          borderRadius: 3,
          border: "1px solid rgba(120,180,255,.22)",
          background: "repeating-linear-gradient(45deg,rgba(120,180,255,.10) 0 2px,transparent 2px 4px)",
        }}
      />
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", padding: 4 }}>
      {back(side === "left" ? 8 : -8, false, 0)}
      {back(side === "left" ? -6 : 6, true, 1)}
    </div>
  );
}
