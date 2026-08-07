"use client";

import { T, F, num } from "@/lib/poker/drill-theme";

/* Contrato adaptado: o original (aspiracional, nunca conectado no Vite)
   mostrava EV por acao ANTES do jogador escolher — mas o banco nao tem
   EV (TexasSolver nao exporta), entao mostrar um numero ali seria
   inventar dado. Alem disso, revelar a frequencia do solver antes da
   escolha entregaria a resposta — o resto do produto (Hub, Revisor)
   sempre pede a decisao do jogador primeiro e so revela o gabarito
   depois. ActionBar ficou mais simples: so os botoes, sizing e atalho
   de teclado — nada de numero antes da jogada. */

export interface DrillAction {
  id: string;
  type: "CHECK" | "BET" | "CALL" | "RAISE" | "FOLD";
  label: string;
  key?: string;
  sizing?: number;
  primary?: boolean;
}

export function Key({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 16,
        height: 16,
        padding: "0 4px",
        borderRadius: 4,
        background: "rgba(255,255,255,.07)",
        border: `1px solid ${T.line}`,
        color: T.dim,
        fontFamily: F,
        fontSize: 9.5,
        fontWeight: 700,
        ...num,
      }}
    >
      {children}
    </span>
  );
}

export function ActionBar({
  actions = [],
  onAct = () => {},
  disabled = false,
}: {
  actions?: DrillAction[];
  onAct?: (action: DrillAction) => void;
  disabled?: boolean;
}) {
  if (!actions.length) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={() => !disabled && onAct(a)}
          disabled={disabled}
          aria-keyshortcuts={a.key}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 12,
            textAlign: "left",
            cursor: disabled ? "default" : "pointer",
            fontFamily: F,
            opacity: disabled ? 0.4 : 1,
            transition: "opacity .2s, transform .1s",
            background: a.primary ? `linear-gradient(180deg,${T.accent},#7E22CE)` : `linear-gradient(180deg,${T.panelAlt},${T.panel})`,
            border: `1px solid ${a.primary ? "rgba(255,255,255,.25)" : T.line}`,
            boxShadow: a.primary ? `0 6px 18px ${T.accent}40` : "0 2px 8px rgba(0,0,0,.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: T.text, fontWeight: 800, fontSize: 13.5 }}>{a.label}</span>
            {a.key && <Key>{a.key}</Key>}
          </div>
        </button>
      ))}
    </div>
  );
}
