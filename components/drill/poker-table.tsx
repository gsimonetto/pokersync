"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Card } from "./card";
import { F, POS, ACT, T, num } from "@/lib/poker/drill-theme";
import type { SeatLayoutSlot } from "@/lib/poker/seat-layout";
import { classifyOpponentStyle, type OpponentStats } from "@/lib/services/opponent-stats-service";

// FIX (2026-09): "me mostre como ficou no celular e em outras telas"
// revelou que cartas, placas de nome e badges de aposta (todos com
// tamanho fixo em pixel) nao cabem mais numa mesa estreita — a caixa da
// mesa trava em aspectRatio 8/5, entao numa tela de celular ela fica bem
// baixa, e tudo comecava a se sobrepor. Em vez de reescrever cada
// tamanho de fonte/padding em unidades responsivas (haveria dezenas
// espalhados pelo Seat), mede-se a largura REAL da mesa renderizada
// (ResizeObserver, direto no navegador) e aplica-se um unico fator de
// escala visual (transform:scale) em cada assento/bloco central, em
// torno do proprio centro — encolhe tudo dentro do assento junto (carta,
// placa, texto) sem mover o PONTO de ancoragem dele na mesa.
// BASE_TABLE_WIDTH_PX: largura em que 1 = tamanho "normal" (o desenho foi
// ajustado visualmente numa mesa desktop ~1400px de largura).
// MIN_SEAT_SCALE: piso de encolhimento — abaixo disso o texto vira
// ilegivel, entao a mesa aceita ficar um pouco mais apertada em vez de
// continuar encolhendo.
const BASE_TABLE_WIDTH_PX = 900;
const DEFAULT_MIN_SEAT_SCALE = 0.4;

// `minScale` (pedido pelo modo mesa-cheia do Treino no celular): o piso
// padrao (0.4) foi calibrado pra mesa cheia de assentos com carta E nome
// disputando espaco de verdade -- no modo mesa-cheia so' hero e vilao tem
// conteudo de peso (os outros 6 assentos do anel 8-max ficam vazios/
// foscos, so' o nome pequeno), entao o piso padrao encolhia hero/vilao
// mais do que precisava. Um piso mais alto (ex: 0.75) protege so' os
// assentos vazios da lateral (que ficam apertados numa mesa estreita em
// pe) sem esmagar quem de fato importa olhar.
function useSeatScale(ref: React.RefObject<HTMLElement | null>, minScale: number = DEFAULT_MIN_SEAT_SCALE) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (!width) return;
      setScale(Math.min(1, Math.max(minScale, width / BASE_TABLE_WIDTH_PX)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, minScale]);
  return scale;
}

// "8 / 5" -> 1.6 (largura / altura) -- usado pra calcular o retangulo
// que cabe na tela via cqw/cqh, ver comentario na caixa da mesa abaixo.
function parseAspectRatio(value: string): number {
  const [w, h] = value.split("/").map((part) => Number(part.trim()));
  return w > 0 && h > 0 ? w / h : 1;
}

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

// % do pote ao lado do bb -- e' assim que quem joga em nivel avancado
// pensa sizing (padrao GTOWizard/PIOSolver), bb sozinho exige fazer a
// conta de cabeca toda hora. So calcula quando ha pote de verdade pra
// dividir (pot<=0 no preflop antes de qualquer aposta, por exemplo).
function formatPotPct(size: number, pot: number): string | null {
  if (pot <= 0) return null;
  return `${Math.round((size / pot) * 100)}%`;
}

function ActionBadge({ action, pot }: { action?: SeatState["action"]; pot: number }) {
  if (!action) return null;
  const a = ACT[action.type.toLowerCase()] || ACT.check;
  const potPct = action.size ? formatPotPct(action.size, pot) : null;
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
      {potPct && <span style={{ opacity: 0.7 }}> · {potPct} pot</span>}
    </div>
  );
}

const MIN_COMMITTED_TO_SHOW = 0.5;

// Mesa retangular com cantos arredondados (pedido explicito: "mesa mais
// retangular com as bordas redondas, como o gtowizard faz") — antes era
// um oval puro (borderRadius:"50%" em todas as camadas). "50%" faria uma
// elipse achatada de novo; com raio pequeno e assimetrico entre os eixos
// (container tem aspectRatio 8/5, entao raio horizontal < vertical pra o
// canto parecer igualmente arredondado nos dois eixos) fica um retangulo
// com cantos suaves. O valor de fato usado agora vem do parametro
// `cornerRadius` de PokerTable (default "10% / 16%", ver props mais
// abaixo) — cada aspectRatio precisa do proprio par calibrado, ver
// comentario do parametro.

const TABLE_CENTER = { x: 50, y: 44 };
const COMMITTED_OFFSET_PX = 96;
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

function CommittedChip({ seat, amount, scale, heroScale = 1 }: { seat: SeatLayoutSlot; amount: number; scale: number; heroScale?: number }) {
  const dx = TABLE_CENTER.x - seat.x;
  const dy = TABLE_CENTER.y - seat.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Cartas ficam sempre acima do nome agora (nenhum seat usa mais layout
  // lateral) — a folga extra que so' valia pra cardSide "above" passa a
  // valer pra todo mundo que nao e' o hero (que ja tem seu proprio offset
  // maior, HERO_COMMITTED_OFFSET_PX).
  // offsetPx tambem escala junto (pedido explicito: "nao deixe nada
  // fixo") — numa mesa encolhida o assento fica menor, entao a distancia
  // ate a ficha precisa encolher na mesma proporcao, senao a ficha fica
  // "flutuando" longe demais do assento minusculo.
  //
  // FIX (pedido explicito: "as cartas nao podem sobrepor a aposta") --
  // faltava multiplicar por heroScale aqui: quando o heroi fica maior
  // (heroScale>1, modo mesa-cheia), as cartas dele crescem mas esse
  // offset continuava do tamanho normal, entao a ficha de aposta ficava
  // perto demais e as cartas (agora maiores) cresciam por cima dela.
  const offsetPx =
    ((seat.isHero ? HERO_COMMITTED_OFFSET_PX : COMMITTED_OFFSET_PX) + (seat.isHero ? 0 : ABOVE_SEAT_EXTRA_OFFSET_PX)) *
    scale *
    (seat.isHero ? heroScale : 1);
  return (
    <div
      style={{
        position: "absolute",
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        transform: `translate(-50%,-50%) translate(${ux * offsetPx}px, ${uy * offsetPx}px) scale(${scale})`,
        zIndex: 3,
        pointerEvents: "none",
      }}
    >
      <CommittedPill amount={amount} />
    </div>
  );
}

// Cartas sobrepostas (uma quase em cima da outra), como GGPoker e a
// maioria dos apps mobile fazem — em vez do padrao antigo lado a lado
// com espaco entre elas. A segunda carta cobre boa parte da primeira
// (overlapPx negativo) e cada carta ganha uma leve rotacao em leque, pra
// nao parecer um bloco unico colado.
//
// FIX (2026-09): rotacao pedida explicitamente igual ao GGPoker — a
// PRIMEIRA carta deitada pra ESQUERDA, a SEGUNDA deitada pra DIREITA
// (leque abrindo pros dois lados a partir do centro). A formula abaixo
// ja fazia isso matematicamente (indice mais baixo = rotacao negativa =
// gira sentido anti-horario = topo da carta pende pra esquerda), mas o
// angulo total (6deg pra 2 cartas = 3deg pra cada lado) era sutil demais
// pra ficar perceptivel — subiu pra 10deg (5deg por carta em duplas).
const CARD_OVERLAP_PX: Record<Size, number> = { board: 30, hero: 44, mini: 20 } as const;
type Size = "board" | "hero" | "mini";

function CardFan({ cards, size, fanDeg = 10 }: { cards: (string | null)[]; size: Size; fanDeg?: number }) {
  const overlap = CARD_OVERLAP_PX[size];
  return (
    <div style={{ display: "flex" }}>
      {cards.map((c, i) => (
        // Dois wrappers separados de proposito: a animacao de entrada
        // (fadeInUp) tambem mexe em `transform` (translateY), e uma
        // unica div com os dois (rotate estatico + animacao) faz o
        // keyframe da animacao GANHAR e apagar a rotacao assim que ela
        // roda — a carta ficava sempre reta, mesmo com o angulo certo no
        // codigo. Separando, cada div cuida de UM transform só.
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: i, transform: `rotate(${(i - (cards.length - 1) / 2) * fanDeg}deg)` }}>
          <div style={{ animation: "fadeInUp 260ms ease-out both", animationDelay: `${i * 60}ms` }}>
            <Card card={c} size={size} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Empurra o bloco de cartas por baixo/por tras da placa de nome+stack do
// seat (pedido explicito: "cartas precisam ficar um pouco atras do nome
// do seat") — a placa fica com zIndex maior, entao cobre uma fatia das
// cartas em vez de so ficar espremida do lado. Cartas ficam sempre ACIMA
// do nome agora (nao ha mais layout lateral), entao so existe a direcao
// "empurra pra baixo, por tras da placa".
const CARD_BEHIND_NAME_TRANSFORM = { above: "translateY(16px)" } as const;

// Silhueta de carta virada (pedido explicito: "no vilao, aparecer a
// silhueta das cartas viradas pra ele") -- so' um retangulo com contorno
// fraco, sem naipe/rank (o Card de verdade exige uma carta real pra
// desenhar). Representa "esse jogador tem mao, so' nao foi revelada"
// pros assentos vivos sem showdown -- antes esses assentos nao mostravam
// carta nenhuma, ficando ambiguo com "assento vazio".
// FIX (pedido explicito: "a silhueta do vilao precisa sobrepor a borda
// da mesa, nao pode aparecer a borda da mesa atras da carta") -- o fundo
// era quase transparente (rgba branco .05/.015), entao o contorno do
// feltro por baixo continuava visivel atraves da carta. Fundo agora e'
// SOLIDO/opaco (gradiente escuro sem alpha), do jeito que o verso de
// uma carta de baralho de verdade cobre 100% do que esta atras dele —
// so' o tom neutro (sem cor de naipe) e' o que ainda deixa claro que
// nao e' uma carta revelada.
function CardSilhouette() {
  return (
    <div
      style={{
        width: 56,
        height: 80,
        borderRadius: 6,
        border: "1.5px solid rgba(255,255,255,0.22)",
        background: [
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 5px)",
          "linear-gradient(150deg, #2C303A, #171A21)",
        ].join(", "),
        boxShadow: "0 6px 14px rgba(0,0,0,.5)",
      }}
    />
  );
}

// Mesmo leque/sobreposicao do CardFan, so' que com a silhueta acima em
// vez de cartas reais -- reusa CARD_OVERLAP_PX.board pra ficar visualmente
// identico ao par de cartas reveladas (mesmo tamanho, mesmo espacamento),
// trocando so' o conteudo interno de cada carta.
function GhostCardFan({ fanDeg = 10 }: { fanDeg?: number }) {
  const overlap = CARD_OVERLAP_PX.board;
  return (
    <div style={{ display: "flex" }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: i, transform: `rotate(${(i - 0.5) * fanDeg}deg)` }}>
          <div style={{ animation: "fadeInUp 260ms ease-out both", animationDelay: `${i * 60}ms` }}>
            <CardSilhouette />
          </div>
        </div>
      ))}
    </div>
  );
}

function Seat({
  seat, state, isDealer, pot, scale, heroScale = 1, opponentStats, onOpponentClick,
}: {
  seat: SeatLayoutSlot;
  state: SeatState;
  isDealer?: boolean;
  pot: number;
  scale: number;
  // Escala extra so' pro assento do heroi (pedido explicito: "o layout
  // do hero pode ser um pouco maior") -- multiplica em cima do `scale`
  // geral (responsivo por largura da mesa), nao o substitui.
  heroScale?: number;
  // Perfil consolidado do oponente sentado nesse assento, se ja existir
  // (Revisor de Maos) -- so' preenchido pra assentos nao-hero com
  // historico. Ausente (undefined) em qualquer outro contexto (Treino),
  // que nunca passa esses props.
  opponentStats?: OpponentStats;
  onOpponentClick?: (playerName: string) => void;
}) {
  const posCol = POS[seat.posLabel];
  const { status = "empty", stack, action, cards } = state;
  const hero = seat.isHero;
  const effectiveScale = hero ? scale * heroScale : scale;
  const acting = status === "acting";
  const empty = status === "empty";
  const revealedVillainCards = !hero && !!cards && cards.length > 0 && cards.every(Boolean);

  const col = acting ? posCol : { base: NEUTRAL, glow: NEUTRAL_GLOW };
  const opacity = SEAT_OPACITY[status];

  // Cartas sempre EM CIMA do nome do seat, pra todas as posicoes da mesa
  // (pedido explicito: "as cartas de todas as posicoes precisam ficar em
  // cima do seat, a dos viloes esta do lado, quero igual ao ggpoker" — no
  // GGPoker nao existe carta "do lado" do nome, o layout e' sempre coluna
  // vertical com as cartas por cima). Antes o layout mudava por cardSide
  // (linha horizontal pros seats dos lados esquerdo/direito da mesa) —
  // essa distincao de layout saiu; cardSide continua existindo so' pra
  // decidir a direcao do deslocamento "atras do nome" (CARD_BEHIND_NAME_
  // TRANSFORM) e da ficha de aposta (CommittedChip).
  const layout: React.CSSProperties = { flexDirection: "column", alignItems: "center", gap: hero ? 6 : 0 };

  const badgeArea = (
    <div style={{ minHeight: 17, display: "flex", alignItems: "center", gap: 5 }}>
      {!acting && <ActionBadge action={action} pot={pot} />}
    </div>
  );

  // Cor do chip de HUD por estilo de jogo do oponente -- classificado
  // pelo Aggression Factor (unico numero que ja temos que mede
  // agressividade pos-flop de forma direta): verde = dentro da faixa
  // balanceada, vermelho = agressivo, amarelo = passivo. Sem dado
  // suficiente (AF null) cai em "balanced" (verde neutro) em vez de
  // arriscar uma cor que sugira algo que a amostra nao sustenta.
  const OPPONENT_STYLE_COLOR = { aggressive: T.bad, passive: T.warn, balanced: T.ok } as const;
  const opponentStyleColor = opponentStats ? OPPONENT_STYLE_COLOR[classifyOpponentStyle(opponentStats)] : T.ok;

  // Chip de HUD com o perfil do oponente -- pedido explicito: entre a
  // tag de posicao e a placa de nome (nao em cima da posicao). Clicavel
  // (leva pra modal com o perfil completo); o icone de info fica dentro
  // do proprio chip, que ja e' o sinal visual principal de "tem mais
  // informacao". Glow + cor da borda/numeros seguem o estilo do
  // oponente (ver OPPONENT_STYLE_COLOR acima) -- fundo continua solido
  // escuro pra manter contraste alto de leitura em qualquer cor.
  const opponentHudChip =
    !hero && opponentStats ? (
      <div
        onClick={onOpponentClick ? () => onOpponentClick(seat.playerName!) : undefined}
        title={`VPIP / PFR / 3-Bet — clique pro perfil completo de ${seat.playerName}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 9px",
          borderRadius: 999,
          fontFamily: F,
          fontSize: 11,
          fontWeight: 700,
          color: opponentStyleColor,
          background: "rgba(10,10,12,0.88)",
          border: `1px solid ${opponentStyleColor}99`,
          boxShadow: `0 0 10px ${opponentStyleColor}66, 0 3px 8px rgba(0,0,0,.55)`,
          cursor: onOpponentClick ? "pointer" : "default",
          whiteSpace: "nowrap",
          ...num,
        }}
      >
        {opponentStats.vpipPct ?? "—"}/{opponentStats.pfrPct ?? "—"}/{opponentStats.threeBetPct ?? "—"}
        <Info size={10} style={{ opacity: 0.85, flexShrink: 0 }} />
      </div>
    ) : null;

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
            fontSize: 12.5,
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

      {opponentHudChip}

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
          <span style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", ...num }}>{stack != null ? formatStack(stack) : stack} bb</span>
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
        // scale() depois do translate: primeiro centraliza a caixa do
        // assento no ponto de ancoragem (x%,y%), so' DEPOIS encolhe em
        // torno do proprio centro (transform-origin default) — o ponto
        // de ancoragem na mesa nunca se move, so' o conteudo do assento
        // (carta+placa+texto) fica menor quando a mesa e' estreita.
        transform: `translate(-50%,-50%) scale(${effectiveScale})`,
        opacity,
        filter: status === "folded" ? "grayscale(0.5)" : "none",
        transition: "opacity 220ms ease, filter 220ms ease, transform 150ms ease",
        zIndex: acting ? 5 : 2,
        animation: acting ? "seatPulse 2s ease-in-out infinite" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", ...layout }}>
        {hero ? (
          <>
            {cards && cards.length > 0 && (
              <div style={{ position: "relative", zIndex: 1, transform: CARD_BEHIND_NAME_TRANSFORM.above }}>
                <CardFan cards={cards} size="board" />
              </div>
            )}
            <div style={{ position: "relative", zIndex: 2 }}>{seatInfo}</div>
          </>
        ) : (
          (() => {
            // Silhueta de cartas viradas (pedido explicito) — qualquer
            // assento vivo (nao vazio, nao folded) sem showdown ganha o
            // "par de costas de carta" fraco, deixando claro que ele
            // tem mao na jogada em vez de sumir sem carta nenhuma.
            const showGhostCards = !revealedVillainCards && !empty && status !== "folded";
            const cardsBlock = revealedVillainCards ? (
              <div style={{ position: "relative", zIndex: 1, transform: CARD_BEHIND_NAME_TRANSFORM.above }}>
                <CardFan cards={cards!} size="board" />
              </div>
            ) : showGhostCards ? (
              // FIX (pedido explicito): sem opacity aqui -- opacity no
              // wrapper deixava o FUNDO da carta (ja opaco, ver
              // CardSilhouette) semitransparente de novo, voltando a
              // mostrar a borda do feltro atras dela. O tom "apagado"
              // vem so' das cores internas da silhueta, nao de
              // transparencia no bloco inteiro.
              <div style={{ position: "relative", zIndex: 1, transform: CARD_BEHIND_NAME_TRANSFORM.above }}>
                <GhostCardFan />
              </div>
            ) : null;
            const seatInfoLayered = <div style={{ position: "relative", zIndex: 2 }}>{seatInfo}</div>;
            // Cartas sempre antes (em cima) do bloco de nome/stack,
            // independente de onde o seat fica na mesa.
            return (
              <>
                {cardsBlock}
                {seatInfoLayered}
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
  scale,
}: {
  fromSeat: SeatLayoutSlot;
  amount: number;
  animKey: string | number;
  scale: number;
}) {
  const dx = TABLE_CENTER.x - fromSeat.x;
  const dy = TABLE_CENTER.y - fromSeat.y;
  return (
    // Dois niveis, mesmo motivo do CardFan: a animacao chipTravel ja mexe
    // em `transform` (translate+scale) nos seus proprios keyframes — numa
    // unica div, esse `scale(seatScale)` estatico seria apagado assim que
    // a animacao comeca a rodar. O externo (sem tamanho proprio, so' o
    // ponto de ancoragem) fica com a posicao + escala da mesa; o interno
    // fica com a animacao de viagem da ficha, sem mudar nada nela.
    <div
      key={animKey}
      style={{
        position: "absolute",
        left: `${fromSeat.x}%`,
        top: `${fromSeat.y}%`,
        transform: `scale(${scale})`,
        zIndex: 4,
        pointerEvents: "none",
        ["--chip-dx" as string]: `${dx}%`,
        ["--chip-dy" as string]: `${dy}%`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
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
    </div>
  );
}

// Badge de SPR — fica ACIMA das cartas do board, dentro do bloco
// central da mesa (pedido explícito: "informação do SPR em cima das
// cartas pra ficar visível"). Posicionado no fluxo do stack central em
// vez de absoluto no canto: no canto ele era cortado pelo oval do
// feltro em telas menores, e ficava longe da leitura natural do
// jogador, que olha pro board.
function SprBadge({ spr }: { spr: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        padding: "3px 11px",
        borderRadius: 999,
        fontFamily: F,
        background: "rgba(0,0,0,0.62)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 3px 10px rgba(0,0,0,.5)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: TEXT.decorative }}>SPR</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: TEXT.critical, ...num }}>{spr}</span>
    </div>
  );
}

export function PokerTable({
  hand,
  seats,
  chipAnimation,
  streetCommitments,
  variant = "replay",
  // Retangulo deitado (8/5) por padrao -- mesa normal na tela toda em
  // qualquer contexto ate agora. O modo tela-cheia do Treino no celular
  // (pedido explicito: "mesa ocupe a tela inteira, pode ser um retangulo
  // vertical") precisa de um formato em pe' — em vez de duplicar todo o
  // desenho da mesa so' pra isso, a proporcao vira parametro.
  aspectRatio = "8 / 5",
  // Piso do auto-encolhimento por largura (ver useSeatScale acima) --
  // ajustavel pra contextos onde os assentos "peso leve" (vazios/foscos)
  // sao maioria, como o modo mesa-cheia do Treino (anel 8-max, so' hero e
  // vilao com conteudo de verdade).
  minSeatScale,
  // Multiplicador extra so' pro assento do heroi -- ver Seat.heroScale.
  heroScale = 1,
  // FIX (pedido explicito: "melhorar formato da mesa, nao pode ter
  // aquela 'ponta' em cima e embaixo") -- "10% / 16%" foi calibrado pro
  // retangulo DEITADO (8/5): nessa proporcao, 10% da LARGURA e 16% da
  // ALTURA dao o MESMO raio em pixel nos dois eixos (10*1.6=16), corner
  // redondo de verdade. Aplicado direto num retangulo EM PE (3/5, bem
  // mais alto que largo) o mesmo "16%" vira um raio vertical enorme em
  // pixel — os 4 cantos quase se encontram no meio da borda de cima/
  // baixo (que e' curta), formando aquele bico/ponta em vez de uma
  // curva suave. Cada aspectRatio precisa do proprio par calibrado;
  // culpa de quem desenha a mesa nessa proporcao passar o valor certo.
  cornerRadius = "10% / 16%",
  // Perfil dos oponentes sentados na mesa, por nome (Revisor de Maos) --
  // ausente em qualquer outro consumidor (Treino), que so' desenha
  // ranges GTO e nao tem esse conceito.
  opponentStats,
  onOpponentClick,
}: {
  hand: TableHand | null;
  seats: SeatLayoutSlot[];
  chipAnimation?: { fromPosLabel: string; amount: number; key: string | number } | null;
  streetCommitments?: Record<string, number>;
  variant?: TableVariant;
  aspectRatio?: string;
  minSeatScale?: number;
  heroScale?: number;
  cornerRadius?: string;
  opponentStats?: Record<string, OpponentStats>;
  onOpponentClick?: (playerName: string) => void;
}) {
  const active = !!hand;
  const seatData = (p: string): SeatState => (hand?.seats && hand.seats[p]) || { status: "empty" };
  const chipFromSeat = chipAnimation ? seats.find((s) => s.posLabel === chipAnimation.fromPosLabel) : null;
  const felt = FELT_PALETTES[variant];
  const tableBoxRef = useRef<HTMLDivElement>(null);
  const seatScale = useSeatScale(tableBoxRef, minSeatScale);
  const aspectRatioValue = parseAspectRatio(aspectRatio);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "100%",
        minHeight: 0,
        // FIX (2026-09): ver comentario na caixa da mesa logo abaixo --
        // "containerType: size" habilita as unidades cqw/cqh, que sao a
        // base do calculo que corrige o achatamento em tela de notebook.
        containerType: "size",
      }}
    >
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

      {/* SPR agora é renderizado no bloco central, acima do board. */}

      {/* Caixa de ruas removida (pedido explícito: "na mesa, tirar as
          ruas — aquilo está mais atrapalhando do que ajudando"). A
          navegação passo a passo continua pelos controles de
          anterior/play/próximo abaixo da mesa — só o histórico textual
          por rua saiu, igual já tinha sido feito no Modo Treino. */}

      {/* aspectRatio fixo -- antes a mesa era so' "flex:1; width:100%",
          esticando pra qualquer proporcao que a caixa disponivel tivesse
          (bug reportado: "mesa esticada"). Com proporcao travada e auto
          margins, ela sempre desenha uma oval de mesa de verdade, do
          maior tamanho que couber sem estourar largura nem altura. */}
      <div
        style={{
          position: "relative",
          flex: "0 1 auto",
          // FIX (2026-09): "desalinhado na tela do notebook" -- com
          // width:100% fixo, o navegador calculava a altura pelo
          // aspectRatio a PARTIR da largura, e so' DEPOIS aplicava
          // maxHeight -- numa tela mais baixa que larga (notebook), isso
          // cortava a altura sem encolher a largura junto, achatando a
          // mesa e descolando cartas/badges (com tamanho fixo em px) das
          // posicoes que deveriam ocupar. `cqw`/`cqh` (unidades de
          // container, habilitadas pelo containerType:"size" no pai)
          // medem a largura/altura REAIS disponiveis; width = o menor
          // entre "100% da largura" e "altura disponivel * proporcao"
          // -- exatamente o maior retangulo 8/5 que cabe nos dois eixos
          // ao mesmo tempo, tipo um <img style="object-fit:contain">.
          width: `min(100cqw, ${aspectRatioValue * 100}cqh)`,
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio,
          margin: "auto",
          overflow: "hidden",
          borderRadius: cornerRadius,
        }}
        ref={tableBoxRef}
      >
        <div
          style={{
            position: "absolute",
            inset: "2% 1.5%",
            borderRadius: cornerRadius,
            pointerEvents: "none",
            background: "conic-gradient(from 200deg, #4A4E55, #8A8F98, #3A3D42, #6E727A, #4A4E55)",
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "3.4% 2.6%",
            borderRadius: cornerRadius,
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
            inset: "3.4% 2.6%",
            borderRadius: cornerRadius,
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
            inset: "2.8% 2%",
            borderRadius: cornerRadius,
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
              borderRadius: cornerRadius,
              pointerEvents: "none",
              background: "radial-gradient(55% 35% at 50% 25%, rgba(255,255,255,.09), transparent 70%)",
            }}
          />
          <div style={{ position: "absolute", inset: "3%", borderRadius: cornerRadius, pointerEvents: "none", border: "1px solid rgba(255,255,255,.06)" }} />
        </div>

        {/* FIX (2026-09): desceu de 44% pra 48% — com cartas SEMPRE em cima
            do nome (mudanca recente), o assento que cai bem no topo-centro
            da mesa (BB-max com n par: UTG+1 no 8-max, CO no 6-max) tinha o
            bloco de cartas+nome colidindo com o badge de SPR, que ficava
            colado logo abaixo desse ponto. Descer o bloco central da mesa
            um pouco abre esse respiro sem precisar encolher as cartas. */}
        <div style={{ position: "absolute", left: "50%", top: "53%", transform: `translate(-50%,-50%) scale(${seatScale})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 3 }}>
          {active && hand ? (
            <>
              {hand.spr != null && <SprBadge spr={hand.spr} />}
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
            pot={hand?.pot ?? 0}
            scale={seatScale}
            heroScale={heroScale}
            opponentStats={s.playerName ? opponentStats?.[s.playerName] : undefined}
            onOpponentClick={onOpponentClick}
          />
        ))}

        {seats.map((s) => {
          const amt = streetCommitments?.[s.posLabel];
          if (!amt || amt < MIN_COMMITTED_TO_SHOW) return null;
          return <CommittedChip key={`bet-${s.posLabel}`} seat={s} amount={amt} scale={seatScale} heroScale={heroScale} />;
        })}

        {chipAnimation && chipFromSeat && chipAnimation.amount > 0 && (
          <ChipAnimation fromSeat={chipFromSeat} amount={chipAnimation.amount} animKey={chipAnimation.key} scale={seatScale} />
        )}
      </div>
    </div>
  );
}
