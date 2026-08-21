"use client";

import { useEffect } from "react";

// Fecha o modal/overlay com a tecla Esc.
//
// Todo modal do produto ja fechava clicando no backdrop, mas nenhum
// (fora o de compartilhar mao) reagia ao Esc -- e o publico daqui e'
// grinder, que joga com a mao no teclado e espera Esc como saida
// padrao de qualquer janela. Sem isso, todo fechamento exige tirar a
// mao do teclado e mirar o mouse no "x" ou fora da caixa.
//
// Fica num hook unico em vez de repetir o useEffect em cada modal pra
// nao divergirem com o tempo (um fechando com Esc, outro nao).
export function useEscapeToClose(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, active]);
}
