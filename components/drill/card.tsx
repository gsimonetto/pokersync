import { T, F, SUITS, num } from "@/lib/poker/drill-theme";

/* <Card card="Ah" />            carta aberta
   <Card card={null} />          slot vazio (board nao distribuido)
   <Card card="7s" size="hero"/> carta do heroi (maior)
   card: string RANK+NAIPE minusculo — "Ah", "Td", "5c", "Ks".

   Layout (2026-08 v4): UM unico padrao pra todas as cartas — naipe grande
   centralizado + rank+naipe empilhados no canto top-left e rotado 180 no
   bottom-right. Sem pips arranjados, sem ilustracao de figura. Escolha
   deliberada:
   - Consistencia: 2 e A tem o mesmo tratamento visual, so muda a letra
     no canto — leitura instantanea, sem "modos" diferentes na mesma mao.
   - Cabimento: cartas do board tem so 50x71px; pips espremidos tinham
     ma legibilidade a distancia, o naipe grande e' visivel de longe.
   - Alinhamento com design system do PokerSync ("componentes minimalistas
     com naipe central"). */

const SIZES = {
  board: { w: 50, h: 71, rank: 15, cornerSuit: 11, bigCenter: 34 },
  // Hero maior — pedido explicito de aumentar mais uma vez. De 58x82
  // pra 72x100: quase 40% maior que a carta comunitaria, destaque de
  // "essas sao as suas cartas" sem precisar de rotacao ou selo extra.
  hero: { w: 72, h: 100, rank: 22, cornerSuit: 16, bigCenter: 48 },
  mini: { w: 34, h: 48, rank: 11, cornerSuit: 8, bigCenter: 22 },
};

type Size = keyof typeof SIZES;

function SuitCenter({ suitGlyph, size }: { suitGlyph: string; size: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <span style={{ fontSize: size, lineHeight: 1, fontFamily: F }}>{suitGlyph}</span>
    </div>
  );
}

function CornerMark({
  rank, suitGlyph, rankSize, suitSize, position,
}: {
  rank: string;
  suitGlyph: string;
  rankSize: number;
  suitSize: number;
  position: "tl" | "br";
}) {
  const style: React.CSSProperties =
    position === "tl"
      ? { top: 4, left: 5, alignItems: "flex-start" }
      : { bottom: 4, right: 5, alignItems: "flex-end", transform: "rotate(180deg)" };
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        lineHeight: 1,
        fontFamily: F,
        ...style,
      }}
    >
      {/* rank == "T" e' 10 no vocabulario interno (parser usa 1 char). No
          canto exibimos "10" mesmo pra caber e ser reconhecivel. */}
      <span style={{ fontSize: rankSize, fontWeight: 500, ...num }}>{rank === "T" ? "10" : rank}</span>
      <span style={{ fontSize: suitSize, marginTop: 1 }}>{suitGlyph}</span>
    </div>
  );
}

export function Card({ card, size = "board" }: { card: string | null; size?: Size }) {
  const s = SIZES[size] || SIZES.board;
  if (!card) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: s.w,
          height: s.h,
          borderRadius: 6,
          border: `1px dashed ${T.line}`,
          background: "rgba(255,255,255,.02)",
        }}
      />
    );
  }
  const rank = card.slice(0, -1);
  const suitKey = card.slice(-1).toLowerCase();
  const su = SUITS[suitKey];
  if (!su) return null;

  // Baralho 4 cores (four-color deck) — padrao em replayers e clients
  // online (PokerStars, GGPoker, Hand2Note, PokerTracker). Pedido
  // explicito (2026-08 v5): fundo da carta na cor do naipe, naipe e
  // numero em BRANCO — inverte o padrao anterior (fundo claro + texto
  // colorido). Tons mantidos escuros o suficiente pra branco ter
  // contraste confortavel (WCAG AA) em todos os 4.
  const FOUR_COLOR: Record<string, string> = {
    s: "#1A1A1A", // espadas — quase preto
    h: "#B91C1C", // copas — vermelho
    d: "#1D4E89", // ouros — azul marinho escuro
    c: "#1E6B45", // paus — verde floresta escuro
  };
  const bgColor = FOUR_COLOR[suitKey] ?? "#1A1A1A";

  return (
    <div
      role="img"
      aria-label={`${rank}${su.g}`}
      style={{
        width: s.w,
        height: s.h,
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",
        fontFamily: F,
        color: "#FFFFFF",
        background: bgColor,
        boxShadow: "0 8px 18px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.12) inset",
      }}
    >
      <CornerMark rank={rank} suitGlyph={su.g} rankSize={s.rank} suitSize={s.cornerSuit} position="tl" />
      <SuitCenter suitGlyph={su.g} size={s.bigCenter} />
      <CornerMark rank={rank} suitGlyph={su.g} rankSize={s.rank} suitSize={s.cornerSuit} position="br" />
    </div>
  );
}

// Par virado em leque. Mantido — o design do verso ja e' bom e nao foi
// alvo do redesign. O wrapper tem padding proprio e usa drop-shadow em
// vez de overflow, entao a rotacao nunca corta a carta.
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
