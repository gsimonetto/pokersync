"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bookmark, ChevronLeft, ChevronRight, Play, Pause, Target, Loader2, Share2, Trophy, Layers } from "lucide-react";
import { PokerTable } from "@/components/drill/poker-table";
import { ShareHandModal } from "./share-hand-modal";
import { OpponentStatsModal } from "./opponent-stats-modal";
import { fetchSpotSaved, setSpotSaved } from "@/lib/services/hand-review-service";
import { fetchOpponentsStatsForHand, type OpponentStats } from "@/lib/services/opponent-stats-service";
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

// Chip estático (não clicável) — mesmo visual do ChipButton, usado pra
// exibir info (torneio/blinds) em vez de disparar ação.
function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="ps-rv-table-header-chip"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: F,
        fontSize: 12,
        fontWeight: 500,
        padding: "7px 12px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
        color: "rgba(255,255,255,0.75)",
        whiteSpace: "nowrap",
        minWidth: 0,
      }}
    >
      {icon}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
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
      <Link href={href} title={title} className="ps-rv-table-action-btn" style={style} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
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
      className="ps-rv-table-action-btn"
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
  reviewId,
  onOpenHand,
  onFatalError,
}: {
  parsedHand: ParsedHand;
  // Nome do torneio sendo revisado — exibido no header da mesa. Opcional
  // porque nem todo consumidor de RevisorHandTable tem esse dado a mao
  // (ex: usos fora do contexto de sessao); se ausente, o header so nao
  // mostra o nome (nunca quebra o layout).
  tournamentName?: string | null;
  // Id da hand_review correspondente — necessario pro botao "Compartilhar"
  // abrir a modal de perguntas guiadas (ShareHandModal) e pra salvar as
  // respostas/compartilhar via hand_review_shares (mesma infra que
  // "Analisar mão" ja usa). Se ausente, o botao "Compartilhar" fica
  // oculto (igual ao padrao ja usado em onOpenHand/canAnalyze).
  reviewId?: string;
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
  // Modal de compartilhamento (pedido explicito) — abre com as mesmas
  // perguntas guiadas do "Analisar mão"; ver share-hand-modal.tsx.
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // "Salvar spot" direto na mesa (pedido explicito, 2026-08): antes so
  // existia dentro de "Analisar mão" (RevisorDetalhe) -- pra maos de
  // torneio, navegadas aqui uma a uma numa sessao, isso significava abrir
  // a analise completa so pra marcar "quero rever essa depois", entao na
  // pratica o botao so era usado em maos avulsas. Mesma biblioteca de
  // destino dos dois casos (aba "Salvos", ver revisor-spots-salvos.tsx).
  const [saved, setSaved] = useState(false);
  const [savingSpot, setSavingSpot] = useState(false);

  // Perfil dos oponentes sentados nessa mão (VPIP/PFR/3-Bet aparecem
  // direto no assento; o resto só na modal, ver opponentClicked abaixo).
  // Mapa por nome pra o PokerTable so' precisar de um lookup por assento.
  const [opponentStats, setOpponentStats] = useState<Record<string, OpponentStats>>({});
  const [opponentClicked, setOpponentClicked] = useState<OpponentStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOpponentsStatsForHand(parsedHand)
      .then((rows) => {
        if (cancelled) return;
        setOpponentStats(Object.fromEntries(rows.map((r) => [r.opponentName, r])));
      })
      .catch(() => {
        if (!cancelled) setOpponentStats({});
      });
    return () => {
      cancelled = true;
    };
  }, [parsedHand]);

  useEffect(() => {
    if (!reviewId) {
      setSaved(false);
      return;
    }
    let cancelled = false;
    fetchSpotSaved(reviewId)
      .then((v) => {
        if (!cancelled) setSaved(v);
      })
      .catch(() => {
        // sem permissao/erro de rede -- fica como "nao salvo", nao trava a mesa
      });
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  async function toggleSaved() {
    if (!reviewId || savingSpot) return;
    const next = !saved;
    setSaved(next);
    setSavingSpot(true);
    try {
      await setSpotSaved(reviewId, next);
    } catch {
      setSaved(!next);
    } finally {
      setSavingSpot(false);
    }
  }

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

  // Atalhos de teclado (setas + espaço) -- padrao de qualquer replayer
  // de mao (Hand2Note, PokerTracker): navegar so no mouse era o unico
  // jeito antes, mesmo o Treino ja tendo atalhos (Q/W/espaço) pro drill.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (e.code === "ArrowRight") {
        e.preventDefault();
        nextStep();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      } else if (e.code === "Space") {
        e.preventDefault();
        setAutoplay((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextStep, prevStep]);

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
  const canShare = !!reviewId;
  // So aparece quando ha pra onde "Analisar mao" levar (onOpenHand) --
  // ou seja, quando esta tela e' a mesa de navegacao de uma sessao
  // (RevisorSessao), nao a propria RevisorDetalhe. La' o header ja tem
  // seu proprio bookmark (o mesmo campo, mesma acao) -- mostrar os dois
  // ao mesmo tempo na mesma tela seria redundante.
  const canSave = !!reviewId && !!onOpenHand;

  return (
    <div style={{ fontFamily: F, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
      <div
        style={{
          background: "#050505",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          padding: 10,
          // overflow:hidden — bug corrigido: sem isso, conteudo de seat
          // (chip de nome, fichas paradas) que se acumula conforme a acao
          // avanca podia vazar visualmente pra fora da caixa. Agora fica
          // sempre travada no tamanho definido, clipando qualquer excesso.
          overflow: "hidden",
          // flex:1 + minHeight:0 (pedido explicito: "aumentar a mesa no
          // mesmo tamanho da lista de maos... nao devera conter espaco
          // em branco em baixo") — antes a mesa tinha altura FIXA por
          // breakpoint (360/420/500/520px) que nao acompanhava a altura
          // real da coluna (a lista de maos ao lado usa flex:1 e enche
          // o espaco todo). Agora o card da mesa cresce junto com a
          // coluna, ate a altura real disponivel na tela.
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Header unico (pedido explicito: "refine os botoes do
            replayer e suba ele, ficando na mesma linha que as demais
            informacoes") — torneio, buyin e blinds como chips de
            informacao a esquerda; controles de navegacao/autoplay
            refinados (menores, mesmo padrao visual dos chips) + acoes
            (Compartilhar/Analisar) a direita. Tudo numa unica linha
            flex com wrap — em telas largas fica tudo lado a lado; em
            telas estreitas quebra em 2 linhas sem misturar grupos. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 }}>
            <InfoChip icon={<Trophy size={12} color="rgba(255,255,255,0.45)" />} label={tournamentName ?? "Torneio sem nome"} />
            <InfoChip
              icon={<Layers size={12} color="rgba(255,255,255,0.45)" />}
              label={`${parsedHand.smallBlind}/${parsedHand.bigBlind}`}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Controles de navegacao/autoplay — refinados (28px, era
                34px) e movidos pra dentro da mesma linha do header,
                junto do resto das informacoes (pedido explicito).
                Seletor de velocidade continua removido — autoplay roda
                em ritmo fixo. */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, padding: 3, borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>
              <button
                onClick={prevStep}
                disabled={replayState.stepIndex === 0}
                aria-label="Passo anterior"
                title="Anterior (←)"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: 0,
                  color: replayState.stepIndex === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.75)",
                  borderRadius: 999, width: 26, height: 26, cursor: replayState.stepIndex === 0 ? "not-allowed" : "pointer",
                }}
              >
                <ChevronLeft size={13} />
              </button>

              <button
                onClick={() => setAutoplay((v) => !v)}
                disabled={replayState.stepIndex >= replayState.stepCount - 1}
                aria-label={autoplay ? "Pausar" : "Reproduzir"}
                title={autoplay ? "Pausar (espaço)" : "Reproduzir (espaço)"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", border: 0,
                  background: autoplay ? "rgba(52,211,153,0.18)" : "transparent",
                  color: replayState.stepIndex >= replayState.stepCount - 1 ? "rgba(255,255,255,0.22)" : autoplay ? "#6EE7B7" : "rgba(255,255,255,0.75)",
                  borderRadius: 999, width: 26, height: 26, cursor: replayState.stepIndex >= replayState.stepCount - 1 ? "not-allowed" : "pointer",
                }}
              >
                {autoplay ? <Pause size={11} /> : <Play size={11} />}
              </button>

              <button
                onClick={nextStep}
                disabled={replayState.stepIndex >= replayState.stepCount - 1}
                aria-label="Próximo passo"
                title="Próximo (→)"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", border: 0,
                  background: replayState.stepIndex >= replayState.stepCount - 1 ? "transparent" : "rgba(255,255,255,0.85)",
                  color: replayState.stepIndex >= replayState.stepCount - 1 ? "rgba(255,255,255,0.22)" : "#111111",
                  borderRadius: 999, width: 26, height: 26, cursor: replayState.stepIndex >= replayState.stepCount - 1 ? "not-allowed" : "pointer",
                }}
              >
                <ChevronRight size={13} />
              </button>

              <span style={{ marginLeft: 3, marginRight: 5, fontSize: 10.5, color: "rgba(255,255,255,0.4)", ...num }}>
                {replayState.stepIndex + 1}/{replayState.stepCount}
              </span>
            </div>

            {canSave && (
              <ChipButton
                icon={<Bookmark size={13} fill={saved ? "currentColor" : "none"} />}
                label={saved ? "Salvo" : "Salvar"}
                title={saved ? "Remover dos salvos" : "Salvar spot pra rever depois"}
                onClick={toggleSaved}
                disabled={savingSpot}
              />
            )}
            {canShare && (
              <ChipButton
                icon={<Share2 size={13} />}
                label="Compartilhar"
                title="Compartilhar essa mão com o coach"
                onClick={() => setShareModalOpen(true)}
              />
            )}
            {canAnalyze && (
              <ChipButton icon={<Target size={13} />} label="Analisar mão" onClick={onOpenHand} title="Analisar essa mão em detalhe" />
            )}
          </div>
        </div>

        {/* Altura responsiva por breakpoint (className, nao inline) — fixa
            e diferente por formato: menor no celular, media no tablet,
            maior no desktop. */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <PokerTable
            hand={replayState.tableHand}
            seats={replayState.seatLayout}
            chipAnimation={chipAnimation}
            streetCommitments={replayState.streetCommitments}
            opponentStats={opponentStats}
            onOpponentClick={(name) => setOpponentClicked(opponentStats[name] ?? null)}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexShrink: 0 }}>
        {trainHref ? (
          <Link
            href={trainHref}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)",
              color: "#FFFFFF", borderRadius: 10, padding: "8px 14px",
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

      {reviewId && (
        <ShareHandModal open={shareModalOpen} reviewId={reviewId} onClose={() => setShareModalOpen(false)} />
      )}

      <OpponentStatsModal stats={opponentClicked} onClose={() => setOpponentClicked(null)} />
    </div>
  );
}
