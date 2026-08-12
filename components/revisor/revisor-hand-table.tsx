"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Play, Pause, Target, Loader2 } from "lucide-react";
import { PokerTable } from "@/components/drill/poker-table";
import { projectHandAtStep, HandReplayError, type ReplayState } from "@/lib/poker/hand-replay-projector";
import { classifyAndResolve } from "@/lib/poker/situation-classifier";
import type { ParsedHand } from "@/lib/poker/hand-parser";
import { F, T, num } from "@/lib/poker/drill-theme";

// Mesa PERSISTENTE do Revisor de Mãos — decisao de arquitetura (2026-08):
// "a mesa precisa estar presente a todo momento". Componente proprio,
// separado do /treino (que voltou a ser so filtros GTO). Reusa o mesmo
// PokerTable e o mesmo projector step-by-step, mas vive no Revisor com
// seu proprio controle de navegacao — nao compartilha estado com o Treino.
//
// "Treinar esse spot": so aparece quando a rua atual e' postflop (nao ha
// drills de preflop na base — mesma regra ja aplicada em "Treinar esse
// leak") E a posicao do hero e' uma das suportadas pelos drills (BB/BTN/SB)
// E o classifier consegue resolver a situacao preflop (vs Open/3-Bet) via
// situation_dictionary. Qualquer uma dessas faltando, o botao fica oculto
// — nunca leva pro Treino sem filtro certo.

const SUPPORTED_DRILL_POSITIONS = new Set(["BB", "BTN", "SB"]);

const AUTOPLAY_SPEEDS = [
  { label: "Devagar", ms: 1600 },
  { label: "Normal", ms: 900 },
  { label: "Rápido", ms: 500 },
];

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: "#FFFFFF", ...num }}>{value}</span>
    </div>
  );
}

export function RevisorHandTable({
  parsedHand,
  onFatalError,
}: {
  parsedHand: ParsedHand;
  // Chamado quando o replay dessa mao especifica nao pode ser montado
  // (ex: pote calculado nao bate com o total da mao — sanity check do
  // projector). Pedido explicito (2026-08): em vez de travar numa tela
  // de erro, avancar automaticamente pra proxima mao da fila, "independente
  // do que causou o erro". Quem sabe qual e' "a proxima mao" e' o
  // consumidor (RevisorSessao tem a lista) — esse componente so avisa.
  // Se omitido, mantem o comportamento antigo: mostra a caixa de erro
  // (usado por quem chama RevisorHandTable fora de uma fila navegavel,
  // ex: RevisorDetalhe).
  onFatalError?: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const previousStepRef = useRef(0);
  const [autoplay, setAutoplay] = useState(false);
  const [autoplaySpeed, setAutoplaySpeed] = useState(1);

  // Resolvido uma vez por mao (a situacao preflop nao muda step a step,
  // so a rua muda). Consulta situation_dictionary no Supabase — por isso
  // e' assincrono e comeca null ate resolver.
  const [situationAction, setSituationAction] = useState<string | null | "pending">("pending");

  useEffect(() => {
    let cancelled = false;
    setSituationAction("pending");
    classifyAndResolve(parsedHand)
      .then((resolved) => {
        if (!cancelled) setSituationAction(resolved?.action ?? null);
      })
      .catch(() => {
        if (!cancelled) setSituationAction(null);
      });
    return () => {
      cancelled = true;
    };
  }, [parsedHand]);

  const { replayState, replayError } = useMemo((): { replayState: ReplayState | null; replayError: string | null } => {
    // Guarda defensiva pra maos importadas ANTES do parser ganhar
    // seats/buttonSeat/maxSeats (campos adicionados depois, pro motor de
    // replay). Sem isso, computeRealSeatLayout quebra tentando ler
    // .length de undefined e o erro cru do JS aparece pro usuario. Mao
    // antiga sem esses campos: mensagem clara, resto da review continua
    // funcionando normal (nunca bloqueia por causa da mesa).
    if (!parsedHand.seats || parsedHand.seats.length === 0 || parsedHand.buttonSeat == null || parsedHand.maxSeats == null) {
      return {
        replayState: null,
        replayError: "Essa mão foi importada antes do suporte à mesa completa e não tem dados de assentos suficientes pra montar o replay. Mãos importadas a partir de agora já vêm com esses dados.",
      };
    }
    try {
      return { replayState: projectHandAtStep(parsedHand, stepIndex, previousStepRef.current), replayError: null };
    } catch (e) {
      if (e instanceof HandReplayError) return { replayState: null, replayError: e.message };
      return { replayState: null, replayError: e instanceof Error ? e.message : "Erro ao montar a mesa dessa mão." };
    }
  }, [parsedHand, stepIndex]);

  // Dispara o callback pro consumidor (RevisorSessao) trocar de mao
  // assim que um erro aparece — nao renderiza a caixa de erro nesse caso,
  // so um indicador transitorio (ver return abaixo), porque a troca de
  // mao e' quase instantanea e a caixa de erro pisca sem necessidade.
  useEffect(() => {
    if (replayError && onFatalError) {
      onFatalError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayError]);

  const chipAnimation = useMemo(() => {
    if (!replayState) return null;
    const ev = replayState.currentEvent;
    if (!ev || ev.kind !== "action" || ev.chipsAdded <= 0 || !replayState.isAdvancing) return null;
    // chipsAdded vem em fichas cruas (raw) — bbUnit converte pro mesmo
    // padrao de stack/pot exibido no resto da mesa (bug corrigido: antes
    // a ficha voadora mostrava valor de ficha bruta rotulado como "bb").
    const amountBB = Math.round((ev.chipsAdded / replayState.bbUnit) * 10) / 10;
    return { fromPosLabel: ev.posLabel, amount: amountBB, key: `${stepIndex}-${ev.posLabel}` };
  }, [replayState, stepIndex]);

  const nextStep = useCallback(() => {
    if (!replayState || stepIndex >= replayState.stepCount - 1) {
      setAutoplay(false);
      return;
    }
    previousStepRef.current = stepIndex;
    setStepIndex((i) => i + 1);
  }, [replayState, stepIndex]);

  const prevStep = useCallback(() => {
    if (stepIndex === 0) return;
    previousStepRef.current = stepIndex;
    setStepIndex((i) => Math.max(0, i - 1));
  }, [stepIndex]);

  useEffect(() => {
    if (!autoplay) return;
    const ms = AUTOPLAY_SPEEDS[autoplaySpeed].ms;
    const timer = setTimeout(() => nextStep(), ms);
    return () => clearTimeout(timer);
  }, [autoplay, autoplaySpeed, stepIndex, nextStep]);

  // Link "Treinar esse spot" — so existe quando rua e' postflop, posicao
  // suportada pelos drills, e a situacao preflop foi resolvida com sucesso.
  const trainHref = useMemo(() => {
    if (!replayState || situationAction === "pending" || !situationAction) return null;
    const streetLabel = replayState.currentStreetLabel; // "PREFLOP" | "FLOP" | "TURN" | "RIVER"
    if (streetLabel === "PREFLOP") return null;
    const street = streetLabel === "FLOP" ? "Flop" : streetLabel === "TURN" ? "Turn" : "River";
    const position = parsedHand.heroPosition;
    if (!position || !SUPPORTED_DRILL_POSITIONS.has(position)) return null;
    const params = new URLSearchParams({ pos: position, action: situationAction, street });
    return `/treino?${params.toString()}`;
  }, [replayState, situationAction, parsedHand.heroPosition]);

  if (replayError || !replayState) {
    // Consumidor com fila (RevisorSessao) trata o erro avancando pra
    // proxima mao — mostra so um indicador leve de transicao em vez da
    // caixa de erro, que ficaria piscando sem o usuario nem ler.
    if (onFatalError) {
      return (
        <div
          style={{
            fontFamily: F,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "24px 16px",
            borderRadius: 14,
            background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
            border: "1px solid rgba(255,255,255,0.08)",
            minHeight: 200,
            color: "rgba(255,255,255,0.4)",
            fontSize: 12.5,
          }}
        >
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          Avançando pra próxima mão…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return (
      <div
        style={{
          fontFamily: F,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "24px 16px",
          borderRadius: 14,
          background: "linear-gradient(180deg, #0F0F0F, #0A0A0A)",
          border: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}
      >
        <AlertTriangle size={22} color={T.bad} />
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12.5, lineHeight: 1.5, margin: 0, maxWidth: 380 }}>
          {replayError ?? "Não foi possível montar a mesa dessa mão."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          background: "#050505",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: 10,
          // overflow:hidden — bug corrigido: sem isso, conteudo de seat
          // (chip de nome, fichas paradas) que se acumula conforme a acao
          // avanca podia vazar visualmente pra fora da caixa de 500px,
          // dando a impressao de "a mesa vai crescendo". Agora fica
          // sempre travada no tamanho definido, clipando qualquer excesso.
          overflow: "hidden",
        }}
      >
        {/* Altura responsiva por breakpoint (className, nao inline) — fixa
            e diferente por formato: menor no celular, media no tablet,
            maior no desktop. Pedido explicito: "precisa ser fixa pro
            desktop e se ajustar em outro formato (cel, tablet)". */}
        {/* Altura ganhou um breakpoint a mais (xl) — pedido: "notebook,
            deveria ser responsivo". 500px em telas grandes (1280px+)
            deixava pouca folga vertical pros nomes de cima/baixo; 560px
            a partir de xl (1280px+) da mais espaco sem forcar rolagem
            em telas medias. */}
        <div className="h-[360px] overflow-hidden sm:h-[420px] lg:h-[500px] xl:h-[560px]">
          <PokerTable hand={replayState.tableHand} seats={replayState.seatLayout} chipAnimation={chipAnimation} streetCommitments={replayState.streetCommitments} />
        </div>

        {/* Espaçamento aumentado (10 -> 22) — pedido explicito: "a
            velocidade esta em cima do stack do hero". O stack do hero
            fica bem perto da borda inferior da mesa; sem folga suficiente
            aqui o seletor de velocidade parecia colado/sobreposto nele. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 22 }}>
          <button
            onClick={prevStep}
            disabled={replayState.stepIndex === 0}
            style={{
              display: "flex", alignItems: "center", gap: 4, background: "transparent",
              border: "1px solid rgba(255,255,255,0.14)",
              color: replayState.stepIndex === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.75)",
              borderRadius: 10, padding: "8px 12px", cursor: replayState.stepIndex === 0 ? "not-allowed" : "pointer",
              fontWeight: 500, fontSize: 12,
            }}
          >
            <ChevronLeft size={13} /> Anterior
          </button>

          <button
            onClick={() => setAutoplay((v) => !v)}
            disabled={replayState.stepIndex >= replayState.stepCount - 1}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: autoplay ? "rgba(52,211,153,0.15)" : "transparent",
              border: `1px solid ${autoplay ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.14)"}`,
              color: replayState.stepIndex >= replayState.stepCount - 1 ? "rgba(255,255,255,0.25)" : autoplay ? "#6EE7B7" : "rgba(255,255,255,0.75)",
              borderRadius: 10, padding: "8px 12px", cursor: replayState.stepIndex >= replayState.stepCount - 1 ? "not-allowed" : "pointer",
              fontWeight: 500, fontSize: 12,
            }}
          >
            {autoplay ? <Pause size={12} /> : <Play size={12} />}
          </button>

          <select
            value={autoplaySpeed}
            onChange={(e) => setAutoplaySpeed(Number(e.target.value))}
            style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.75)", borderRadius: 10, padding: "7px 8px", fontSize: 11, fontFamily: F, cursor: "pointer", outline: "none" }}
          >
            {AUTOPLAY_SPEEDS.map((s, i) => (
              <option key={i} value={i}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={nextStep}
            disabled={replayState.stepIndex >= replayState.stepCount - 1}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: replayState.stepIndex >= replayState.stepCount - 1 ? "transparent" : "#FFFFFF",
              border: replayState.stepIndex >= replayState.stepCount - 1 ? "1px solid rgba(255,255,255,0.14)" : "0",
              color: replayState.stepIndex >= replayState.stepCount - 1 ? "rgba(255,255,255,0.25)" : "#111111",
              borderRadius: 10, padding: "8px 12px", cursor: replayState.stepIndex >= replayState.stepCount - 1 ? "not-allowed" : "pointer",
              fontWeight: 500, fontSize: 12,
            }}
          >
            Próximo <ChevronRight size={13} />
          </button>

          <span style={{ marginLeft: 4, fontSize: 11, color: "rgba(255,255,255,0.4)", ...num }}>
            {replayState.stepIndex + 1}/{replayState.stepCount}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 16, flex: 1, minWidth: 0 }}>
          <StatRow label="Blinds" value={`${parsedHand.smallBlind}/${parsedHand.bigBlind}`} />
          <StatRow label="Mesa" value={`${parsedHand.seats.length}-max`} />
        </div>

        {trainHref ? (
          <Link
            href={trainHref}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)",
              color: "#C4B5FD", borderRadius: 10, padding: "8px 14px",
              fontFamily: F, fontSize: 12.5, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            <Target size={13} /> Treinar esse spot
          </Link>
        ) : (
          situationAction !== "pending" && (
            <span
              title="Sem drill correspondente pra essa rua/posição/situação"
              style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}
            >
              Sem drill correspondente
            </span>
          )
        )}
      </div>
    </div>
  );
}
