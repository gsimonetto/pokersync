"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Info, Target, Trophy } from "lucide-react";
import { Card, alturaDaCarta, sortCardsDesc } from "./card";
import { PilhaFichas, quebrarEmFichas } from "./ficha-americana";
import { VooDeFichas, duracaoDoVoo, type Ponto, type Voo } from "./voo-fichas";
import { F, POS, ACT, num } from "@/lib/poker/drill-theme";
import type { SeatLayoutSlot } from "@/lib/poker/seat-layout";
import type { OpponentStats } from "@/lib/services/opponent-stats-service";
import { usePreferenciasMesa, type CorFeltro, type EstiloMesa, type UnidadeValor, type VelocidadeAnimacao } from "@/lib/hooks/use-preferencias-mesa";

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
// Telas grandes (pedido explícito: "todas responsivas em todo tipo de
// tela"): antes o tamanho travava em 1 e, num monitor grande, a mesa
// crescia e os assentos/cartas ficavam miúdos no meio dela. Agora
// acompanham a mesa até 2x (monitor 2K/4K).
const MAX_SEAT_SCALE = 2;
// Mesa em pé (3/5, celular e tablet): a escala por largura (largura/900)
// deixava tudo miúdo no tablet em pé, com a mesa enorme. Aqui ela vai do
// piso (celular, mesa até ~430px) até 1 numa mesa de tablet (~580px).
const RETRATO_MAX_ASPECTO = 0.61;
const RETRATO_LARGURA_PISO = 260;
const RETRATO_LARGURA_CHEIA = 580;

function escalaDaMesa(largura: number, aspecto: number, minScale: number): number {
  if (aspecto <= RETRATO_MAX_ASPECTO) {
    const bruta = (largura - RETRATO_LARGURA_PISO) / (RETRATO_LARGURA_CHEIA - RETRATO_LARGURA_PISO);
    return Math.min(1, Math.max(minScale, bruta));
  }
  return Math.min(MAX_SEAT_SCALE, Math.max(minScale, largura / BASE_TABLE_WIDTH_PX));
}

// `minScale` (pedido pelo modo mesa-cheia do Treino no celular): o piso
// padrao (0.4) foi calibrado pra mesa cheia de assentos com carta E nome
// disputando espaco de verdade -- no modo mesa-cheia so' hero e vilao tem
// conteudo de peso (os outros 6 assentos do anel 8-max ficam vazios/
// foscos, so' o nome pequeno), entao o piso padrao encolhia hero/vilao
// mais do que precisava. Um piso mais alto (ex: 0.75) protege so' os
// assentos vazios da lateral (que ficam apertados numa mesa estreita em
// pe) sem esmagar quem de fato importa olhar.
// Também devolve o tamanho da mesa em pixel -- as fichas voando (ver
// voo-fichas.tsx) andam em pixel entre pontos medidos na mesa.
function useSeatScale(ref: React.RefObject<HTMLElement | null>, aspecto: number, minScale: number = DEFAULT_MIN_SEAT_SCALE) {
  const [medida, setMedida] = useState({ scale: 1, largura: 0, altura: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const caixa = entries[0]?.contentRect;
      if (!caixa?.width) return;
      setMedida({ scale: escalaDaMesa(caixa.width, aspecto, minScale), largura: caixa.width, altura: caixa.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, aspecto, minScale]);
  return medida;
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
  // Bounty ("cabeça") desse jogador em torneios PKO/Mystery Bounty --
  // ausente fora desse formato (ver ParsedSeat.bountyValue).
  bountyValue?: number;
}

const NAME_MAX_CHARS = 12;
function truncateName(name: string): string {
  return name.length > NAME_MAX_CHARS ? `${name.slice(0, NAME_MAX_CHARS)}...` : name;
}

// Stack sempre com no máximo 1 casa decimal (pedido explícito: "21.5 no
// máximo, não mais que isso"). 21.515 -> "21,5"; 21 -> "21" (sem ",0"
// solto quando o valor já é redondo). Vírgula decimal (padrão BR) e
// "BB" maiúsculo, como as salas mostram quando o valor está em big
// blinds -- mesmo formato dos botões de ação do Treino.
function formatStack(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

// Duração das animações da mesa, na velocidade escolhida no Treino (M10):
// --ps-vel vale 1 (normal) ou menos (rápida), definido na raiz da mesa.
// "Sem animação" desliga tudo por CSS (ver data-ps-animacao em PokerTable).
function dur(ms: number): string {
  return `calc(${ms}ms * var(--ps-vel, 1))`;
}

// Sufixo dos valores da mesa: "BB" (padrão) ou nada quando a mesa está em
// fichas (opção BB/Fichas do Revisor) -- as salas mostram ficha sem sufixo.
// Os números já chegam na unidade certa (ver projectHandAtStep emFichas).
const SufixoValor = createContext<"BB" | "">("BB");

export interface HistoryStep {
  street: string;
  current?: boolean;
  actions: { pos: string; label: string }[];
}

export interface TableHand {
  pot: number;
  spr: number | null;
  // Diante de uma aposta: quanto de equidade você precisa pra pagar
  // (o que você paga ÷ pote final). No lugar do SPR, que quase não diz
  // nada no pré-flop.
  potOddsPct?: number | null;
  // Placar embaixo do board (Revisor), como as salas mostram no all-in e
  // no showdown: chance de vitória de cada um ("76%") enquanto o board sai,
  // e o nome da jogada no fim ("Par de Reis"), marcando quem levou o pote.
  // Fica no centro da mesa de propósito -- os assentos não mudam.
  placar?: { pos: string; voce: boolean; texto: string; vencedor?: boolean }[] | null;
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

// Cor do feltro escolhida nas Configurações (M9) -- vale pro Treino e pro
// Revisor. "padrao" = a cor de cada tela (azul no Treino, vinho no Revisor).
const FELTROS_ESCOLHIDOS: Record<Exclude<CorFeltro, "padrao">, { background: string; glow: string }> = {
  verde: {
    background: "radial-gradient(65% 75% at 50% 40%, #1E6B41 0%, #165332 30%, #0E3A22 60%, #061D11 100%)",
    glow: "rgba(34,139,84,.35)",
  },
  azul: FELT_PALETTES.treino,
  vinho: FELT_PALETTES.replay,
  grafite: {
    background: "radial-gradient(65% 75% at 50% 40%, #3A3F47 0%, #2C3037 30%, #1D2025 60%, #0D0E11 100%)",
    glow: "rgba(150,160,175,.22)",
  },
};

// Estilo da mesa (Configurações, pedido explícito): Arena (padrão) ou Luxo
// Moderno. Só muda o ACABAMENTO -- borda, textura do feltro, placas,
// fichas, pote e botão do dealer. Geometria, posições, escala no celular,
// animações e cores de posição são as mesmas nos dois.
//   Arena: mesa final de TV -- borda de couro preto com LED na cor do
//          feltro, holofote no centro, placas de vidro escuro.
//   Luxo:  borda de nogueira com veio, filete de latão, feltro camurça,
//          placas de couro, fichas bordô.
const RUIDO = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

interface TemaMesa {
  /** Borda em volta do feltro; recebe o brilho do feltro (vira o LED na Arena). */
  aro: (brilho: string) => React.CSSProperties;
  /** Ruído por cima da borda (veio da madeira). */
  aroComVeio?: boolean;
  /** Anéis logo em volta do feltro (filete). */
  feltroBorda: string[];
  /** Feltro quando a cor escolhida é "Padrão" (sem isso: a cor da tela). */
  feltroPadrao?: { background: string; glow: string };
  luz: string;
  linhaAposta: string;
  placa: { fundo: string; borda: string; nome: string; valor: string };
  pill: { fundo: string; borda: string; texto: string };
  pote: { fundo: string; borda: string; texto: string; brilho: string };
  dealer: React.CSSProperties;
}

// rgba(...,.35) -> rgba(...,.9): o brilho do feltro vira a luz do LED.
const aceso = (cor: string) => cor.replace(/[\d.]+\)$/, "0.9)");

export const TEMAS_MESA: Record<EstiloMesa, TemaMesa> = {
  arena: {
    aro: (brilho) => ({
      background: "linear-gradient(180deg, #2c2f36 0%, #111317 40%, #050506 100%)",
      boxShadow: `0 0 0 1px #000, inset 0 2px 0 rgba(255,255,255,.14), inset 0 -2px 4px rgba(0,0,0,.8), 0 0 28px -6px ${aceso(brilho)}, 0 30px 70px rgba(0,0,0,.8)`,
    }),
    feltroBorda: ["0 0 0 2px #000", "0 0 0 3.5px rgba(255,255,255,.08)"],
    luz: "radial-gradient(40% 45% at 50% 40%, rgba(255,255,255,.12), transparent 70%)",
    linhaAposta: "rgba(255,255,255,.12)",
    placa: { fundo: "linear-gradient(180deg, rgba(30,34,42,.94), rgba(10,12,15,.94))", borda: "rgba(255,255,255,.12)", nome: "rgba(255,255,255,.8)", valor: "#F5D48C" },
    pill: { fundo: "rgba(0,0,0,.75)", borda: "rgba(255,255,255,.18)", texto: "#FFFFFF" },
    pote: { fundo: "linear-gradient(180deg,#000000,#0A0A0A)", borda: "rgba(255,255,255,.20)", texto: "#FFFFFF", brilho: "0 0 20px rgba(52,211,153,.20)" },
    dealer: { background: "radial-gradient(circle at 35% 30%, #ffffff, #d9d9d9)", color: "#111111", boxShadow: "0 2px 6px rgba(0,0,0,.6)" },
  },
  luxo: {
    aro: () => ({
      background:
        "radial-gradient(120% 80% at 50% 0%, rgba(255,220,170,.25), transparent 50%), repeating-linear-gradient(95deg, #5a331b 0 3px, #6b3e22 3px 7px, #4a2914 7px 9px, #633a1f 9px 14px)",
      boxShadow: "0 30px 70px rgba(0,0,0,.85), inset 0 2px 0 rgba(255,230,190,.35), inset 0 -3px 6px rgba(0,0,0,.6), 0 0 0 1px #1a0e06",
    }),
    aroComVeio: true,
    feltroBorda: ["0 0 0 2px #C9A45C", "0 0 0 3px #5A4318"],
    feltroPadrao: {
      background: "radial-gradient(65% 75% at 50% 40%, #2C6A52 0%, #1D4D3B 35%, #123327 65%, #0A1F18 100%)",
      glow: "rgba(44,106,82,.35)",
    },
    luz: "radial-gradient(45% 50% at 50% 38%, rgba(255,240,210,.12), transparent 70%)",
    linhaAposta: "rgba(201,164,92,.35)",
    placa: { fundo: "radial-gradient(120% 120% at 30% 0%, #3a2616, #1a0f08 70%)", borda: "#8A6A32", nome: "#F5E3B8", valor: "#FFFFFF" },
    pill: { fundo: "rgba(20,12,6,.92)", borda: "#8A6A32", texto: "#F5E3B8" },
    pote: { fundo: "linear-gradient(180deg, #2a1a0e, #140c06)", borda: "#C9A45C", texto: "#F5E3B8", brilho: "0 0 18px rgba(201,164,92,.25)" },
    dealer: { background: "radial-gradient(circle at 35% 30%, #fff6de, #c9a45c)", color: "#2A1A0E", fontFamily: "Georgia, 'Times New Roman', serif", boxShadow: "0 2px 6px rgba(0,0,0,.6)" },
  },
};
const TemaCtx = createContext<TemaMesa>(TEMAS_MESA.arena);

// Fichas da mesa: Clássica Americana (ver ficha-americana.tsx), na cor
// do valor. Tamanho em pixel na mesa "normal"; encolhem junto com a mesa
// (scale dos assentos). Pedido explícito: fichas um pouco menores, pra
// não pesar no celular.
const FICHA_APOSTA_PX = 14;
const FICHA_POTE_PX = 16;
const MAX_FICHAS_APOSTA = 4;
const MAX_FICHAS_POTE = 5;
const MAX_FICHAS_VOO = 6;
// Ficha em voo nunca menor que isso: no celular a mesa encolhe tudo (~0,6x)
// e a ficha voando ficava com ~8px -- girando de lado, sumia (bug
// reportado: "tomei 4bet e não teve animação das fichas").
const FICHA_VOO_MIN_PX = 18;

// % do pote ao lado do bb -- e' assim que quem joga em nivel avancado
// pensa sizing (padrao GTOWizard/PIOSolver), bb sozinho exige fazer a
// conta de cabeca toda hora. So calcula quando ha pote de verdade pra
// dividir (pot<=0 no preflop antes de qualquer aposta, por exemplo).
function formatPotPct(size: number, pot: number): string | null {
  if (pot <= 0) return null;
  return `${Math.round((size / pot) * 100)}%`;
}

function ActionBadge({ action, pot }: { action?: SeatState["action"]; pot: number }) {
  const sufixo = useContext(SufixoValor);
  if (!action) return null;
  const a = ACT[action.type.toLowerCase()] || ACT.check;
  // All-in nao mostra "% do pote" (pedido explicito) -- o valor em bb ja
  // diz tudo que importa; a fracao do pote so faz sentido pra sizing de
  // aposta/raise normal, nao pra um all-in (que e' o stack inteiro, nao
  // uma decisao de sizing).
  const potPct = action.size && action.type !== "allin" ? formatPotPct(action.size, pot) : null;
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
        animation: `fadeInUp ${dur(200)} ease-out`,
      }}
    >
      {a.label}
      {action.size ? ` ${formatStack(action.size)}${sufixo ? ` ${sufixo}` : ""}` : ""}
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

// `atrasoMs`: quando a aposta acabou de ser feita, a pílula só aparece
// quando as fichas voando do assento chegam nela (ver voo-fichas.tsx).
function CommittedPill({ amount, atrasoMs = 0 }: { amount: number; atrasoMs?: number }) {
  const sufixo = useContext(SufixoValor);
  const { pill } = useContext(TemaCtx);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: pill.fundo,
        border: `1px solid ${pill.borda}`,
        borderRadius: 999,
        padding: "3px 10px 3px 5px",
        boxShadow: "0 3px 8px rgba(0,0,0,.5)",
        animation: `fadeInUp ${dur(220)} ease-out both`,
        animationDelay: `${atrasoMs}ms`,
        whiteSpace: "nowrap",
      }}
    >
      <div data-pilha-aposta="">
        <PilhaFichas fichas={quebrarEmFichas(amount, MAX_FICHAS_APOSTA, !sufixo)} tamanho={FICHA_APOSTA_PX} />
      </div>
      <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: pill.texto, ...num }}>
        {formatStack(amount)}
        {sufixo && <span style={{ fontSize: 11, fontWeight: 600, color: TEXT.secondary, marginLeft: 3 }}>{sufixo}</span>}
      </span>
    </div>
  );
}

// A aposta na frente do assento não pode cair em cima de outro assento,
// das cartas ou do pote. A posição de sempre (rumo ao centro) serve na
// maioria das mesas; numa mesa estreita (celular) a aposta de quem senta
// na lateral encostava no pote. Quando isso acontece, ela anda o mínimo
// possível até um espaço livre, testando em volta; entre os lugares
// livres mais perto, fica o que está mais perto do dono da aposta (pra
// continuar claro de quem ela é). Tudo em pixel de tela, medido depois
// de desenhar.
type Caixa = { left: number; top: number; right: number; bottom: number };
const FOLGA_APOSTA_PX = 3;
const PASSO_BUSCA_PX = 4;
const BUSCA_MAX_PX = 140;
const DIRECOES_BUSCA = 16;

function acharLugarLivre(base: Caixa, obstaculos: Caixa[], limite: Caixa, dono: Ponto): Ponto {
  const colide = (c: Caixa) =>
    obstaculos.some(
      (o) => c.left < o.right + FOLGA_APOSTA_PX && c.right > o.left - FOLGA_APOSTA_PX && c.top < o.bottom + FOLGA_APOSTA_PX && c.bottom > o.top - FOLGA_APOSTA_PX,
    );
  const cabe = (c: Caixa) => c.left >= limite.left && c.right <= limite.right && c.top >= limite.top && c.bottom <= limite.bottom;
  if (!colide(base)) return { x: 0, y: 0 };
  const cx = (base.left + base.right) / 2;
  const cy = (base.top + base.bottom) / 2;
  for (let dist = PASSO_BUSCA_PX; dist <= BUSCA_MAX_PX; dist += PASSO_BUSCA_PX) {
    let melhor: Ponto | null = null;
    let menor = Infinity;
    for (let k = 0; k < DIRECOES_BUSCA; k++) {
      const a = (k * 2 * Math.PI) / DIRECOES_BUSCA;
      const x = Math.round(Math.cos(a) * dist);
      const y = Math.round(Math.sin(a) * dist);
      const c = { left: base.left + x, right: base.right + x, top: base.top + y, bottom: base.bottom + y };
      if (!cabe(c) || colide(c)) continue;
      const ateDono = Math.hypot(cx + x - dono.x, cy + y - dono.y);
      if (ateDono < menor) {
        menor = ateDono;
        melhor = { x, y };
      }
    }
    if (melhor) return melhor;
  }
  return { x: 0, y: 0 };
}

// `subir` (px): o mesmo deslocamento que o assento ganha no alinhamento
// pela placa (ver Seat.centrarNaPlaca) -- a ficha acompanha o bloco do
// assento pra continuar na mesma distância das cartas dele.
function CommittedChip({
  seat,
  amount,
  scale,
  heroScale = 1,
  subir = 0,
  atrasoMs = 0,
  ajuste,
}: {
  seat: SeatLayoutSlot;
  amount: number;
  scale: number;
  heroScale?: number;
  subir?: number;
  atrasoMs?: number;
  // Empurrão (px) pra fora de cima de um assento, das cartas ou do pote
  // -- ver acharLugarLivre.
  ajuste?: Ponto;
}) {
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
  // Com as cartas lado a lado (mais largas que o antigo leque) e o herói
  // ampliado (modo celular, heroScale > 1), a ficha de quem senta na
  // metade de baixo caía em cima das cartas do herói -- ela avança mais
  // um pouco rumo ao centro nesse caso.
  const longeDoHeroi = !seat.isHero && heroScale > 1 && seat.y > 55 ? 34 : 0;
  const offsetPx =
    ((seat.isHero ? HERO_COMMITTED_OFFSET_PX : COMMITTED_OFFSET_PX) + (seat.isHero ? 0 : ABOVE_SEAT_EXTRA_OFFSET_PX) + longeDoHeroi) *
    scale *
    (seat.isHero ? heroScale : 1);
  return (
    <div
      data-aposta={seat.posLabel}
      style={{
        position: "absolute",
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        transform: `translate(-50%,-50%) translate(${ux * offsetPx + (ajuste?.x ?? 0)}px, ${uy * offsetPx - subir + (ajuste?.y ?? 0)}px) scale(${scale})`,
        zIndex: 3,
        pointerEvents: "none",
      }}
    >
      <CommittedPill amount={amount} atrasoMs={atrasoMs} />
    </div>
  );
}

// Cartas LADO A LADO, retas, com um respiro entre elas (pedido explicito:
// "quero as cartas uma ao lado da outra, vai ficar melhor a
// visualizacao"). Antes ficavam em leque, a segunda cobrindo boa parte da
// primeira -- o indice da carta de tras ficava parcialmente escondido.
const CARD_GAP_PX = 4;
type Size = "board" | "hero" | "heroCelular" | "mini" | "villain";

function CardFan({ cards, size }: { cards: (string | null)[]; size: Size }) {
  return (
    <div style={{ display: "flex", gap: CARD_GAP_PX }}>
      {cards.map((c, i) => (
        <div key={i} style={{ animation: `fadeInUp ${dur(260)} ease-out both`, animationDelay: dur(i * 60) }}>
          <Card card={c} size={size} />
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
        // Mesmo tamanho de "villain" em card.tsx (pedido explicito:
        // "diminua as cartas dos vilões... de forma sutil") -- a
        // silhueta representa a mesma carta virada do vilão que essas
        // dimensoes, so' sem rank/naipe visivel.
        width: 46,
        height: 66,
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

// Mesmo arranjo do CardFan (lado a lado), com a silhueta no lugar das
// cartas reais -- visualmente identico ao par revelado do vilao.
function GhostCardFan() {
  return (
    <div style={{ display: "flex", gap: CARD_GAP_PX }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ animation: `fadeInUp ${dur(260)} ease-out both`, animationDelay: dur(i * 60) }}>
          <CardSilhouette />
        </div>
      ))}
    </div>
  );
}

// Altura (px, antes da escala) do bloco de cartas que fica EM CIMA da
// placa do assento -- tamanhos fixos do Card: "hero" 90 de altura + os 6
// de espaço até a placa; "villain" e a silhueta virada, 66. O translateY
// que joga as cartas pra trás do nome não conta (transform não ocupa
// espaço no layout).
function alturaCartasAcima(seat: SeatLayoutSlot, state: SeatState): number {
  const { status = "empty", cards } = state;
  if (seat.isHero) return cards && cards.length > 0 ? alturaDaCarta("hero") + 6 : 0;
  const reveladas = !!cards && cards.length > 0 && cards.every(Boolean);
  const silhueta = !reveladas && status !== "empty" && status !== "folded";
  return reveladas || silhueta ? 66 : 0;
}

function Seat({
  seat, state, isDealer, pot, scale, heroScale = 1, centrarNaPlaca = false, opponentStats, onOpponentClick,
}: {
  seat: SeatLayoutSlot;
  state: SeatState;
  isDealer?: boolean;
  pot: number;
  scale: number;
  // Alinhamento pela placa (Revisor no computador): o ponto do anel fica
  // no centro de posição+placa+chip, não no centro do bloco inteiro. Sem
  // isso, quem tem cartas (em cima da placa) ficava com a placa mais
  // baixa que quem não tem -- os assentos saíam desalinhados na borda.
  // O visual do assento não muda, só onde ele encosta na mesa.
  centrarNaPlaca?: boolean;
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
  const { status = "empty", stack, action, cards, bountyValue } = state;
  const hero = seat.isHero;
  const effectiveScale = hero ? scale * heroScale : scale;
  const acting = status === "acting";
  const empty = status === "empty";
  const revealedVillainCards = !hero && !!cards && cards.length > 0 && cards.every(Boolean);

  const col = acting ? posCol : { base: NEUTRAL, glow: NEUTRAL_GLOW };
  const opacity = SEAT_OPACITY[status];
  // Metade da altura das cartas, já na escala do assento: é quanto o bloco
  // sobe pra placa (e não o bloco inteiro) ficar no ponto do anel.
  const subirPelaCarta = centrarNaPlaca ? (alturaCartasAcima(seat, state) * effectiveScale) / 2 : 0;
  const sufixo = useContext(SufixoValor);
  const tema = useContext(TemaCtx);

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

  // So' fold/check/allin viram chip fixo embaixo do jogador -- pedido
  // explicito: "retire a informação de call e raise fixa em baixo do
  // jogador, esta atrapalhando o layout, tanto do desktop quanto app".
  // Call/bet/raise tem texto de largura variavel (valor + "· X% pot"),
  // que overflow'ava o card do assento; fold/check/allin sao curtos e
  // sem esse sufixo, sem o mesmo problema. A ficha de aposta em si
  // continua aparecendo do jeito de sempre via CommittedChip (o valor em
  // bb flutuando em frente ao assento), so' esse chip fixo embaixo do
  // nome que sai pra call/bet/raise.
  const showBadge = action && (action.type === "fold" || action.type === "check" || action.type === "allin");
  const badgeArea = (
    <div style={{ minHeight: 17, display: "flex", alignItems: "center", gap: 5 }}>
      {/* key muda toda vez que a acao muda (novo fold/check/allin) --
          forca o React a remontar o chip, disparando o "fadeInUp" de novo
          em vez de so' trocar o texto sem animar (pedido explicito:
          "check/fold/allin como chips" -- o chip precisa "chegar" com a
          mesma animacao de qualquer outro chip da mesa). */}
      {!acting && showBadge && <ActionBadge key={`${action.type}-${action.size ?? ""}`} action={action} pot={pot} />}
    </div>
  );

  // Chip de HUD com o perfil do oponente -- entre a tag de posicao e a
  // placa de nome. Clicavel (leva pra modal com o perfil completo); o
  // icone de info fica dentro do proprio chip, que ja e' o sinal visual
  // principal de "tem mais informacao". Sem cor por faixa de proposito
  // (pedido explicito): so' o numero cru, sem juizo de valor embutido --
  // quem decide o que "38/22/8" significa e' o jogador, nao o produto.
  // HUD (VPIP/PFR/3-Bet no assento) removido por enquanto (pedido
  // explicito: "retirar o hud por enquanto, vamos colocar em outro
  // momento") -- fetch/props/modal continuam intactos, so' a renderizacao
  // do chip no assento fica desligada; reativar e' so' voltar a condicao
  // original abaixo.
  const HUD_ENABLED = false;
  const opponentHudChip =
    HUD_ENABLED && !hero && opponentStats ? (
      <div
        onClick={onOpponentClick ? () => onOpponentClick(seat.playerName!) : undefined}
        title={`VPIP / PFR / 3-Bet — clique pro perfil completo de ${seat.playerName}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "3px 9px",
          borderRadius: 999,
          fontFamily: F,
          fontSize: 11,
          fontWeight: 700,
          color: "#FFFFFF",
          background: "rgba(10,10,12,0.88)",
          border: "1px solid rgba(255,255,255,0.28)",
          boxShadow: "0 0 8px rgba(255,255,255,.18), 0 3px 8px rgba(0,0,0,.55)",
          cursor: onOpponentClick ? "pointer" : "default",
          whiteSpace: "nowrap",
          ...num,
        }}
      >
        {opponentStats.vpipPct ?? "—"}/{opponentStats.pfrPct ?? "—"}/{opponentStats.threeBetPct ?? "—"}
        <Info size={10} style={{ opacity: 0.7, flexShrink: 0, marginLeft: 2 }} />
      </div>
    ) : null;

  // Bounty ("cabeça") em torneios PKO/Mystery Bounty -- pedido explicito
  // (revisado 2026-09): "ainda esta sobrepondo o nome, quero que mantenha
  // bem na quina do nome mas sem sobrepor". `top`/`right` negativos (-3,
  // depois -8) sempre deixavam uma fatia do badge por cima da placa de
  // nome, ainda que pequena. Trocado por `bottom: 100%` (o badge fica
  // INTEIRO acima da placa, encostado na borda de cima) + `right: 0`
  // (alinhado com a quina direita) -- toca a quina sem nunca sobrepor.
  const bountyChip = !empty && bountyValue != null && (
    <div
      title={`Bounty de $${bountyValue}`}
      style={{
        position: "absolute",
        bottom: "100%",
        right: 0,
        marginBottom: 3,
        zIndex: 4,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "1px 6px",
        borderRadius: 999,
        fontFamily: F,
        fontSize: 9.5,
        fontWeight: 700,
        color: "#FFFFFF",
        background: "rgba(10,10,12,0.9)",
        border: "1px solid rgba(255,255,255,0.35)",
        boxShadow: "0 2px 6px rgba(0,0,0,.5)",
        whiteSpace: "nowrap",
        ...num,
      }}
    >
      <Target size={8} />${bountyValue}
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: F,
              fontSize: 10,
              fontWeight: 800,
              ...tema.dealer,
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
        // marginTop reserva espaço pro badge de bounty (que fica INTEIRO
        // acima da placa, ver bountyChip) não encostar no chip de posição
        // acima -- só quando há bounty pra não abrir vão à toa nas outras
        // mãos/formatos.
        <div style={{ position: "relative", marginTop: bountyValue != null ? 13 : 0 }}>
          {/* Bounty no canto superior-direito da placa de nome (pedido
              explicito: "o pko pode colocar ao lado direito superior do
              nick do jogador, bem na quina, sem sobrepor"). */}
          {bountyChip}
          <div
            data-placa=""
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              fontFamily: F,
              color: acting ? "#FFFFFF" : tema.placa.nome,
              background: acting ? `linear-gradient(${col.base}40, ${col.base}40), ${tema.placa.fundo}` : tema.placa.fundo,
              border: acting ? `1px solid ${col.glow}` : `1px solid ${tema.placa.borda}`,
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
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", color: acting ? "#FFFFFF" : tema.placa.valor, ...num }}>
              {stack != null ? formatStack(stack) : stack}
              {sufixo ? ` ${sufixo}` : ""}
            </span>
          </div>
        </div>
      )}

      {badgeArea}
    </div>
  );

  return (
    <div
      data-assento={seat.posLabel}
      style={{
        position: "absolute",
        left: `${seat.x}%`,
        top: `${seat.y}%`,
        // scale() depois do translate: primeiro centraliza a caixa do
        // assento no ponto de ancoragem (x%,y%), so' DEPOIS encolhe em
        // torno do proprio centro (transform-origin default) — o ponto
        // de ancoragem na mesa nunca se move, so' o conteudo do assento
        // (carta+placa+texto) fica menor quando a mesa e' estreita.
        transform: `translate(-50%, calc(-50% - ${subirPelaCarta}px)) scale(${effectiveScale})`,
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
                {/* size "hero" (72x100, era "board" 56x80) -- pedido
                    explicito: "as cartas do hero deverão ser maiores que
                    as do vilão" (villain usa 46x66, ja bem menor). */}
                <CardFan cards={sortCardsDesc(cards)} size={heroScale > 1 ? "heroCelular" : "hero"} />
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
                <CardFan cards={sortCardsDesc(cards!)} size="villain" />
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
      <span style={{ fontSize: 14, fontWeight: 700, color: TEXT.critical, ...num }}>{formatStack(spr)}</span>
    </div>
  );
}

// "Pra pagar precisa de 44%" -- a conta que todo jogador faz de cabeça
// diante de um all-in (quanto vou pagar ÷ tamanho do pote final),
// mostrada pronta. Mesmo formato do selo de SPR.
function PotOddsBadge({ pct }: { pct: number }) {
  return (
    <div
      title="Equidade mínima pra pagar: o que você paga ÷ o pote no final"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        padding: "3px 11px",
        borderRadius: 999,
        fontFamily: F,
        background: "rgba(0,0,0,0.62)",
        border: "1px solid rgba(96,165,250,0.45)",
        boxShadow: "0 3px 10px rgba(0,0,0,.5)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: TEXT.decorative }}>PRA PAGAR PRECISA DE</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#93C5FD", ...num }}>{Math.round(pct)}%</span>
    </div>
  );
}

// Um jogador no placar do centro: posição (na cor da posição, igual o
// chip do assento), "Você" no herói e o valor -- chance de vitória ou o
// nome da jogada. Quem levou o pote ganha o troféu e o valor dourado.
function PlacarItem({ pos, voce, texto, vencedor }: NonNullable<TableHand["placar"]>[number]) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px 3px 4px",
        borderRadius: 999,
        fontFamily: F,
        background: "rgba(0,0,0,0.62)",
        border: vencedor ? "1px solid rgba(212,175,55,0.65)" : "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 3px 10px rgba(0,0,0,.5)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        animation: `fadeInUp ${dur(200)} ease-out`,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, color: "#FFFFFF", background: `${POS[pos]?.base ?? NEUTRAL}CC` }}>{pos}</span>
      {voce && <span style={{ fontSize: 11, fontWeight: 600, color: TEXT.secondary }}>Você</span>}
      <span style={{ fontSize: 13, fontWeight: 700, color: vencedor ? "#F5D76E" : TEXT.critical, ...num }}>{texto}</span>
      {vencedor && <Trophy size={12} color="#F5D76E" style={{ flexShrink: 0 }} />}
    </div>
  );
}

export function PokerTable({
  hand,
  seats,
  chipAnimation,
  potAwardAnimation,
  devolucaoAnimation,
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
  // Alinhamento pela placa (ver Seat.centrarNaPlaca) -- so' o Revisor no
  // computador liga; Treino e celular continuam como sempre.
  centrarNaPlaca = false,
  // Multiplicador do tamanho dos assentos e do centro da mesa, em cima
  // do auto-encolhimento por largura -- 1 = de sempre.
  escalaAssentos = 1,
  // Valores em BB (padrão) ou em fichas (opção do Revisor, M8) -- só muda
  // o sufixo; os números já chegam na unidade certa.
  unidade = "bb",
  // Velocidade das animações (opção do Treino, M10).
  animacao = "normal",
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
  // Pote indo ATÉ o vencedor (fichas espalhando e voando, ver voo-fichas.tsx) --
  // ausente em qualquer consumidor que nao passe (ex: Treino), sem
  // mudanca de comportamento pra quem nao usa.
  potAwardAnimation?: { toPosLabel: string; amount: number; key: string | number } | null;
  // Aposta não paga voltando pro dono (ver voo-fichas.tsx, "devolucao").
  devolucaoAnimation?: { toPosLabel: string; amount: number; key: string | number } | null;
  streetCommitments?: Record<string, number>;
  variant?: TableVariant;
  aspectRatio?: string;
  minSeatScale?: number;
  heroScale?: number;
  centrarNaPlaca?: boolean;
  escalaAssentos?: number;
  unidade?: UnidadeValor;
  animacao?: VelocidadeAnimacao;
  cornerRadius?: string;
  opponentStats?: Record<string, OpponentStats>;
  onOpponentClick?: (playerName: string) => void;
}) {
  const active = !!hand;
  const seatData = (p: string): SeatState => (hand?.seats && hand.seats[p]) || { status: "empty" };
  const { feltro, mesa } = usePreferenciasMesa();
  const tema = TEMAS_MESA[mesa];
  const felt = feltro === "padrao" ? (tema.feltroPadrao ?? FELT_PALETTES[variant]) : FELTROS_ESCOLHIDOS[feltro];
  const sufixo = unidade === "fichas" ? "" : "BB";
  const semAnimacao = animacao === "sem";
  const tableBoxRef = useRef<HTMLDivElement>(null);
  const aspectRatioValue = parseAspectRatio(aspectRatio);
  const medidaMesa = useSeatScale(tableBoxRef, aspectRatioValue, minSeatScale);
  const seatScale = medidaMesa.scale * escalaAssentos;
  const emFichas = !sufixo;
  const vel = animacao === "rapida" ? 0.4 : 1;

  // ---- Fichas voando: "Moeda girando" (ver voo-fichas.tsx) ----
  // Sem voo com animação desligada nas Configurações ou com "reduzir
  // movimento" ligado no aparelho.
  const [reduzMovimento, setReduzMovimento] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduzMovimento(mq.matches);
    const mudou = () => setReduzMovimento(mq.matches);
    mq.addEventListener("change", mudou);
    return () => mq.removeEventListener("change", mudou);
  }, []);
  const voar = !semAnimacao && !reduzMovimento;
  const [voos, setVoos] = useState<Voo[]>([]);
  const potPillRef = useRef<HTMLDivElement>(null);
  const potPilhaRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const fimDoVoo = useCallback((id: string) => setVoos((v) => v.filter((x) => x.id !== id)), []);
  const novoVoo = (voo: Voo) => setVoos((v) => (v.some((x) => x.id === voo.id) ? v : [...v, voo]));
  // Onde um elemento está na mesa, em pixel relativo à caixa da mesa.
  const caixaNaMesa = (el: Element | null | undefined): Caixa | null => {
    const caixa = tableBoxRef.current;
    if (!el || !caixa) return null;
    const a = caixa.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return { left: b.left - a.left, right: b.right - a.left, top: b.top - a.top, bottom: b.bottom - a.top };
  };
  const centroNaMesa = (el: Element | null | undefined): Ponto | null => {
    const c = caixaNaMesa(el);
    return c && { x: (c.left + c.right) / 2, y: (c.top + c.bottom) / 2 };
  };
  const placaDoAssento = (pos: string) => tableBoxRef.current?.querySelector(`[data-assento="${pos}"] [data-placa]`);
  // Fichas saem da / chegam na placa com o stack do jogador; sem placa
  // (assento vazio), o ponto do assento na mesa.
  const pontoDoAssento = (s: SeatLayoutSlot): Ponto =>
    centroNaMesa(placaDoAssento(s.posLabel)) ?? {
      x: (s.x / 100) * medidaMesa.largura,
      y: (s.y / 100) * medidaMesa.altura,
    };
  const rotuloValor = (v: number) => `+${formatStack(v)}${sufixo ? ` ${sufixo}` : ""}`;

  // Apostas fora de cima dos assentos e do pote (ver acharLugarLivre).
  // Mede depois de desenhar e, se alguma precisa andar, desenha de novo
  // antes de aparecer na tela. Também guarda onde cada pilha de aposta
  // ficou -- é de lá que as fichas saem/chegam nos voos.
  const [ajusteApostas, setAjusteApostas] = useState<Record<string, Ponto>>({});
  const pilhasDasApostas = useRef<Record<string, Ponto>>({});
  // Onde as pilhas estavam antes da última mudança -- a devolução sai
  // de lá quando a pilha some inteira.
  const pilhasAnteriores = useRef<Record<string, Ponto>>({});
  useLayoutEffect(() => {
    const caixa = tableBoxRef.current;
    if (!caixa) return;
    const t = caixa.getBoundingClientRect();
    const obstaculos: Caixa[] = [...caixa.querySelectorAll("[data-obstaculo], [data-assento]")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const novo: Record<string, Ponto> = {};
    const pilhas: Record<string, Ponto> = {};
    caixa.querySelectorAll<HTMLElement>("[data-aposta]").forEach((el) => {
      const pos = el.dataset.aposta ?? "";
      const atual = ajusteApostas[pos] ?? { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const base = { left: r.left - atual.x, right: r.right - atual.x, top: r.top - atual.y, bottom: r.bottom - atual.y };
      const assento = seats.find((s) => s.posLabel === pos);
      const dono = assento ? { x: t.left + (assento.x / 100) * t.width, y: t.top + (assento.y / 100) * t.height } : { x: t.left + t.width / 2, y: t.top + t.height / 2 };
      const ajuste = acharLugarLivre(base, obstaculos, t, dono);
      novo[pos] = ajuste;
      // As outras apostas também não podem cair em cima desta.
      obstaculos.push({ left: base.left + ajuste.x, right: base.right + ajuste.x, top: base.top + ajuste.y, bottom: base.bottom + ajuste.y });
      const pilha = el.querySelector("[data-pilha-aposta]")?.getBoundingClientRect();
      if (pilha) {
        pilhas[pos] = { x: pilha.left + pilha.width / 2 - atual.x + ajuste.x - t.left, y: pilha.top + pilha.height / 2 - atual.y + ajuste.y - t.top };
      }
    });
    pilhasAnteriores.current = { ...pilhasAnteriores.current, ...pilhasDasApostas.current };
    pilhasDasApostas.current = pilhas;
    const mudou =
      Object.keys(novo).length !== Object.keys(ajusteApostas).length ||
      Object.entries(novo).some(([pos, a]) => {
        const b = ajusteApostas[pos];
        return !b || Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1;
      });
    if (mudou) setAjusteApostas(novo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medidaMesa, seats, hand, streetCommitments, seatScale, heroScale, centrarNaPlaca]);

  // 1) Recolher: a rua acabou -- as apostas da frente dos assentos somem
  //    (e o pote não diminuiu, ou seja, não é o passo pra trás do Revisor).
  //    As fichas voam de onde cada aposta estava até o pote, que acende.
  //    Guarda onde cada aposta está a cada mudança, pra saber de onde elas
  //    saem quando sumirem.
  const apostasAntes = useRef<{ soma: number; pote: number; apostas: Record<string, { ponto: Ponto; valor: number }> } | null>(null);
  const recolhendoAte = useRef(0);
  useEffect(() => {
    const pote = hand?.pot ?? 0;
    const apostas: Record<string, { ponto: Ponto; valor: number }> = {};
    Object.entries(pilhasDasApostas.current).forEach(([pos, ponto]) => {
      const valor = streetCommitments?.[pos] ?? 0;
      if (valor > 0) apostas[pos] = { ponto, valor };
    });
    const soma = Object.values(streetCommitments ?? {}).reduce((t, v) => t + v, 0);
    const antes = apostasAntes.current;
    apostasAntes.current = { soma, pote, apostas };
    if (!voar || !hand || !antes || antes.soma <= 0 || soma > 0 || pote < antes.pote - 0.01) return;
    const para = centroNaMesa(potPilhaRef.current);
    const origens = Object.entries(antes.apostas);
    if (!para || origens.length === 0) return;
    const agora = Date.now();
    let fim = 0;
    origens.forEach(([pos, { ponto, valor }]) => {
      const fichas = quebrarEmFichas(valor, MAX_FICHAS_VOO, emFichas);
      fim = Math.max(fim, duracaoDoVoo("recolher", fichas.length, vel));
      novoVoo({ id: `recolher-${pos}-${agora}`, tipo: "recolher", fichas, de: ponto, para });
    });
    recolhendoAte.current = agora + fim;
    // O pote acende em dourado quando as fichas chegam.
    timers.current.push(
      window.setTimeout(() => {
        potPillRef.current?.animate(
          [{ boxShadow: "0 0 0 rgba(242,198,90,0)" }, { boxShadow: "0 0 22px rgba(242,198,90,.9)" }, { boxShadow: "0 0 0 rgba(242,198,90,0)" }],
          { duration: 700 * vel, easing: "ease-out", composite: "add" },
        );
        potPilhaRef.current?.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 320 * vel, easing: "ease-out" });
      }, fim),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streetCommitments, hand?.pot, medidaMesa.largura, medidaMesa.altura]);

  // 2) Aposta: as fichas saem do assento e param na pilha da aposta dele
  //    (a pílula com o valor aparece quando elas chegam, ver atrasoDaAposta).
  useEffect(() => {
    if (!voar || !chipAnimation || chipAnimation.amount <= 0) return;
    const assento = seats.find((s) => s.posLabel === chipAnimation.fromPosLabel);
    if (!assento) return;
    const de = pontoDoAssento(assento);
    const para = pilhasDasApostas.current[chipAnimation.fromPosLabel] ?? { x: (TABLE_CENTER.x / 100) * medidaMesa.largura, y: (TABLE_CENTER.y / 100) * medidaMesa.altura };
    novoVoo({ id: `aposta-${chipAnimation.key}`, tipo: "aposta", fichas: quebrarEmFichas(chipAnimation.amount, MAX_FICHAS_VOO, emFichas), de, para });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chipAnimation?.key]);
  const atrasoDaAposta = (pos: string) =>
    voar && chipAnimation && chipAnimation.fromPosLabel === pos && chipAnimation.amount > 0
      ? duracaoDoVoo("aposta", quebrarEmFichas(chipAnimation.amount, MAX_FICHAS_VOO, emFichas).length, vel)
      : 0;

  // 2b) Devolução: a sobra da aposta que ninguém pagou volta da pilha
  //     pro stack do dono (ex.: o fold diante da 4-bet).
  useEffect(() => {
    if (!voar || !devolucaoAnimation || devolucaoAnimation.amount <= 0) return;
    const assento = seats.find((s) => s.posLabel === devolucaoAnimation.toPosLabel);
    const pos = devolucaoAnimation.toPosLabel;
    const de = pilhasDasApostas.current[pos] ?? pilhasAnteriores.current[pos];
    if (!assento || !de) return;
    novoVoo({ id: `devolucao-${devolucaoAnimation.key}`, tipo: "devolucao", fichas: quebrarEmFichas(devolucaoAnimation.amount, MAX_FICHAS_VOO, emFichas), de, para: pontoDoAssento(assento) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devolucaoAnimation?.key]);

  // 3) Prêmio: as fichas se espalham pra fora do pote e vão até o
  //    vencedor, e o valor ganho sobe em cima dele. Se as apostas da última
  //    rua ainda estão indo pro pote, espera elas chegarem.
  useEffect(() => {
    if (!voar || !potAwardAnimation || potAwardAnimation.amount <= 0) return;
    const assento = seats.find((s) => s.posLabel === potAwardAnimation.toPosLabel);
    const de = centroNaMesa(potPilhaRef.current);
    if (!assento || !de) return;
    const espera = Math.max(0, recolhendoAte.current - Date.now()) / vel;
    const para = pontoDoAssento(assento);
    // "+valor" ao lado do stack, do lado de dentro da mesa.
    const placa = caixaNaMesa(placaDoAssento(assento.posLabel)) ?? { left: para.x, right: para.x, top: para.y, bottom: para.y };
    const lado = para.x <= medidaMesa.largura / 2 ? "direita" : "esquerda";
    novoVoo({
      id: `premio-${potAwardAnimation.key}`,
      tipo: "premio",
      fichas: quebrarEmFichas(potAwardAnimation.amount, MAX_FICHAS_VOO, emFichas),
      de,
      para,
      atrasoMs: espera,
      rotulo: { texto: rotuloValor(potAwardAnimation.amount), em: { x: lado === "direita" ? placa.right + 6 : placa.left - 6, y: para.y }, lado },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potAwardAnimation?.key]);

  return (
    <SufixoValor.Provider value={sufixo}>
    <TemaCtx.Provider value={tema}>
    <div
      data-ps-animacao={animacao}
      style={{
        ["--ps-vel" as string]: animacao === "rapida" ? 0.4 : 1,
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
        [data-ps-animacao="sem"] *, [data-ps-animacao="sem"] *::before, [data-ps-animacao="sem"] *::after { animation: none !important; transition: none !important; }
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
          // overflow:visible (era "hidden") -- pedido explicito: "tem
          // algumas informacoes cortadas... pode deixar as cartas passar
          // da mesa e nome tambem, nao precisa cortar" -- assentos perto
          // da borda (x/y proximos de 0%/100%) tem metade do proprio
          // bloco fora da caixa da mesa; sem mudar NENHUMA posicao (pedido
          // explicito: "nao mexa nas posicoes por enquanto"), so' parar de
          // clipar o que passa da borda.
          overflow: "visible",
          borderRadius: cornerRadius,
        }}
        ref={tableBoxRef}
      >
        {/* Borda da mesa (couro na Arena, nogueira no Luxo) -- ocupa a
            faixa entre a caixa e o feltro. */}
        <div style={{ position: "absolute", inset: 0, borderRadius: cornerRadius, pointerEvents: "none", ...tema.aro(felt.glow) }}>
          {tema.aroComVeio && (
            <div style={{ position: "absolute", inset: 0, borderRadius: cornerRadius, backgroundImage: RUIDO, backgroundSize: "90px 260px", opacity: 0.35, mixBlendMode: "overlay" }} />
          )}
        </div>

        <div
          style={{
            position: "absolute",
            inset: "2.8% 2%",
            borderRadius: cornerRadius,
            background: felt.background,
            overflow: "hidden",
            boxShadow: [
              ...tema.feltroBorda,
              `0 0 40px ${felt.glow}`,
              "inset 0 2px 30px rgba(255,255,255,.06)",
              "inset 0 -30px 80px rgba(0,0,0,.65)",
            ].join(", "),
          }}
        >
          {/* Textura do feltro, luz no centro e linha de aposta. Sem marca
              escrita no feltro: no anel de 8 lugares ela caía atrás do
              assento do topo. */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: RUIDO, opacity: 0.14, mixBlendMode: "overlay" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: tema.luz }} />
          <div style={{ position: "absolute", inset: "12% 9%", borderRadius: cornerRadius, pointerEvents: "none", border: `1px solid ${tema.linhaAposta}` }} />
        </div>

        {/* FIX (2026-09): desceu de 44% pra 48% — com cartas SEMPRE em cima
            do nome (mudanca recente), o assento que cai bem no topo-centro
            da mesa (BB-max com n par: UTG+1 no 8-max, CO no 6-max) tinha o
            bloco de cartas+nome colidindo com o badge de SPR, que ficava
            colado logo abaixo desse ponto. Descer o bloco central da mesa
            um pouco abre esse respiro sem precisar encolher as cartas. */}
        <div style={{ position: "absolute", left: "50%", top: "53%", transform: `translate(-50%,-50%) scale(${seatScale})`, zIndex: 3 }}>
          {active && hand ? (
            // O board fica no FLUXO normal desse wrapper (unico conteudo
            // que conta pra altura dele) -- e' por isso que o translate
            // (-50%,-50%) do pai centraliza exatamente o BOARD no meio da
            // mesa (pedido explicito: "quero que as cartas fiquem
            // centralizadas no meio da mesa e nao o pote"). SPR + pote
            // ficam absolute, ancorados no proprio topo desse wrapper --
            // flutuam ACIMA do board sem empurrar o centro dele pra baixo.
            <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <div data-obstaculo="" style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {hand.potOddsPct != null ? <PotOddsBadge pct={hand.potOddsPct} /> : hand.spr != null && <SprBadge spr={hand.spr} />}
                <div
                  ref={potPillRef}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontFamily: F,
                    background: tema.pote.fundo,
                    border: `1px solid ${tema.pote.borda}`,
                    boxShadow: `0 8px 22px rgba(0,0,0,.7), ${tema.pote.brilho}`,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div ref={potPilhaRef}>
                    <PilhaFichas fichas={quebrarEmFichas(hand.pot, MAX_FICHAS_POTE, emFichas)} tamanho={FICHA_POTE_PX} />
                  </div>
                  <span style={{ color: tema.pote.texto, fontWeight: 600, fontSize: 15, ...num }}>{formatStack(hand.pot)}</span>
                  {sufixo && <span style={{ color: TEXT.secondary, fontSize: 11, fontWeight: 500 }}>{sufixo}</span>}
                </div>
              </div>
              <div data-obstaculo="" style={{ display: "flex", gap: 7 }}>
                {hand.board.map((c, i) => (
                  <div key={i} style={{ animation: `cardDeal ${dur(300)} ease-out both`, animationDelay: dur(i * 70) }}>
                    <Card card={c} />
                  </div>
                ))}
              </div>
              {/* Placar logo abaixo do board, também absolute: não empurra o
                  board pra cima (ele continua centralizado na mesa). */}
              {hand.placar && hand.placar.length > 0 && (
                <div data-obstaculo="" style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 12, display: "flex", gap: 8 }}>
                  {hand.placar.map((p) => (
                    <PlacarItem key={p.pos} {...p} />
                  ))}
                </div>
              )}
            </div>
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
            centrarNaPlaca={centrarNaPlaca}
            opponentStats={s.playerName ? opponentStats?.[s.playerName] : undefined}
            onOpponentClick={onOpponentClick}
          />
        ))}

        {seats.map((s) => {
          const amt = streetCommitments?.[s.posLabel];
          if (!amt || amt < MIN_COMMITTED_TO_SHOW) return null;
          const subir = centrarNaPlaca ? (alturaCartasAcima(s, seatData(s.posLabel)) * seatScale * (s.isHero ? heroScale : 1)) / 2 : 0;
          return (
            <CommittedChip
              key={`bet-${s.posLabel}`}
              seat={s}
              amount={amt}
              scale={seatScale}
              heroScale={heroScale}
              subir={subir}
              atrasoMs={atrasoDaAposta(s.posLabel)}
              ajuste={ajusteApostas[s.posLabel]}
            />
          );
        })}

        {voos.map((v) => (
          <VooDeFichas
            key={v.id}
            voo={v}
            tamanho={Math.max(FICHA_VOO_MIN_PX, (v.tipo === "premio" ? FICHA_POTE_PX : FICHA_APOSTA_PX) * seatScale)}
            vel={vel}
            onFim={fimDoVoo}
          />
        ))}
      </div>
    </div>
    </TemaCtx.Provider>
    </SufixoValor.Provider>
  );
}
