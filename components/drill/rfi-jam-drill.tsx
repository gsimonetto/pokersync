"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, X, CheckCircle2, XCircle, Info } from "lucide-react";
import { classifyFrequency, verdictColor, type Verdict } from "@/lib/poker/gto-verdict";
import { TreinoResponsiveStyles } from "@/components/drill/treino-responsive-styles";
import { PokerTable, type TableHand, type SeatState } from "@/components/drill/poker-table";
import { computeStylizedSeatLayout } from "@/lib/poker/seat-layout";
import { registerTraining } from "@/lib/services/xp-service";
import { ModalPortal } from "@/components/modal-portal";
import { useEscapeToClose } from "@/lib/hooks/use-escape-to-close";
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

function FilterChip({
  label, active, disabled, onClick, disabledReason,
}: { label: string; active: boolean; disabled?: boolean; onClick: () => void; disabledReason?: string }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledReason ?? "Sem mãos geradas para essa combinação ainda" : undefined}
      style={{
        fontFamily: F,
        padding: "6px 12px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        border: active ? "1px solid rgba(255,255,255,0.9)" : disabled ? "1px dashed rgba(255,255,255,0.07)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "#FFFFFF" : "rgba(255,255,255,0.02)",
        color: active ? "#111111" : disabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.55)",
        textDecoration: disabled ? "line-through" : "none",
        transition: "all 160ms ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
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
  onClose, actionLabel, chosen, foldPct, actionPct, gapRelativePct, evFold, evAction, isMarginal,
}: {
  onClose: () => void;
  actionLabel: string;
  chosen: "fold" | "action";
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
              </div>
              {isMarginal && (
                <p style={{ marginTop: 10, fontSize: 11.5, lineHeight: 1.5, color: "rgba(255,255,255,0.5)" }}>
                  As duas opções valem praticamente o mesmo aqui — por isso o GTO mistura {actionPct}/{foldPct} em vez de escolher só uma. Não é indecisão, é assim que o equilíbrio funciona nesse spot.
                </p>
              )}
            </div>

            <div style={{ paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                Quanto isso vale
              </span>
              <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: isMarginal ? "#f5a524" : "#FFFFFF" }}>
                  {gapRelativePct != null ? `${gapRelativePct.toFixed(1)}%` : "—"}
                </span>
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>de diferença entre Fold e {actionLabel.toLowerCase()}</span>
              </div>
              <p style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.35)" }}>
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
  // Sugestao vinda de fora (hoje: leak da Gestao de Banca — "voce perde
  // em MTT" aponta pra praticar stack curto). So' aplica se existir spot
  // de verdade com esse stack; senao cai no default de sempre.
  initialStackBb?: number;
}

// Tela única de treino (pré-flop RFI/Jam por enquanto -- é o único
// tipo de spot com dado real no banco hoje). Sem abas: filtros à
// esquerda, mesa (com o herói de verdade sentado, feltro azul) no
// meio, resultado GTO numa linha acima da mesa.
export function RfiJamDrill({ tabs, initialStackBb }: RfiJamDrillProps) {
  const [spots, setSpots] = useState<RfiJamListItem[]>([]);
  const [heroPos, setHeroPos] = useState<string>("SB");
  const [villainPos, setVillainPos] = useState<string>("BB");
  const [stackBb, setStackBb] = useState<number>(15);
  const [spot, setSpot] = useState<RfiJamSpot | null>(null);
  const [phaseKey, setPhaseKey] = useState<(typeof PHASES)[number]["key"]>("sbOpen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Desktop comeca com os filtros abertos (igual sempre foi); mobile
  // comeca fechado (gaveta, evita cobrir a mesa de cara). matchMedia so'
  // roda uma vez no mount, no client.
  const [filtersOpen, setFiltersOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 769px)").matches;
  });

  const [round, setRound] = useState<Round | null>(null);
  const [chosen, setChosen] = useState<"fold" | "action" | null>(null);
  const [stats, setStats] = useState({ hits: 0, total: 0 });
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    listRfiJamSpots()
      .then((rows) => {
        setSpots(rows);
        if (rows.length > 0) {
          const suggested = initialStackBb != null ? rows.find((r) => r.stackBb === initialStackBb) : undefined;
          const base = suggested ?? rows[0];
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
  }, [initialStackBb]);

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

  const verdict: Verdict | null = useMemo(() => {
    if (!round || !chosen) return null;
    const chosenFreq = chosen === "fold" ? 1 - round.freq : round.freq;
    return classifyFrequency(chosenFreq);
  }, [round, chosen]);

  // O veredito real (acertei/errei) NUNCA é substituído por "MARGINAL" --
  // antes o rótulo virava "MARGINAL" sempre que o gap era pequeno,
  // escondendo se a jogada escolhida era boa ou ruim (dois jogadores
  // podem cair num spot "marginal" e um ter acertado, outro não -- o
  // rótulo não podia dizer isso). "Marginal" agora é uma tag SEPARADA,
  // ao lado do veredito, não no lugar dele.
  const displayLabel = verdict ? VERDICT_LABEL[verdict] : undefined;
  const displayColor = verdict ? verdictColor(verdict) : undefined;
  const isGoodVerdict = verdict === "OTIMA" || verdict === "ACEITAVEL";
  const chosenFreqPct = round && chosen ? Math.round((chosen === "fold" ? 1 - round.freq : round.freq) * 100) : null;
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
    if (isMarginal) return "As duas jogadas valem praticamente o mesmo aqui — não tinha erro grave possível.";
    const chosenLabel = chosen === "fold" ? "Fold" : actionLabel;
    const otherLabel = chosen === "fold" ? actionLabel : "Fold";
    if (isGoodVerdict) return `Boa escolha — o GTO também prefere ${chosenLabel} na maioria das vezes aqui.`;
    return `O GTO prefere ${otherLabel} na maioria das vezes aqui.`;
  }, [round, chosen, currentPhase, isMarginal, isGoodVerdict, actionLabel]);

  useEffect(() => {
    if (!chosen || !verdict || verdict === "UNKNOWN" || !round) return;
    setStats((prev) => ({ hits: prev.hits + (verdict === "OTIMA" ? 1 : 0), total: prev.total + 1 }));
    const isGood = verdict === "OTIMA" || verdict === "ACEITAVEL";
    registerTraining({
      spotId: spot?.spotId ?? null,
      verdict: VERDICT_TO_RPC[verdict],
      evLoss: isGood ? 0 : Math.max(0, round.gap),
      userAction: chosen === "fold" ? "FOLD" : currentPhase?.action ?? null,
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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chosen, currentPhase, nextRound]);

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

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 8, height: "100%", minHeight: 0, position: "relative" }}>
      <TreinoResponsiveStyles />

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
          <aside style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 14, padding: "16px 14px", borderRadius: 14, background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)", border: "1px solid rgba(255,255,255,0.08)", overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
                Filtros
              </span>
              <button
                onClick={() => {
                  setStats({ hits: 0, total: 0 });
                  if (spots.length > 0) {
                    const { hero, villain } = parseMatchup(spots[0].matchup);
                    if (hero) setHeroPos(hero);
                    if (villain) setVillainPos(villain);
                    setStackBb(spots[0].stackBb);
                  }
                  setPhaseKey("sbOpen");
                }}
                style={{ fontFamily: F, fontSize: 10.5, fontWeight: 500, color: "rgba(255,255,255,0.5)", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}
              >
                Limpar filtros
              </button>
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
                  <PokerTable hand={tableHand} seats={seatLayout} variant="treino" />
                  {chosen && verdict && displayLabel && displayColor && (
                    <VerdictFlash label={displayLabel} color={displayColor} isGood={isGoodVerdict} freqPct={chosenFreqPct} />
                  )}
                </div>

                <div className="ps-tr-actions" style={{ height: 68, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {!chosen ? (
                    <div style={{ display: "flex", gap: 10, flex: 1, justifyContent: "center" }}>
                      <button
                        onClick={() => setChosen("fold")}
                        style={{ fontFamily: F, minWidth: 130, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "13px 22px", fontSize: 14.5, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" }}
                      >
                        Fold
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Q</span>
                      </button>
                      <button
                        onClick={() => setChosen("action")}
                        style={{ fontFamily: F, minWidth: 130, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 10, border: "1px solid rgba(255,255,255,0.10)", background: "#1A1A1A", padding: "13px 22px", fontSize: 14.5, fontWeight: 600, color: "#FFFFFF", cursor: "pointer" }}
                      >
                        {actionLabel}
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>W</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Mesmo padrão de transição já usado no pós-flop
                          ("Você jogou X — resumo acima"), em vez de só
                          o botão sozinho. */}
                      <div style={{ fontFamily: F, flex: 1, padding: "10px 16px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                        Você jogou <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>{chosen === "fold" ? "Fold" : actionLabel}</span> — resumo acima.
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
