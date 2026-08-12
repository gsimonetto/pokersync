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

// Fix (2026-08): o glyph de ouros (♦) estava aparecendo "colado"/maior
// que os demais naipes em algumas combinacoes de fonte/navegador. Causa:
// caracteres de naipe (U+2660-2666) nao tem presentation definida — o
// sistema pode escolher renderizar como emoji colorido (metricas maiores,
// padding proprio) em vez de glifo de texto, dependendo da fonte
// disponivel. Anexar o seletor de variacao de TEXTO (U+FE0E) forca a
// apresentacao monocromatica/compacta em todos os naipes, igualando o
// tamanho real entre eles — resolve o "grudamento" sem precisar tocar
// no dicionario de naipes (drill-theme.ts).
function textGlyph(glyph: string): string {
  return `${glyph}\uFE0E`;
}

// Fix (2026-08 v6): "valor da carta sumiu" no HalfCard. Causa: o naipe
// central sempre centralizava no meio da altura TOTAL da carta (48px no
// tamanho "mini"), mas o HalfCard corta visualmente o container pra so
// 52% dessa altura (~25px) via overflow:hidden — o naipe ficava bem na
// linha de corte, sobrando so um fiapo de 1px visivel (parecia ter
// sumido). Agora o centro vertical do naipe e' configuravel (`top`) pra
// cada contexto poder centralizar dentro da area de fato visivel.
function SuitCenter({ suitGlyph, size, top = "50%" }: { suitGlyph: string; size: number; top?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top,
        transform: "translateY(-50%)",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <span style={{ fontSize: size, lineHeight: 1, fontFamily: F }}>{textGlyph(suitGlyph)}</span>
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
  // Fix (2026-08 v2): ranks de 2 digitos ("10") ficavam visualmente mais
  // "pesados" que ranks de 1 char (K, A, Q, J) no mesmo tamanho de fonte —
  // em cartas pequenas isso reduzia o respiro ate o naipe central e dava
  // impressao de canto "colado". Encolhe soh o "10" um pouco (14%) e
  // aperta o letter-spacing, igualando o peso visual aos demais ranks.
  const isDoubleDigit = rank === "T";
  const style: React.CSSProperties =
    position === "tl"
      ? { top: 5, left: 6, alignItems: "flex-start" }
      : { bottom: 5, right: 6, alignItems: "flex-end", transform: "rotate(180deg)" };
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
      <span
        style={{
          fontSize: isDoubleDigit ? rankSize * 0.86 : rankSize,
          fontWeight: 500,
          letterSpacing: isDoubleDigit ? -0.4 : 0,
          ...num,
        }}
      >
        {rank === "T" ? "10" : rank}
      </span>
      <span style={{ fontSize: suitSize, marginTop: 2, lineHeight: 1 }}>{textGlyph(suitGlyph)}</span>
    </div>
  );
}

export function Card({
  card, size = "board", hideCenterSuit = false, hideCorners = false, hideBottomRightCorner = false, centerSuitTop,
}: {
  card: string | null;
  size?: Size;
  hideCenterSuit?: boolean;
  hideCorners?: boolean;
  // So esconde o canto inferior-direito, mantendo o superior-esquerdo
  // (com rank+naipe) visivel. Usado na miniatura cortada pela metade —
  // o canto inferior-direito fica perto da borda de baixo do card,
  // que e' exatamente onde o corte acontece, sobrando um fragmento
  // rotacionado 180deg (bug reportado: "rei de ponta cabeca"). O canto
  // superior-esquerdo nao tem esse problema (esta todo dentro da area
  // visivel), entao mantem-lo devolve o valor da carta pro usuario.
  hideBottomRightCorner?: boolean;
  // Centro vertical do naipe grande, em % da altura TOTAL da carta.
  // Default "50%" (meio da carta inteira). Contextos que cortam o card
  // visualmente (ex: HalfCard) devem passar o centro da area VISIVEL,
  // nao da carta inteira — ver HalfCard abaixo.
  centerSuitTop?: string;
}) {
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
      {!hideCorners && <CornerMark rank={rank} suitGlyph={su.g} rankSize={s.rank} suitSize={s.cornerSuit} position="tl" />}
      {!hideCenterSuit && <SuitCenter suitGlyph={su.g} size={s.bigCenter} top={centerSuitTop} />}
      {!hideCorners && !hideBottomRightCorner && (
        <CornerMark rank={rank} suitGlyph={su.g} rankSize={s.rank} suitSize={s.cornerSuit} position="br" />
      )}
    </div>
  );
}

// CardBackPair (imagem do verso das cartas viradas) removido a pedido
// explicito (2026-08 v6): "esta gerando mais transtorno do que ajudando".
// Vilao sem cartas reveladas agora simplesmente nao mostra nenhuma carta
// (so o seatInfo), em vez de um placeholder de verso.

// Mini-carta cortada pela metade (mostra so o topo) — usada em listagens
// compactas (ex: preview do hero na lista de maos do Revisor) onde nao ha
// espaco pra carta inteira mas o rank+naipe do canto ja identifica a carta.
// Reusa o mesmo Card (mesmas cores/glyphs), so corta visualmente via
// overflow:hidden num container mais baixo — nao duplica estilo.
export function HalfCard({ card }: { card: string }) {
  const s = SIZES.mini;
  const visibleH = Math.round(s.h * 0.52);
  return (
    <div style={{ width: s.w, height: visibleH, overflow: "hidden", borderRadius: 6, flexShrink: 0 }}>
      {/* Fix (valor da carta sumiu no HalfCard): trocado hideCorners por
          hideBottomRightCorner. O canto superior-esquerdo (rank+naipe)
          esta totalmente dentro da area visivel do corte (visibleH),
          entao pode ficar visivel sem risco do artefato de "carta de
          ponta cabeca" — esse artefato so acontecia com o canto
          inferior-direito, que fica perto da linha de corte. Mantem
          naipe central grande (SuitCenter) + rank/naipe do canto:
          "valor da carta e naipe central, apenas isso". */}
      <Card
        card={card}
        size="mini"
        hideBottomRightCorner
        centerSuitTop={`${(visibleH / 2 / s.h) * 100}%`}
      />
    </div>
  );
}
