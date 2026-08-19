"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { RfiJamDrill } from "@/components/drill/rfi-jam-drill";
import { F } from "@/lib/poker/drill-theme";

// Tela única de treino -- sem abas (Pós-flop/Pré-flop/GTO/Ranges
// removidas por pedido explícito, 2026-08). RfiJamDrill é o único
// conteúdo: hoje é o único tipo de spot com dado real gerado no
// Supabase (rfi_jam, pré-flop). Quando o pós-flop tiver mãos geradas
// de verdade, ele entra como mais uma opção DENTRO dos filtros desta
// mesma tela (ex: dimensão "Rua"), não como uma aba/tela separada --
// é exatamente o que se queria evitar.
function TreinoShell() {
  // Altura disponível medida, não chutada. O card usava
  // `calc(100vh - 32px)`, ignorando o header global do app que fica
  // acima desta página — o card ficava mais alto que o espaço real e o
  // rodapé (barra de apostas) caía fora da tela (bug reportado: "cadê o
  // botão de aposta? sumiu"). Medindo o offset real do topo do
  // container, isso funciona com qualquer header, sem hardcode.
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  useEffect(() => {
    function measure() {
      const el = pageRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setAvailableHeight(Math.max(320, window.innerHeight - top));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      ref={pageRef}
      className="ps-treino-page"
      style={{
        fontFamily: F,
        height: availableHeight ? `${availableHeight}px` : "100vh",
        background: "#050505",
        padding: 16,
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
          padding: 12,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, minHeight: 0 }}>
          <RfiJamDrill />
        </div>
      </div>
    </div>
  );
}

export default function TreinoPage() {
  return (
    <Suspense fallback={null}>
      <TreinoShell />
    </Suspense>
  );
}
