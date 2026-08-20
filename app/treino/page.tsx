"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { RfiJamDrill } from "@/components/drill/rfi-jam-drill";
import { F } from "@/lib/poker/drill-theme";
import { fetchSessions } from "@/lib/services/bankroll-service";
import { groupStats } from "@/lib/bankroll/calc";
import { fmtPct } from "@/lib/bankroll/format";

const TOURNEY_FORMATS = new Set(["MTT", "SNG", "Spin"]);
// bb curto tipico de late-stage torneio -- e' o valor que a gente tenta
// achar entre os spots reais do RFI/Jam quando sugere foco em MTT/SNG/Spin.
const SHORT_STACK_BB = 15;

interface LeakTip {
  label: string;
  roi: number;
  n: number;
  suggestStackBb: number | null;
}

// Puxa o leak mais forte da Gestao de Banca (mesma logica de
// groupStats "format" que alimenta o painel de leaks em /banca) e
// transforma numa dica acionavel aqui no treino -- ponte entre "onde
// eu perco dinheiro" e "o que eu deveria praticar agora". So considera
// grupos com pelo menos 3 sessoes (amostra minima) e ROI negativo.
function useBankrollLeakTip(): LeakTip | null {
  const [tip, setTip] = useState<LeakTip | null>(null);
  useEffect(() => {
    let alive = true;
    fetchSessions()
      .then((sessions) => {
        if (!alive) return;
        const stats = groupStats(sessions, "format").filter((g) => g.n >= 3 && g.roi < 0);
        if (stats.length === 0) return;
        const worst = stats[0];
        setTip({
          label: worst.key,
          roi: worst.roi,
          n: worst.n,
          suggestStackBb: TOURNEY_FORMATS.has(worst.key) ? SHORT_STACK_BB : null,
        });
      })
      .catch(() => {
        // sem sessao/banca ainda -- treino funciona normal sem a dica
      });
    return () => {
      alive = false;
    };
  }, []);
  return tip;
}

function TreinoShell() {
  // Altura disponível medida, não chutada. O card usava
  // `calc(100vh - 32px)`, ignorando o header global do app que fica
  // acima desta página — o card ficava mais alto que o espaço real e o
  // rodapé (barra de apostas) caía fora da tela (bug reportado: "cadê o
  // botão de aposta? sumiu"). Medindo o offset real do topo do
  // container, isso funciona com qualquer header, sem hardcode.
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const leakTip = useBankrollLeakTip();
  const [tipDismissed, setTipDismissed] = useState(false);
  const [appliedStackBb, setAppliedStackBb] = useState<number | undefined>(undefined);

  // py-10 (2.5rem = 40px) do container padrao entra embaixo tambem —
  // sem descontar isso aqui o card calculava altura ate' a base da
  // viewport e o padding inferior nunca aparecia (ficava cortado).
  const BOTTOM_PADDING_PX = 40;

  useEffect(() => {
    function measure() {
      const el = pageRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setAvailableHeight(Math.max(320, window.innerHeight - top - BOTTOM_PADDING_PX));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    // Margem padrao do app (max-w-[1280px] px-6 py-10) — antes essa tela
    // era full-bleed de proposito, mas o padrao virou consistencia entre
    // todo modulo, entao entra aqui tambem.
    <main className="mx-auto max-w-[1280px] px-6 py-10">
    <div
      ref={pageRef}
      className="ps-treino-page"
      style={{
        fontFamily: F,
        height: availableHeight ? `${availableHeight}px` : "100vh",
        background: "#050505",
        padding: 0,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        className="ps-treino-card"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: "100%",
          margin: "0 auto",
          background: "#050505",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 14,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {leakTip && !tipDismissed && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              fontFamily: F,
              fontSize: 12,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              Seu maior leak na banca é <strong>{leakTip.label}</strong> ({fmtPct(leakTip.roi)} ROI,{" "}
              {leakTip.n} sessões).
              {leakTip.suggestStackBb != null &&
                (appliedStackBb === leakTip.suggestStackBb
                  ? " Treino ajustado pra stack curto."
                  : " Bora praticar stack curto?")}
            </span>
            {leakTip.suggestStackBb != null && appliedStackBb !== leakTip.suggestStackBb && (
              <button
                onClick={() => setAppliedStackBb(leakTip.suggestStackBb!)}
                style={{
                  flexShrink: 0,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: "#F59E0B",
                  color: "#050505",
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  border: "none",
                }}
              >
                Focar treino
              </button>
            )}
            <button
              onClick={() => setTipDismissed(true)}
              aria-label="Dispensar"
              style={{ flexShrink: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,0.5)", background: "none", border: "none" }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0 }}>
          <RfiJamDrill initialStackBb={appliedStackBb} />
        </div>
      </div>
    </div>
    </main>
  );
}

export default function TreinoPage() {
  return (
    <Suspense fallback={null}>
      <TreinoShell />
    </Suspense>
  );
}
