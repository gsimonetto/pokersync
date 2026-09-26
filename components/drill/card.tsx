"use client";

import { T } from "@/lib/poker/drill-theme";
import { usePreferenciasMesa, type Baralho, type EstiloCartaPref } from "@/lib/hooks/use-preferencias-mesa";
import { CartaEstilo } from "@/components/drill/carta-estilos";

const RANK_ORDER = "23456789TJQKA";

// Ordena um par de cartas (hole cards) da MAIOR pra MENOR -- pedido
// explicito: "as cartas sempre devem ser na ordem: maior para o menor".
// So' usar em cartas de JOGADOR (hero/vilao) -- NUNCA no board, cuja
// ordem (flop/turn/river) e' temporal e nao pode ser mexida.
export function sortCardsDesc<T extends string | null>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    return RANK_ORDER.indexOf(b[0]) - RANK_ORDER.indexOf(a[0]);
  });
}

/* <Card card="Ah" />            carta aberta
   <Card card={null} />          slot vazio (board nao distribuido)
   <Card card="7s" size="hero"/> carta do heroi (maior)
   card: string RANK+NAIPE minusculo — "Ah", "Td", "5c", "Ks".

   O desenho vem de CartaEstilo (carta-estilos.tsx), no estilo escolhido
   nas Configurações (pedido explícito): Cor Sólida Premium (padrão),
   Clássico de Cassino ou Índice Jumbo. Todos seguem as mesmas regras de
   leitura: baralho de 4 (ou 2) cores, sem figura em K/Q/J, canto de
   baixo sem girar o número (6 e 9 girados são idênticos) e índice
   maior nas cartas pequenas. */

// Largura de cada tamanho (a altura sai da proporção de carta de pôquer,
// 100 x 143): board 56x80, herói 64x92, vilão 46x66, mini 34x49.
// heroCelular 50x72: herói no celular, onde o assento dele já é ampliado
// (heroScale) -- com "hero" as duas cartas lado a lado ficavam enormes
// perto do board e cobriam o vizinho (pedido explícito: "no celular as
// cartas ficaram muito grande").
const LARGURA = { board: 56, hero: 64, heroCelular: 50, mini: 34, villain: 46 } as const;
type Size = keyof typeof LARGURA;
export const alturaDaCarta = (size: Size) => Math.round((LARGURA[size] * 143) / 100);

export function Card({
  card,
  size = "board",
  baralho,
  estilo,
}: {
  card: string | null;
  size?: Size;
  // Força um baralho / estilo (prévias lado a lado nas Configurações);
  // sem isso vale a escolha salva.
  baralho?: Baralho;
  estilo?: EstiloCartaPref;
}) {
  const preferencias = usePreferenciasMesa();
  const largura = LARGURA[size] ?? LARGURA.board;
  if (!card) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: largura,
          height: alturaDaCarta(size),
          borderRadius: 6,
          border: `1px dashed ${T.line}`,
          background: "rgba(255,255,255,.02)",
        }}
      />
    );
  }
  if (!"shdc".includes(card.slice(-1).toLowerCase())) return null;
  return <CartaEstilo card={card} estilo={estilo ?? preferencias.carta} largura={largura} baralho={baralho ?? preferencias.baralho} />;
}

// CardBackPair (imagem do verso das cartas viradas) removido a pedido
// explicito (2026-08 v6): "esta gerando mais transtorno do que ajudando".
// Vilao sem cartas reveladas agora simplesmente nao mostra nenhuma carta
// (so o seatInfo), em vez de um placeholder de verso.

// Carta cortada (mostra so o topo) — usada em listagens compactas (ex:
// preview do hero na lista de maos do Revisor) onde nao ha altura pra
// carta inteira, mas o indice do canto ja identifica a carta. Reusa a
// mesma carta, so corta visualmente via overflow:hidden. 68% da altura
// (pedido explicito: "aumente um pouco a parte cortada, mostrando mais
// do naipe").
export function HalfCard({ card, size = "mini" }: { card: string; size?: Size }) {
  const visibleH = Math.round(alturaDaCarta(size) * 0.68);
  return (
    <div
      style={{
        width: LARGURA[size],
        height: visibleH,
        overflow: "hidden",
        borderRadius: 6,
        flexShrink: 0,
        // Borda preta solida (pedido explicito: "igual na mesa").
        border: "2px solid #000000",
        boxSizing: "content-box",
      }}
    >
      <Card card={card} size={size} />
    </div>
  );
}
