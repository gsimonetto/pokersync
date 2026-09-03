"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, X, CheckCircle2, XCircle, Info, Check, RotateCcw } from "lucide-react";
import { classifyFrequency, verdictColor, type Verdict } from "@/lib/poker/gto-verdict";
import { TreinoResponsiveStyles } from "@/components/drill/treino-responsive-styles";
import { PokerTable, type TableHand, type SeatState } from "@/components/drill/poker-table";
import { computeStylizedSeatLayout } from "@/lib/poker/seat-layout";
import { registerTraining } from "@/lib/services/xp-service";
import { ModalPortal } from "@/components/modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";
import { FilterChip as SharedFilterChip } from "@/components/ui/filter-chip";
import {
  ALL_POSITIONS,
  getRfiJamSpot,
  listRfiJamSpots,
  matchupKey,
  parseMatchup,
  type RfiJamListItem,
  type RfiJamPhaseRaw,
  type RfiJamSpot,
} from "@/lib/services/rfi-jam-service";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const F = '"Space Grotesk", sans-serif';

function allLabels(): string[] {
  const out: string[] = [];
  for (let row = 0; row < RANKS.length; row++) {
    for (let col = 0; col < RANKS.length; col++) {
      if (row === col) out.push(`${RANKS[row]}${RANKS[col]}`);
      else if (row < col) out.push(`${RANKS[row]}${RANKS[col]}s`);
      else out.push(`${RANKS[col]}${RANKS[row]}o`);
    }
  }
  return out;
}
const ALL_LABELS = allLabels();

function comboCount(label: string): number {
  if (label.length === 2) return 6;
  return label.endsWith("s") ? 4 : 12;
}

function dealWeightedHand(): string {
  const weights = ALL_LABELS.map(comboCount);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < ALL_LABELS.length; i++) {
    r -= weights[i];
    if (r <= 0) return ALL_LABELS[i];
  }
  return ALL_LABELS[ALL_LABELS.length - 1];
}

// Combo concreto só pra DESENHAR na mesa (a lógica de frequência/EV
// continua sendo por classe, igual sempre foi) -- ex "AKs" -> ["Ah","Kh"],
// "76o" -> ["7h","6d"], "TT" -> ["Th","Td"]. Sem aleatoriedade de naipe
// proposital: não importa qual naipe exato, é só ilustrativo.
function classToDisplayCards(label: string): [string, string] {
  if (label.length === 2) {
    const r = label[0];
    return [`${r}h`, `${r}d`];
  }
  const r1 = label[0];
  const r2 = label[1];
  const suited = label[2] === "s";
  return suited ? [`${r1}h`, `${r2}h`] : [`${r1}h`, `${r2}d`];
}

const PHASES: { key: "sbOpen" | "bbJam" | "sbCallJam"; label: string }[] = [
  { key: "sbOpen", label: "vs Open (abrir)" },
  { key: "bbJam", label: "vs Jam (responder)" },
  { key: "sbCallJam", label: "vs All-in (pagar)" },
];

const ACTION_LABEL: Record<RfiJamPhaseRaw["action"], string> = {
  open: "Abrir (raise)",
  allin: "Jam (all-in)",
  call: "Pagar (call)",
};

// Terceiro botão "distrator" por fase -- pedido explícito: sempre 3+
// opções na barra de ação (fold + a correta + pelo menos uma errada),
// mesmo quando o solver só resolveu uma decisão binária (fold vs a
// ação). Em sbOpen e bbJam a opção errada é uma jogada real de poker
// que o solver simplesmente não modela (limpar / pagar em vez de
// jogar). sbCallJam FICA DE FORA de propósito: depois de alguém all-in
// num pote heads-up só existe fold ou call nas regras do poker -- não
// tem uma 3a ação real pra fabricar, e forçar uma (ex "Aumentar", que
// nem é uma jogada legal ali) ensinaria uma opção que não existe. Essa
// fase continua com só 2 botões.
const DISTRACTOR_LABEL: Partial<Record<(typeof PHASES)[number]["key"], string>> = {
  sbOpen: "Limpar (call)",
  bbJam: "Pagar (call)",
};

const VERDICT_LABEL: Record<Verdict, string> = {
  OTIMA: "Jogada Ótima",
  ACEITAVEL: "Aceitável",
  ERRO_LEVE: "Erro Leve",
  ERRO_GRAVE: "Erro Grave",
  UNKNOWN: "Sem dados do solver",
};

const STACK_OPTIONS = [10, 15, 20, 25, 30, 40, 50, 60];

// "Tipo" de solve -- hoje só existe ICM no banco (todo job de RFI/Jam
// usa engine/rfi_jam.py, que é ICM-aware). ChipEV puro (sem considerar
// prêmio/payout) ainda não foi gerado por nenhum job -- fica riscado
// até existir, mesmo padrão pedido pras outras dimensões.
const TYPE_OPTIONS = [
  { key: "icm", label: "ICM" },
  { key: "chip_ev", label: "ChipEV" },
];

const MARGINAL_GAP_THRESHOLD = 0.5;

// register_training (RPC) so reconhece 'PERFECT'/'OK'/'BLUNDER' -- strings
// diferentes do Verdict do frontend ('OTIMA'/'ACEITAVEL'/...). Sem esse
// mapa, ERRO_GRAVE nunca cai no `else 10` do banco... pior, nunca reseta o
// combo (so' 'BLUNDER' reseta) e nunca conta pra missao "clean_streak".
// ERRO_LEVE fica no meio-termo de proposito: nao e' erro grave o bastante
// pra quebrar o combo, mas tambem nao conta como acerto.
const VERDICT_TO_RPC: Record<Verdict, string> = {
  OTIMA: "PERFECT",
  ACEITAVEL: "OK",
  ERRO_LEVE: "MEDIOCRE",
  ERRO_GRAVE: "BLUNDER",
  UNKNOWN: "MEDIOCRE",
};

interface Round {
  label: string;
  freq: number;
  ev: number;
  gap: number;
}

// Mesmo FilterChip usado em Revisor e Biblioteca de Ranges (pedido
// explicito: "os filtros formem um padrão" -- antes era uma caixinha
// quadrada com fundo branco no ativo, so' aqui no Treino).
function FilterChip({
  label, active, disabled, onClick, disabledReason,
}: { label: string; active: boolean; disabled?: boolean; onClick: () => void; disabledReason?: string }) {
  return (
    <SharedFilterChip
      label={label}
      active={active}
      disabled={disabled}
      disabledReason={disabledReason ?? "Sem mãos geradas para essa combinação ainda"}
      onClick={onClick}
      style={{ fontFamily: F }}
    />
  );
}

// Veredito flutuando NA PRÓPRIA MESA -- feedback imediato de "acertei/
// errei" no lugar onde o olho do jogador está fixo assim que ele age
// (fundamental, pedido explícito: existia antes e some com a troca de
// mão). Complementa (não substitui) o painel com os números, que fica
// acima da mesa. `isGood`/label/color já vêm resolvidos de fora pra
// respeitar o caso "MARGINAL" (que não é bem um Verdict do banco).
function VerdictFlash({ label, color, isGood, freqPct }: { label: string; color: string; isGood: boolean; freqPct: number | null }) {
  const Icon = isGood ? CheckCircle2 : XCircle;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 2, pointerEvents: "none", zIndex: 50 }}>
      <div
        style={{
          fontFamily: F,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 18px",
          borderRadius: 999,
          background: "rgba(5,5,5,0.9)",
          border: `1.5px solid ${color}`,
          boxShadow: `0 0 28px ${color}55, 0 6px 16px rgba(0,0,0,.6)`,
          animation: "fadeInUp 220ms ease-out both",
        }}
      >
        <Icon size={17} color={color} strokeWidth={2.2} />
        <span style={{ color, fontWeight: 700, fontSize: 14 }}>{label}</span>
        {freqPct != null && (
          <span style={{ color: "rgba(255,255,255,.5)", fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{freqPct}%</span>
        )}
      </div>
    </div>
  );
}

// Breakpoint identico ao usado em treino-responsive-styles.tsx (768px) —
// so' abaixo dele que a gaveta de filtros vira modal e o modo mesa-cheia
// (fullscreen) existe. addEventListener("change", ...) reage a rotacao
// de tela/redimensionamento sem precisar de um listener de resize solto.
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

// Mesma logica de acerto/erro do VerdictFlash, mas em destaque na mesa
// (pedido explicito: "animacao rapida no centro da tela") -- e' o
// feedback principal do modo mesa-cheia, entao carrega tambem o botao
// "Ver detalhes" junto (no card normal esse botao mora no painel acima
// da mesa, que nao existe no modo tela-cheia).
//
// FIX (pedido explicito: "nao quero aquele conteiner preto, quero que
// seja algo natural visualmente") -- a caixa preta arredondada com
// borda colorida saiu. Agora e' so' o icone (com glow radial suave atras
// dele, sem contorno duro) + o texto flutuando direto sobre o feltro,
// com text-shadow no lugar de fundo solido pra continuar legivel. O
// botao "Ver detalhes" continua, mas como pilula translucida separada
// (nao mais dentro de uma caixa) — unico elemento com fundo, e' bem mais
// discreto que o card preto de antes.
//
// FIX (pedido explicito: "pode ser acima do board") -- centralizado na
// tela ele cobria o proprio board/pote (que fica no meio da mesa). Layout
// HORIZONTAL e compacto (icone+texto+% numa linha so', botao logo
// abaixo) cabe na faixa livre entre o vilao (topo da mesa) e o bloco
// central de SPR/board/pote, sem disputar espaco com nenhum dos dois --
// ver `top` do wrapper, calibrado pra essa faixa.
function VerdictCenterFlash({
  label, color, isGood, freqPct, onDetails,
}: {
  label: string;
  color: string;
  isGood: boolean;
  freqPct: number | null;
  onDetails: () => void;
}) {
  const Icon = isGood ? CheckCircle2 : XCircle;
  return (
    <div style={{ position: "absolute", top: "29%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, pointerEvents: "none", zIndex: 60 }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 9, animation: "verdictPop 320ms cubic-bezier(0.22, 1.4, 0.36, 1) both" }}>
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: -20, borderRadius: "50%", background: `radial-gradient(circle, ${color}40, transparent 72%)`, pointerEvents: "none" }}
        />
        <Icon size={26} color={color} strokeWidth={2.2} style={{ flexShrink: 0, filter: `drop-shadow(0 0 12px ${color}aa)` }} />
        <span style={{ fontFamily: F, color: "#FFFFFF", fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", textShadow: "0 2px 14px rgba(0,0,0,.85), 0 1px 3px rgba(0,0,0,.9)" }}>{label}</span>
        {freqPct != null && (
          <span style={{ fontFamily: F, color: "rgba(255,255,255,.65)", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", textShadow: "0 2px 10px rgba(0,0,0,.85)" }}>{freqPct}%</span>
        )}
      </div>
      <button
        onClick={onDetails}
        style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.75)", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 999, padding: "5px 12px", cursor: "pointer" }}
      >
        <Info size={11} />
        Ver detalhes
      </button>
      <style>{`@keyframes verdictPop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  );
}

// Botao da pilha vertical do modo mesa-cheia -- mais estreito e mais
// alto que o botao "chip" do modo card normal, pra caber numa coluna
// fina do lado direito da mesa em vez de uma linha horizontal embaixo.
function fsActionBtnStyle(bg: string, color = "#FFFFFF"): React.CSSProperties {
  return {
    fontFamily: F,
    width: 92,
    padding: "13px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: bg,
    color,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,.45)",
  };
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>
    </div>
  );
}

// Uma barra por opção (Fold vs a ação) -- comparar dois comprimentos é
// mais rápido de ler que comparar dois números, principalmente pra
// quem ainda não tem intuição de "60% vs 40%" de cabeça.
function FreqBar({ label, pct, highlighted }: { label: string; pct: number; highlighted: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 76, flexShrink: 0, fontSize: 12, color: highlighted ? "#FFFFFF" : "rgba(255,255,255,0.5)", fontWeight: highlighted ? 700 : 500 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: highlighted ? "#FFFFFF" : "rgba(255,255,255,0.3)" }} />
      </div>
      <span style={{ width: 38, flexShrink: 0, textAlign: "right", fontSize: 12, fontVariantNumeric: "tabular-nums", color: highlighted ? "#FFFFFF" : "rgba(255,255,255,0.5)", fontWeight: highlighted ? 700 : 500 }}>
        {pct}%
      </span>
    </div>
  );
}

// Os números completos (equity ICM crua, % de diferença, explicação de
// equilíbrio misto) ficam aqui, atrás de um clique -- em vez de
// forçados na tela toda vez que o jogador responde uma mão. Quem quer
// o detalhe técnico clica; quem só quer treinar o feedback rápido não
// precisa decifrar "equity ICM" no meio da sessão.
function EvDetailsModal({
  onClose, actionLabel, distractorLabel, chosen, foldPct, actionPct, gapRelativePct, evFold, evAction, isMarginal,
}: {
  onClose: () => void;
  actionLabel: string;
  distractorLabel: string | null;
  chosen: "fold" | "action" | "distractor";
  foldPct: number;
  actionPct: number;
  gapRelativePct: number | null;
  evFold: number;
  evAction: number;
  isMarginal: boolean;
}) {
  useEscapeToClose(onClose);
  return (
    <ModalPortal>
      <div
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", padding: 16 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ fontFamily: F, width: "100%", maxWidth: 380, borderRadius: 16, background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", overflow: "hidden" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF" }}>Detalhes dessa mão</span>
            <button onClick={onClose} style={{ display: "flex", width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: 0, color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                O que o GTO faz aqui
              </span>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <FreqBar label="Fold" pct={foldPct} highlighted={chosen === "fold"} />
                <FreqBar label={actionLabel} pct={actionPct} highlighted={chosen === "action"} />
                {distractorLabel && <FreqBar label={distractorLabel} pct={0} highlighted={chosen === "distractor"} />}
              </div>
              {isMarginal && (
                <p style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: "rgba(255,255,255,0.5)" }}>
                  As duas opções valem praticamente o mesmo aqui — por isso o GTO mistura {actionPct}/{foldPct} em vez de escolher só uma. Não é indecisão, é assim que o equilíbrio funciona nesse spot.
                </p>
              )}
            </div>

            <div style={{ paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                {chosen === "distractor" ? "Quanto as opções reais valem" : "Quanto isso vale"}
              </span>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: isMarginal ? "#f5a524" : "#FFFFFF" }}>
                  {gapRelativePct != null ? `${gapRelativePct.toFixed(1)}%` : "—"}
                </span>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>de diferença entre Fold e {actionLabel.toLowerCase()}</span>
              </div>
              <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.35)" }}>
                {chosen === "distractor" && distractorLabel && (
                  <>O motor não calcula o valor de {distractorLabel.toLowerCase()} aqui (ele nunca considera essa jogada) — o número acima é só a diferença entre as duas opções reais. </>
                )}
                Esse número é o que dá pra comparar entre mãos diferentes. Os valores de equity ICM crus (fold {evFold.toFixed(1)} · {actionLabel.toLowerCase()} {evAction.toFixed(1)}) são específicos desse torneio — servem só pra calcular a % acima, não pra comparar com outra mão.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

interface RfiJamDrillProps {
  tabs?: React.ReactNode;
  // Sugestao vinda de fora (leak da Gestao de Banca — "voce perde em MTT"
  // aponta pra stack curto; leak do Revisor — "posicao ignorada" aponta
  // pro matchup blind vs blind). So' aplica se existir spot de verdade;
  // senao cai no default de sempre.
  initialStackBb?: number;
  initialMatchup?: string;
}

// Tela única de treino (pré-flop RFI/Jam por enquanto -- é o único
// tipo de spot com dado real no banco hoje). Sem abas: filtros à
// esquerda, mesa (com o herói de verdade sentado, feltro azul) no
// meio, resultado GTO numa linha acima da mesa.
export function RfiJamDrill({ tabs, initialStackBb, initialMatchup }: RfiJamDrillProps) {
  const [spots, setSpots] = useState<RfiJamListItem[]>([]);
  const [heroPos, setHeroPos] = useState<string>("SB");
  const [villainPos, setVillainPos] = useState<string>("BB");
  const [stackBb, setStackBb] = useState<number>(15);
  const [spot, setSpot] = useState<RfiJamSpot | null>(null);
  const [phaseKey, setPhaseKey] = useState<(typeof PHASES)[number]["key"]>("sbOpen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Filtros SEMPRE comecam abertos, desktop ou celular (pedido explicito:
  // "quando abrir o modo treino ja deve vir aberto o filtro pro jogador
  // escolher qual sera o treino") -- antes so' o desktop abria assim; no
  // celular a gaveta comecava fechada. No desktop isso e' so' o painel
  // lateral (sempre foi assim); no celular vira a gaveta modal (ver
  // treino-responsive-styles.tsx), fechada so' depois que o jogador
  // aplica um filtro (ver handleApplyFilters mais abaixo).
  const [filtersOpen, setFiltersOpen] = useState(true);
  const isMobile = useIsMobile();
  // Modo mesa-cheia (celular, pedido explicito: "ao aplicar, quero que a
  // mesa ocupe a tela inteira") -- so' existe depois que o jogador aplica
  // o filtro; volta pra false se ele reabrir os filtros (ver botao de
  // filtro no cabecalho do modo tela-cheia, mais abaixo).
  const [fullscreenMode, setFullscreenMode] = useState(false);

  const [round, setRound] = useState<Round | null>(null);
  const [chosen, setChosen] = useState<"fold" | "action" | "distractor" | null>(null);
  const [stats, setStats] = useState({ hits: 0, total: 0 });
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    listRfiJamSpots()
      .then((rows) => {
        setSpots(rows);
        if (rows.length > 0) {
          // Preferencia em cascata: o par exato (matchup + stack) pedido de
          // fora; senao so' o matchup; senao so' o stack; senao o primeiro
          // spot que existir. Nunca trava numa combinacao sem dado.
          const matches = (r: RfiJamListItem) =>
            (initialMatchup == null || r.matchup === initialMatchup) &&
            (initialStackBb == null || r.stackBb === initialStackBb);
          const base =
            rows.find(matches) ??
            (initialMatchup != null ? rows.find((r) => r.matchup === initialMatchup) : undefined) ??
            (initialStackBb != null ? rows.find((r) => r.stackBb === initialStackBb) : undefined) ??
            rows[0];
          const { hero, villain } = parseMatchup(base.matchup);
          if (hero) setHeroPos(hero);
          if (villain) setVillainPos(villain);
          setStackBb(base.stackBb);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Erro ao listar spots RFI/Jam.");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStackBb, initialMatchup]);

  // Disponibilidade de cada dimensão do filtro, dado o que já está
  // selecionado nas outras -- mesmo padrão do FilterSidebar da aba
  // Pós-flop (counts condicionados). Villão hero->villão hero->stack
  // formam uma cadeia (cada um restringe o próximo).
  const villainsForHero = useMemo(
    () => new Set(spots.filter((s) => parseMatchup(s.matchup).hero === heroPos).map((s) => parseMatchup(s.matchup).villain)),
    [spots, heroPos]
  );
  const stacksForMatchup = useMemo(
    () =>
      Array.from(new Set(spots.filter((s) => s.matchup === matchupKey(heroPos, villainPos)).map((s) => s.stackBb))).sort(
        (a, b) => a - b
      ),
    [spots, heroPos, villainPos]
  );
  // Contagem de stacks disponíveis por posição -- vira o "(4)" ao lado
  // do chip, pra escanear sem precisar clicar em cada um.
  const stackCountForHero = useCallback(
    (pos: string) => new Set(spots.filter((s) => parseMatchup(s.matchup).hero === pos).map((s) => s.stackBb)).size,
    [spots]
  );
  const stackCountForHeroVillain = useCallback(
    (h: string, v: string) => new Set(spots.filter((s) => s.matchup === matchupKey(h, v)).map((s) => s.stackBb)).size,
    [spots]
  );

  // Auto-correção quando a seleção atual fica inválida (ex: trocou o
  // herói e o vilão selecionado não existe mais pra esse herói) --
  // sempre cai no primeiro disponível, nunca trava num estado sem dado.
  useEffect(() => {
    if (villainsForHero.size > 0 && !villainsForHero.has(villainPos)) {
      const first = spots.find((s) => parseMatchup(s.matchup).hero === heroPos);
      if (first) setVillainPos(parseMatchup(first.matchup).villain ?? villainPos);
    }
  }, [villainsForHero, villainPos, heroPos, spots]);

  useEffect(() => {
    if (stacksForMatchup.length > 0 && !stacksForMatchup.includes(stackBb)) {
      setStackBb(stacksForMatchup[0]);
    }
  }, [stacksForMatchup, stackBb]);

  const spotId = useMemo(() => {
    const key = matchupKey(heroPos, villainPos);
    const found = spots.find((s) => s.matchup === key && s.stackBb === stackBb);
    return found?.spotId ?? "";
  }, [spots, heroPos, villainPos, stackBb]);

  useEffect(() => {
    if (!spotId) {
      setSpot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    getRfiJamSpot(spotId)
      .then((s) => setSpot(s))
      .catch(() => setError("Erro ao carregar esse spot."))
      .finally(() => setLoading(false));
  }, [spotId]);

  const currentPhase: RfiJamPhaseRaw | null = useMemo(() => {
    if (!spot) return null;
    if (phaseKey === "sbOpen") return spot.sbOpen;
    if (phaseKey === "bbJam") return spot.bbJam;
    return spot.sbCallJam;
  }, [spot, phaseKey]);

  const nextRound = useCallback((phase: RfiJamPhaseRaw) => {
    const label = dealWeightedHand();
    const hand = phase.hands[label] ?? [0, phase.ev_fold, 0];
    const [freq, ev, gap] = hand;
    setRound({ label, freq, ev, gap });
    setChosen(null);
    setDetailsOpen(false);
  }, []);

  useEffect(() => {
    if (currentPhase) nextRound(currentPhase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase]);

  const isMarginal = round ? round.gap < MARGINAL_GAP_THRESHOLD : false;

  // Frequência da opção escolhida na estratégia do GTO -- fold e a ação
  // resolvida vêm do solver; o distrator (3o botão, sempre uma jogada
  // que o solver não recomenda) não existe na estratégia dele, então a
  // frequência dele é 0 por definição (não é uma aproximação, é o fato
  // de essa opção nunca aparecer na mistura ótima).
  const chosenFreq = useMemo(() => {
    if (!round || !chosen) return null;
    if (chosen === "distractor") return 0;
    return chosen === "fold" ? 1 - round.freq : round.freq;
  }, [round, chosen]);

  const verdict: Verdict | null = useMemo(() => {
    if (chosenFreq == null) return null;
    return classifyFrequency(chosenFreq);
  }, [chosenFreq]);

  // O veredito real (acertei/errei) NUNCA é substituído por "MARGINAL" --
  // antes o rótulo virava "MARGINAL" sempre que o gap era pequeno,
  // escondendo se a jogada escolhida era boa ou ruim (dois jogadores
  // podem cair num spot "marginal" e um ter acertado, outro não -- o
  // rótulo não podia dizer isso). "Marginal" agora é uma tag SEPARADA,
  // ao lado do veredito, não no lugar dele.
  const displayLabel = verdict ? VERDICT_LABEL[verdict] : undefined;
  const displayColor = verdict ? verdictColor(verdict) : undefined;
  const isGoodVerdict = verdict === "OTIMA" || verdict === "ACEITAVEL";
  const chosenFreqPct = chosenFreq != null ? Math.round(chosenFreq * 100) : null;
  // Gap relativo ao que está em jogo -- em vez do valor absoluto (que
  // depende da escala de ICM/premiação daquele torneio especifico, sem
  // significado isolado), a DIFERENÇA em % de uma opção pra outra é
  // comparável entre spots, independente da escala.
  //
  // Fix (2026-08): denominador era a MEDIA das duas EVs -- quando a
  // opção errada tem EV bem menor que a certa (justamente o caso de
  // "Erro Grave", o mais importante de comunicar direito), a média
  // encolhe e a % estoura bem acima de 100 (visto em teste real: 290%,
  // 298%). Isso não lê como "você perdeu quase 3x o valor" pra ninguém
  // -- lê como número quebrado, bem na hora que o feedback mais importa.
  // Denominador agora é a MAIOR das duas EVs (o valor da melhor opção
  // disponível) -- como as duas são fatias de equity ICM (sempre ≥0), a
  // diferença nunca passa da maior das duas, então a % fica sempre ≤100
  // e lê como "você abriu mão de X% do valor que a melhor opção tinha".
  const gapRelativePct = round && currentPhase
    ? (() => {
        const denom = Math.max(currentPhase.ev_fold, round.ev);
        return denom > 0 ? (round.gap / denom) * 100 : 0;
      })()
    : null;

  const actionLabel = currentPhase ? ACTION_LABEL[currentPhase.action] : "";

  // Uma frase só, sem "equity"/"ICM"/"gap" -- é o que aparece por
  // padrão depois de cada mão. Quem quer os números de verdade clica
  // em "Ver detalhes" (abre o EvDetailsModal, que tem o resto).
  const plainFeedback = useMemo(() => {
    if (!round || !chosen || !currentPhase) return null;
    // Distrator: não tem EV real calculado (o solver nunca resolve
    // essa jogada), então a frase não tenta comparar valor -- só avisa
    // que essa opção nem entra na conta do GTO aqui.
    if (chosen === "distractor") return `O GTO nem considera ${(DISTRACTOR_LABEL[phaseKey] ?? "essa jogada").toLowerCase()} nessa situação.`;
    if (isMarginal) return "As duas jogadas valem praticamente o mesmo aqui — não tinha erro grave possível.";
    const chosenLabel = chosen === "fold" ? "Fold" : actionLabel;
    const otherLabel = chosen === "fold" ? actionLabel : "Fold";
    if (isGoodVerdict) return `Boa escolha — o GTO também prefere ${chosenLabel} na maioria das vezes aqui.`;
    return `O GTO prefere ${otherLabel} na maioria das vezes aqui.`;
  }, [round, chosen, currentPhase, isMarginal, isGoodVerdict, actionLabel, phaseKey]);

  useEffect(() => {
    if (!chosen || !verdict || verdict === "UNKNOWN" || !round) return;
    setStats((prev) => ({ hits: prev.hits + (verdict === "OTIMA" ? 1 : 0), total: prev.total + 1 }));
    const isGood = verdict === "OTIMA" || verdict === "ACEITAVEL";
    registerTraining({
      spotId: spot?.spotId ?? null,
      verdict: VERDICT_TO_RPC[verdict],
      evLoss: isGood ? 0 : Math.max(0, round.gap),
      userAction: chosen === "fold" ? "FOLD" : chosen === "distractor" ? "OUTRA" : currentPhase?.action ?? null,
    }).catch(() => {
      // XP e' um bonus, nao pode travar o treino se a rede falhar
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (chosen && currentPhase) nextRound(currentPhase);
        return;
      }
      if (!chosen) {
        if (e.key.toUpperCase() === "Q") setChosen("fold");
        if (e.key.toUpperCase() === "W") setChosen("action");
        if (e.key.toUpperCase() === "E" && DISTRACTOR_LABEL[phaseKey]) setChosen("distractor");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, currentPhase, nextRound, phaseKey]);

  const sessionPct = stats.total > 0 ? Math.round((stats.hits / stats.total) * 100) : 0;
  const emptyMessage = spots.length === 0 ? "Nenhum spot RFI/Jam encontrado no Supabase ainda." : "Sem mãos geradas pra essa combinação de filtros ainda.";

  // Quem senta como "herói" na mesa varia por situação: sbOpen/sbCallJam
  // testam a decisão de quem abre (heroPos), bbJam testa a decisão de
  // quem defende (villainPos) -- a mesa reflete isso trocando quem
  // recebe as cartas viradas. O anel gira em torno de quem esta' de
  // fato agindo (activeHeroSeat), nao mais sempre em torno do filtro
  // "Posição Herói" -- sem isso, na fase bbJam quem decide (o defensor)
  // podia cair fora do slot de baixo, quebrando a convencao de "hero
  // sempre embaixo" que o resto do produto (Replay) já segue.
  const activeHeroSeat = phaseKey === "bbJam" ? villainPos : heroPos;
  const activeVillainSeat = phaseKey === "bbJam" ? heroPos : villainPos;

  const { seatLayout, layoutError } = useMemo(() => {
    try {
      return { seatLayout: computeStylizedSeatLayout(activeHeroSeat), layoutError: null as Error | null };
    } catch (e) {
      return { seatLayout: null, layoutError: e instanceof Error ? e : new Error("Posição inválida.") };
    }
  }, [activeHeroSeat]);

  const tableHand: TableHand | null = useMemo(() => {
    if (!spot || !round) return null;
    const heroCards = classToDisplayCards(round.label);
    const seats: Record<string, SeatState> = {};
    ALL_POSITIONS.forEach((pos) => {
      if (pos === activeHeroSeat) {
        seats[pos] = { status: chosen ? "live" : "acting", stack: spot.effectiveStack, cards: heroCards };
      } else if (pos === activeVillainSeat) {
        seats[pos] = { status: "live", stack: spot.effectiveStack };
      } else {
        seats[pos] = { status: "empty" };
      }
    });
    const spr = spot.pot > 0 ? Math.round((spot.effectiveStack / spot.pot) * 10) / 10 : null;
    return { pot: spot.pot, spr, board: [], history: [], seats };
  }, [spot, round, chosen, activeHeroSeat, activeVillainSeat]);

  // FIX (bug reportado): "no filtro de all-in ou aposta do vilao, os
  // blinds nao estao sendo somados na mesa e nem a animacao das fichas
  // esta vindo". Antes o tableHand nunca preenchia streetCommitments nem
  // disparava chipAnimation -- a mesa sempre mostrava o pote pronto, sem
  // nenhuma ficha na frente dos assentos e sem a bolinha voando. Blinds
  // sempre entram como base (0.5bb SB / 1bb BB, se hero ou vilao ocupam
  // esses assentos); em bbJam/sbCallJam o assento que ja agiu antes do
  // spot comecar (activeVillainSeat -- quem abriu, em bbJam; quem deu
  // jam, em sbCallJam) recebe o RESTANTE do pote (spot.pot menos o
  // blind de quem esta decidindo agora), reconciliando com o pote
  // exibido sem precisar de um breakdown de tamanho de aposta que o
  // motor nao guarda por mao.
  const SB_BLIND_BB = 0.5;
  const BB_BLIND_BB = 1;
  const seatBlind = useCallback((pos: string) => (pos === "SB" ? SB_BLIND_BB : pos === "BB" ? BB_BLIND_BB : 0), []);

  const streetCommitments = useMemo(() => {
    if (!spot) return undefined;
    if (phaseKey === "sbOpen") {
      // Ninguem decidiu nada ainda alem dos blinds forcados.
      return { [heroPos]: seatBlind(heroPos), [villainPos]: seatBlind(villainPos) };
    }
    // bbJam/sbCallJam: activeVillainSeat ja tem uma acao (abertura ou
    // jam) comprometida antes do jogador decidir.
    const decidingBlind = seatBlind(activeHeroSeat);
    return { [activeHeroSeat]: decidingBlind, [activeVillainSeat]: Math.max(0, spot.pot - decidingBlind) };
  }, [spot, phaseKey, heroPos, villainPos, activeHeroSeat, activeVillainSeat, seatBlind]);

  // Ficha voando do assento que ja agiu (activeVillainSeat) ate' o pote —
  // so' nas fases onde alguem ja jogou antes do jogador decidir (bbJam:
  // abertura; sbCallJam: jam). A key muda a cada mao nova (round.label +
  // spotId + fase), entao a animacao roda de novo em toda mao nova dessas
  // fases -- reforca "isso e' o que o vilao acabou de fazer".
  const chipAnimation = useMemo(() => {
    if (!spot || !round || phaseKey === "sbOpen" || !streetCommitments) return null;
    const amount = streetCommitments[activeVillainSeat];
    if (!amount || amount <= 0) return null;
    return { fromPosLabel: activeVillainSeat, amount, key: `${spotId}-${phaseKey}-${round.label}` };
  }, [spot, round, phaseKey, streetCommitments, activeVillainSeat, spotId]);

  // Modo mesa-cheia: mesmo anel de 8-max do card normal (pedido
  // explicito: "quero que venha os seats foscos mas todos eles
  // preenchendo a mesa, pode por 8max") -- os assentos sem jogador ja
  // ficam foscos sozinhos (SEAT_OPACITY.empty em poker-table.tsx), o
  // tableHand ja preenche todos como "empty" exceto hero/vilao (ver
  // useMemo de tableHand acima). So' desloca o assento do HERO um pouco
  // pra esquerda (pedido explicito, sessao anterior: "a mao do hero
  // pode jogar um pouco pra esquerda") pra abrir espaco pra pilha de
  // botoes de aposta a direita.
  const fullscreenSeatLayout = useMemo(() => {
    if (!seatLayout) return null;
    return seatLayout.map((s) => (s.isHero ? { ...s, x: 42 } : s));
  }, [seatLayout]);

  const clearFilters = useCallback(() => {
    setStats({ hits: 0, total: 0 });
    if (spots.length > 0) {
      const { hero, villain } = parseMatchup(spots[0].matchup);
      if (hero) setHeroPos(hero);
      if (villain) setVillainPos(villain);
      setStackBb(spots[0].stackBb);
    }
    setPhaseKey("sbOpen");
  }, [spots]);

  // "Aplicar" (pedido explicito): confirma os filtros, fecha a gaveta e
  // -- so' no celular -- entra no modo mesa-cheia. No desktop so' fecha a
  // gaveta (nao existe modo mesa-cheia la', o layout de sempre continua).
  const applyFilters = useCallback(() => {
    setFiltersOpen(false);
    if (isMobile) setFullscreenMode(true);
  }, [isMobile]);

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 8, height: "100%", minHeight: 0, position: "relative" }}>
      <TreinoResponsiveStyles />

      {/* Modo mesa-cheia (celular, pedido explicito: "ao aplicar, quero
          que a mesa ocupe a tela inteira, pode ser um retangulo vertical
          pra ocupar toda a tela"). Portal (foge de qualquer container com
          overflow:hidden da pagina) -- mesmo padrao ja usado no
          EvDetailsModal abaixo. So' entra na arvore quando ha uma mao de
          verdade pra mostrar (round/currentPhase/tableHand prontos),
          senao ficaria uma tela preta vazia se o jogador aplicasse o
          filtro antes do spot carregar. */}
      {fullscreenMode && isMobile && round && currentPhase && tableHand && fullscreenSeatLayout && (
        <ModalPortal>
          <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column", fontFamily: F }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", flexShrink: 0 }}>
              <button
                onClick={() => {
                  setFullscreenMode(false);
                  setFiltersOpen(true);
                }}
                aria-label="Abrir filtros"
                title="Abrir filtros"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)", flexShrink: 0 }}
              >
                <SlidersHorizontal size={15} strokeWidth={1.5} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
                {heroPos} vs {villainPos} <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>· {stackBb}bb</span>
              </span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                {stats.hits}/{stats.total}
                {stats.total > 0 ? ` · ${sessionPct}%` : ""}
              </span>
            </div>

            <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
              <PokerTable
                hand={tableHand}
                seats={fullscreenSeatLayout}
                variant="treino"
                aspectRatio="3 / 5"
                minSeatScale={0.75}
                streetCommitments={streetCommitments}
                chipAnimation={chipAnimation}
              />

              {chosen && verdict && displayLabel && displayColor && (
                <VerdictCenterFlash
                  label={displayLabel}
                  color={displayColor}
                  isGood={isGoodVerdict}
                  freqPct={chosenFreqPct}
                  onDetails={() => setDetailsOpen(true)}
                />
              )}

              {/* Botoes de aposta a DIREITA, empilhados na vertical
                  (pedido explicito: "os botoes de apostas ficam a
                  direita, como e' nas plataformas") -- a mao do hero foi
                  deslocada pra esquerda (fullscreenSeatLayout, x:42 em
                  vez de 50) exatamente pra abrir esse espaco. Cada botao
                  com uma cor solida diferente (pedido explicito: "todos
                  mesmo tamanho um de cada cor") -- mesma paleta de acao
                  ja usada no resto do produto (drill-theme ACT: fold
                  cinza, call/acao correta verde, aposta/distrator azul).*/}
              <div style={{ position: "absolute", right: 10, top: "74%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 8, zIndex: 40 }}>
                {!chosen ? (
                  <>
                    <button onClick={() => setChosen("action")} style={fsActionBtnStyle("#1F9D6B")}>
                      {actionLabel}
                    </button>
                    {DISTRACTOR_LABEL[phaseKey] && (
                      <button onClick={() => setChosen("distractor")} style={fsActionBtnStyle("#2563EB")}>
                        {DISTRACTOR_LABEL[phaseKey]}
                      </button>
                    )}
                    <button onClick={() => setChosen("fold")} style={fsActionBtnStyle("#DC2626")}>
                      Fold
                    </button>
                  </>
                ) : (
                  <button onClick={() => nextRound(currentPhase)} style={fsActionBtnStyle("#FFFFFF", "#111111")}>
                    Próxima
                  </button>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Cabeçalho sempre com conteúdo visível -- antes ficava
          literalmente vazio (uma faixa preta sem nada) enquanto o
          primeiro spot ainda não tinha carregado e nenhuma mão tinha
          sido respondida ainda, parecendo um container quebrado.
          Contexto do spot usa heroPos/villainPos/stackBb (estado
          local, disponível na hora) em vez de esperar `spot` do banco;
          contador de sessão mostra um placeholder em 0/0 em vez de
          sumir. */}
      <div className="ps-tr-header" style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, minHeight: 34 }}>
        <button
          className="ps-tr-filters-toggle"
          onClick={() => setFiltersOpen((v) => !v)}
          title={filtersOpen ? "Esconder filtros" : "Mostrar filtros"}
          style={{ alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: filtersOpen ? "rgba(255,255,255,0.10)" : "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.7)", flexShrink: 0 }}
        >
          <SlidersHorizontal size={15} strokeWidth={1.5} />
        </button>

        <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", flexShrink: 0, whiteSpace: "nowrap" }}>
          {heroPos} vs {villainPos} <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>· {stackBb}bb</span>
        </span>

        <div className="ps-tr-session" style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", gap: 12, alignItems: "center" }}>
          <span style={{ fontFamily: F, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
            {stats.hits}/{stats.total} ótimas{stats.total > 0 ? ` · ${sessionPct}%` : ""}
          </span>
        </div>

        {tabs}
      </div>

      <div className="ps-tr-body" style={{ display: "grid", gridTemplateColumns: filtersOpen ? "240px minmax(0, 1fr)" : "0px minmax(0, 1fr)", gap: filtersOpen ? 12 : 0, minHeight: 0, transition: "grid-template-columns 180ms ease, gap 180ms ease" }}>
        <div
          className={`ps-tr-filters${filtersOpen ? " ps-tr-filters--open" : ""}`}
          style={{ position: "relative", minHeight: 0, overflow: filtersOpen ? "visible" : "hidden" }}
        >
          {filtersOpen && (
            <button
              onClick={() => setFiltersOpen(false)}
              title="Esconder filtros"
              style={{ position: "absolute", top: 10, right: 10, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.6)" }}
            >
              <X size={15} />
            </button>
          )}

          {/* height:100% -- sem isso o aside fica do tamanho do próprio
              conteúdo (5 seções de chips) e sobra um bloco morto vazio
              embaixo dele na coluna, já que a mesa ao lado é bem mais
              alta. O grid já estica o WRAPPER pra altura toda; faltava
              o aside herdar isso. */}
          <aside className="ps-tr-filters-scroll" style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 14, padding: "16px 14px", borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)", border: "1px solid rgba(255,255,255,0.08)", overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                Filtros
              </span>
              {isMobile ? (
                // Celular (pedido explicito: "ter botao de aplicar filtro
                // no inicio da modal e limpar tambem, pode ser apenas
                // icones") -- Aplicar fecha a gaveta e entra no modo
                // mesa-cheia; Limpar reseta pra combinacao padrao sem
                // fechar nada, pro jogador continuar escolhendo.
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={clearFilters}
                    title="Limpar filtros"
                    aria-label="Limpar filtros"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    onClick={applyFilters}
                    title="Aplicar filtros"
                    aria-label="Aplicar filtros"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "#FFFFFF", border: "1px solid #FFFFFF", color: "#111111", cursor: "pointer" }}
                  >
                    <Check size={15} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={clearFilters}
                  style={{ fontFamily: F, fontSize: 10.5, fontWeight: 500, color: "rgba(255,255,255,0.5)", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FilterSection label="Posição herói">
                {ALL_POSITIONS.map((p) => {
                  const n = stackCountForHero(p);
                  return (
                    <FilterChip key={p} label={n > 0 ? `${p} (${n})` : p} active={p === heroPos} disabled={n === 0} onClick={() => { setStats({ hits: 0, total: 0 }); setHeroPos(p); }} />
                  );
                })}
              </FilterSection>

              <FilterSection label="Posição vilão">
                {ALL_POSITIONS.map((p) => {
                  const n = stackCountForHeroVillain(heroPos, p);
                  return (
                    <FilterChip key={p} label={n > 0 ? `${p} (${n})` : p} active={p === villainPos} disabled={n === 0} onClick={() => { setStats({ hits: 0, total: 0 }); setVillainPos(p); }} />
                  );
                })}
              </FilterSection>

              <FilterSection label="Stack">
                {STACK_OPTIONS.map((s) => (
                  <FilterChip key={s} label={`${s}bb`} active={s === stackBb} disabled={!stacksForMatchup.includes(s)} onClick={() => { setStats({ hits: 0, total: 0 }); setStackBb(s); }} />
                ))}
              </FilterSection>

              <FilterSection label="Situação">
                {PHASES.map((p) => (
                  <FilterChip key={p.key} label={p.label} active={p.key === phaseKey} disabled={!spot} onClick={() => { setStats({ hits: 0, total: 0 }); setPhaseKey(p.key); }} />
                ))}
              </FilterSection>

              <FilterSection label="Tipo">
                {TYPE_OPTIONS.map((t) => (
                  <FilterChip
                    key={t.key}
                    label={t.label}
                    active={t.key === "icm"}
                    disabled={t.key !== "icm"}
                    disabledReason={t.key !== "icm" ? "ChipEV puro (sem considerar premiação) ainda não foi gerado pelo motor -- só ICM por enquanto" : undefined}
                    onClick={() => {}}
                  />
                ))}
              </FilterSection>
            </div>

            {/* Rodapé fixo no fim do card -- ocupa o espaço que sobra
                agora que o aside estica pra altura toda, em vez de
                deixar em branco. */}
            <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.35)" }}>
                {spots.length} spot{spots.length !== 1 ? "s" : ""} disponíve{spots.length !== 1 ? "is" : "l"} no total
              </span>
            </div>
          </aside>
        </div>

        {filtersOpen && (
          <div
            className="ps-tr-filters-backdrop"
            onClick={() => setFiltersOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 39 }}
          />
        )}

        <div className="ps-tr-table-col" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="ps-tr-table-inner" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "center", flex: 1, minHeight: 0, paddingTop: 6 }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <Loader2 size={32} color="rgba(255,255,255,0.5)" />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Carregando…</p>
              </div>
            ) : error || !spot || layoutError ? (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 320 }}>
                {error || layoutError?.message || emptyMessage}
              </p>
            ) : round && currentPhase && tableHand && seatLayout ? (
              <div className="ps-tr-table-wrap" style={{ width: "100%", height: "100%", maxWidth: 900, maxHeight: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {/* "vs Jam" testa a decisão do DEFENSOR, não do abridor
                    selecionado em "Posição herói" -- sem isso o jogador
                    pode ficar sem entender por que as cartas viradas
                    aparecem numa cadeira diferente da que ele escolheu
                    no filtro. Só aparece quando os dois divergem. */}
                {activeHeroSeat !== heroPos && (
                  <div style={{ fontFamily: F, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", textAlign: "center", flexShrink: 0 }}>
                    Nessa situação, quem decide é o <span style={{ color: "#FFFFFF" }}>{activeHeroSeat}</span> (defensor)
                  </div>
                )}

                {/* Altura fixa e SEMPRE presente (não só quando `chosen`)
                    -- antes esse bloco só entrava na árvore depois da
                    resposta, e por estar ANTES da mesa (coluna flex),
                    o surgimento empurrava a mesa pra baixo/comprimia
                    ela a cada mão. Reservando o espaço de antemão, a
                    mesa nunca se move -- só o conteúdo de dentro muda.
                    Conteúdo também ficou só a frase essencial (sem
                    "equity ICM"/"gap" na cara); os números completos
                    (que continuam existindo, intactos) foram pro
                    EvDetailsModal, atrás do botão "Ver detalhes". */}
                <div style={{ minHeight: 60, flexShrink: 0, display: "flex", alignItems: "center" }}>
                  {chosen && verdict && displayLabel && displayColor && plainFeedback && (
                    <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: F, background: "#0A0A0A", padding: "10px 14px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        {isGoodVerdict ? <CheckCircle2 size={18} color={displayColor} style={{ flexShrink: 0 }} /> : <XCircle size={18} color={displayColor} style={{ flexShrink: 0 }} />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: displayColor }}>{displayLabel}</div>
                          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>{plainFeedback}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setDetailsOpen(true)}
                        style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        <Info size={12} />
                        Ver detalhes
                      </button>
                    </div>
                  )}
                </div>

                {detailsOpen && chosen && round && currentPhase && (
                  <EvDetailsModal
                    onClose={() => setDetailsOpen(false)}
                    actionLabel={actionLabel}
                    distractorLabel={DISTRACTOR_LABEL[phaseKey] ?? null}
                    chosen={chosen}
                    foldPct={Math.round((1 - round.freq) * 100)}
                    actionPct={Math.round(round.freq * 100)}
                    gapRelativePct={gapRelativePct}
                    evFold={currentPhase.ev_fold}
                    evAction={round.ev}
                    isMarginal={isMarginal}
                  />
                )}

                <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
                  <PokerTable hand={tableHand} seats={seatLayout} variant="treino" streetCommitments={streetCommitments} chipAnimation={chipAnimation} />
                  {chosen && verdict && displayLabel && displayColor && (
                    <VerdictFlash label={displayLabel} color={displayColor} isGood={isGoodVerdict} freqPct={chosenFreqPct} />
                  )}
                </div>

                <div className="ps-tr-actions" style={{ minHeight: 68, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {!chosen ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1, justifyContent: "center" }}>
                      <button
                        onClick={() => setChosen("fold")}
                        style={{ fontFamily: F, minWidth: 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "13px 18px", fontSize: 14.5, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" }}
                      >
                        Fold
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Q</span>
                      </button>
                      <button
                        onClick={() => setChosen("action")}
                        style={{ fontFamily: F, minWidth: 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "13px 18px", fontSize: 14.5, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" }}
                      >
                        {actionLabel}
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>W</span>
                      </button>
                      {/* 3o botão -- sempre uma jogada que o GTO nunca
                          recomenda aqui (frequência 0), pedido explícito
                          pra tirar a decisão binária fold/ação e forçar
                          o jogador a de fato escolher entre 3+ opções
                          (mais parecido com uma mesa real). Só existe
                          quando há uma jogada real pra oferecer como
                          errada -- em "vs All-in" (sbCallJam) não tem
                          (fold ou call são as únicas ações possíveis
                          depois de alguém all-in num pote HU). */}
                      {DISTRACTOR_LABEL[phaseKey] && (
                        <button
                          onClick={() => setChosen("distractor")}
                          style={{ fontFamily: F, minWidth: 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "13px 18px", fontSize: 14.5, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" }}
                        >
                          {DISTRACTOR_LABEL[phaseKey]}
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>E</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Mesmo padrão de transição já usado no pós-flop
                          ("Você jogou X — resumo acima"), em vez de só
                          o botão sozinho. */}
                      <div style={{ fontFamily: F, flex: 1, padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                        Você jogou <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{chosen === "fold" ? "Fold" : chosen === "distractor" ? DISTRACTOR_LABEL[phaseKey] ?? "outra" : actionLabel}</span> — resumo acima.
                      </div>
                      <button
                        onClick={() => nextRound(currentPhase)}
                        style={{ fontFamily: F, background: "#FFFFFF", color: "#111111", border: 0, borderRadius: 10, padding: "10px 24px", cursor: "pointer", fontWeight: 500, fontSize: 13, flexShrink: 0 }}
                      >
                        Próxima <span style={{ fontSize: 11, color: "rgba(0,0,0,0.5)" }}>(espaço)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
