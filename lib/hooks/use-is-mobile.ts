"use client";

import { useEffect, useState } from "react";

// Breakpoint compartilhado entre Treino e Revisor (768px, mesmo usado em
// treino-responsive-styles.tsx / revisor-responsive-styles.tsx) -- vivia
// duplicado dentro de rfi-jam-drill.tsx; extraido pra ca' pra os dois
// modulos usarem exatamente a mesma logica de deteccao (pedido
// explicito: "as duas telas precisam seguir o mesmo padrao").
// addEventListener("change", ...) reage a rotacao de tela/redimensionamento
// sem precisar de um listener de resize solto.
export function useIsMobile(): boolean {
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
