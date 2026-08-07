"use client";

import { T, F, num } from "@/lib/poker/drill-theme";
import { describeAction, verdictColor, type GtoNode, type VerdictResult } from "@/lib/poker/gto-verdict";
import { getFeedbackMessage } from "@/lib/poker/drill-feedback";

/* Contrato adaptado do GtoFeedback.jsx aspiracional: as barras mostram
   FREQUENCIA (dado real do solver), nao EV (que o banco nao tem). O
   resumo abaixo usa o mesmo sistema de veredito por frequencia que ja
   existe no projeto (OTIMA/ACEITAVEL/ERRO_LEVE/ERRO_GRAVE), com frase
   do banco de mensagens em vez de "custo do desvio em bb" inventado. */

function MetaChip({ label, value, strong }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 8,
        fontFamily: F,
        background: "rgba(255,255,255,.04)",
        border: `1px solid ${T.line}`,
      }}
    >
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.8, color: T.dim }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: strong ? T.accent : T.text, ...num }}>{value}</span>
    </div>
  );
}

function ActionRow({ label, freqPct, isChosen }: { label: string; freqPct: number; isChosen: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: isChosen ? T.accent : T.text,
          }}
        >
          {label}
          {isChosen && (
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.6, color: T.accent }}>SUA JOGADA</span>
          )}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: T.text, ...num }}>{freqPct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
        <div
          style={{
            width: `${freqPct}%`,
            height: "100%",
            borderRadius: 3,
            transition: "width .3s ease",
            background: isChosen ? `linear-gradient(90deg,${T.accent},#C084FC)` : "linear-gradient(90deg,#334155,#475569)",
            boxShadow: isChosen ? `0 0 10px ${T.accent}88` : "none",
          }}
        />
      </div>
    </div>
  );
}

export function GtoFeedback({
  pot,
  stack,
  spr,
  heroLabel,
  gtoNodes,
  heroCards,
  chosenRawAction,
  result,
  chosenLabel,
}: {
  pot: number;
  stack: number;
  spr: number | null;
  heroLabel?: string;
  gtoNodes: GtoNode;
  heroCards: string;
  /** Acao crua do solver que casou com a escolha do jogador (null se nao casou nenhuma). */
  chosenRawAction: string | null;
  result: VerdictResult;
  chosenLabel: string;
}) {
  const comboFreqs = gtoNodes.strategy[heroCards] ?? [];
  const message = getFeedbackMessage(result.verdict, {
    topAction: result.topAction,
    topFreq: result.topFreq,
    chosenAction: chosenLabel,
  });
  const color = verdictColor(result.verdict);

  return (
    <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: 16, fontFamily: F }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: 0.4, color: T.text }}>Solução do solver</h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "11px 0 15px" }}>
        <MetaChip label="POTE" value={`${pot} bb`} />
        <MetaChip label="STACK" value={`${stack} bb`} />
        {spr != null && <MetaChip label="SPR" value={spr} strong />}
        {heroLabel && <MetaChip label="MÃO" value={heroLabel} />}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {gtoNodes.actions.map((rawAction, i) => {
          const freqPct = Math.round((comboFreqs[i] ?? 0) * 100);
          return (
            <ActionRow
              key={i}
              label={describeAction(rawAction).label}
              freqPct={freqPct}
              isChosen={chosenRawAction === rawAction}
            />
          );
        })}
      </div>

      <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 12, background: `${color}14`, border: `1px solid ${color}55` }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 3, color }}>{message.badge}</div>
        <div style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.55 }}>{message.text}</div>
      </div>
    </section>
  );
}
