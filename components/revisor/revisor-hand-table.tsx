"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Play, Pause, Target, Loader2, Share2, Trophy } from "lucide-react";
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
//
// 2026-08 v9 (pedido explicito): correcoes de UX na tela de revisao —
// 1) removido o seletor de velocidade do autoplay (fixo em "Normal").
// 2) header proprio no topo da mesa com o nome do torneio, sem contagem
//    de jogadores, com "Analisar mão" reposicionado pro canto superior
//    direito como botao estilo chip (neutro, so destaca no hover).
// 3) botao "Compartilhar com o coach" ao lado, sempre visivel — envia o
//    hand history dessa mao pro coach abrir no replayer dele (Modo
//    Time). Sem time vinculado, fica em estado "em breve" (desabilitado
//    com tooltip apontando pra Comunidade, ainda nao implementada) em
//    vez de sumir — pedido explicito: "pode colocar la pra quem nao tem
//    time, mas sendo possivel compartilhar na comunidade quando estiver
//    pronto".

const SUPPORTED_DRILL_POSITIONS = new Set(["BB", "BTN", "SB"]);

// Velocidade do autoplay fixa (pedido explicito: "tirar a velocidade do
// play automatico" — sem seletor visivel na tela, so um valor razoavel
// fixo em codigo).
const AUTOPLAY_MS = 900;

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: "#FFFFFF", ...num }}>{value}</span>
    </div>
  );
}

// Botao "modelo chips" — pill discreta com friso fino, neutra por
// padrao e so ganhando destaque real no hover (pedido explicito). Usado
// tanto pro "Analisar mão" quanto pro "Compartilhar", pra manter os dois
// no mesmo padrao visual no canto superior direito.
function ChipButton({
  icon,
  label,
  onClick,
  href,
  disabled,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [hover, setHover] = useState(false);
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: F,
    fontSize: 12,
    fontWeight: 500,
    padding: "7px 13px",
    borderRadius: 999,
    border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : hover ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.14)"}`,
    background: disabled ? "rgba(255,255,255,0.02)" : hover ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
    color: disabled ? "rgba(255,255,255,0.25)" : hover ? "#FFFFFF" : "rgba(255,255,255,0.75)",
    whiteSpace: "nowrap",
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "none",
    transition: "all 150ms ease",
  };
  const content = (
    <>
      {icon}
      {label}
    </>
  );
  if (href && !disabled) {
    return (
      <Link href={href} title={title} style={style} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {content}
    </button>
  );
}

export function RevisorHandTable({
  parsedHand,
  tournamentName,
  hasTeam = false,
  onShareWithCoach,
  onOpenHand,
  onFatalError,
}: {
  parsedHand: ParsedHand;
  // Nome do torneio sendo revisado — exibido no header da mesa. Opcional
  // porque nem todo consumidor de RevisorHandTable tem esse dado a mao
  // (ex: usos fora do contexto de sessao); se ausente, o header so nao
  // mostra o nome (nunca quebra o layout).
  tournamentName?: string | null;
  // Se o jogador esta vinculado a um time — controla se "Compartilhar
  // com o coach" fica ativo ou em estado "em breve".
  hasTeam?: boolean;
  // Chamado quando o jogador clica em compartilhar E ha time vinculado.
  // Quem implementa o envio (hand history -> coach) e' o consumidor;
  // esse componente so dispara a intencao.
  onShareWithCoach?: () => void;
  // Chamado quando o jogador clica em "Analisar mão" no header — leva
  // pra RevisorDetalhe (perguntas guiadas, self-eval, drill suggestion).
  // Se omitido, o botao "Analisar mão" nao aparece (em vez de renderizar
  // um botao morto sem acao nenhuma).
  onOpenHand?: () => void;
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
    const timer = setTimeout(() => nextStep(), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [autoplay, stepIndex, nextStep]);

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

  const canAnalyze = !!replayState && !!onOpenHand;
  const shareTitle = hasTeam
    ? "Enviar essa mão pro seu coach"
    : "Disponível quando você entrar num time — em breve também pela Comunidade";

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
        {/* Header da mesa (novo, pedido explicito): nome do torneio a
            esquerda, "Analisar mão" e "Compartilhar" como botoes chip no
            canto superior direito. Substitui o antigo botao "Analisar
            essa mão em detalhe" que ficava embaixo da mesa inteira — e'
            o mesmo destino (onOpenHand/trainDetail), so reposicionado
            pra sempre visivel sem rolar. Numero de jogadores na mesa foi
            removido daqui (ja aparece nos StatRows abaixo, sem duplicar). */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
            <Trophy size={13} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
            <span
              style={{
                fontFamily: F,
                fontSize: 12.5,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={tournamentName ?? undefined}
            >
              {tournamentName ?? "Torneio sem nome"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <ChipButton
              icon={<Share2 size={13} />}
              label="Compartilhar"
              title={shareTitle}
              disabled={!hasTeam}
              onClick={onShareWithCoach}
            />
            {canAnalyze && (
              <ChipButton icon={<Target size={13} />} label="Analisar mão" onClick={onOpenHand} title="Analisar essa mão em detalhe" />
            )}
          </div>
        </div>

        {/* Controles de navegacao/autoplay — seletor de velocidade
            removido (pedido explicito), autoplay roda em ritmo fixo. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
          <button
            onClick={prevStep}
            disabled={replayState.stepIndex === 0}
            aria-label="Passo anterior"
            title="Anterior"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", background: "transparent",
              border: "1px solid rgba(255,255,255,0.14)",
              color: replayState.stepIndex === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.75)",
              borderRadius: 10, width: 34, height: 34, cursor: replayState.stepIndex === 0 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={15} />
          </button>

          <button
            onClick={() => setAutoplay((v) => !v)}
            disabled={replayState.stepIndex >= replayState.stepCount - 1}
            aria-label={autoplay ? "Pausar" : "Reproduzir"}
            title={autoplay ? "Pausar" : "Reproduzir"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              background: autoplay ? "rgba(52,211,153,0.15)" : "transparent",
              border: `1px solid ${autoplay ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.14)"}`,
              color: replayState.stepIndex >= replayState.stepCount - 1 ? "rgba(255,255,255,0.25)" : autoplay ? "#6EE7B7" : "rgba(255,255,255,0.75)",
              borderRadius: 10, width: 34, height: 34, cursor: replayState.stepIndex >= replayState.stepCount - 1 ? "not-allowed" : "pointer",
            }}
          >
            {autoplay ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <button
            onClick={nextStep}
            disabled={replayState.stepIndex >= replayState.stepCount - 1}
            aria-label="Próximo passo"
            title="Próximo"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              background: replayState.stepIndex >= replayState.stepCount - 1 ? "transparent" : "#FFFFFF",
              border: replayState.stepIndex >= replayState.stepCount - 1 ? "1px solid rgba(255,255,255,0.14)" : "0",
              color: replayState.stepIndex >= replayState.stepCount - 1 ? "rgba(255,255,255,0.25)" : "#111111",
              borderRadius: 10, width: 34, height: 34, cursor: replayState.stepIndex >= replayState.stepCount - 1 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronRight size={15} />
          </button>

          <span style={{ marginLeft: 2, fontSize: 11, color: "rgba(255,255,255,0.4)", ...num }}>
            {replayState.stepIndex + 1}/{replayState.stepCount}
          </span>
        </div>

        {/* Altura responsiva por breakpoint (className, nao inline) — fixa
            e diferente por formato: menor no celular, media no tablet,
            maior no desktop. */}
        <div className="h-[360px] overflow-hidden sm:h-[420px] lg:h-[500px] xl:h-[520px]">
          <PokerTable hand={replayState.tableHand} seats={replayState.seatLayout} chipAnimation={chipAnimation} streetCommitments={replayState.streetCommitments} />
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
