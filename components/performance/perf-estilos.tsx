"use client";

import { PainelStyles } from "@/components/painel/painel-styles";

// Estilos da Performance: a MESMA linguagem da tela inicial (vidro fosco,
// esqueleto pulsando, barra de rolagem fina, ícones de traço fino --
// tudo vem do PainelStyles), mas SEM a imagem de fichas no fundo (pedido
// explícito). No lugar dela, três brilhos de cor bem suaves: o vidro dos
// cards precisa de algo atrás pra desfocar, senão vira caixa chapada.
export function PerfEstilos() {
  return (
    <>
      <PainelStyles />
      <style>{`
        .perf {
          position: relative;
          isolation: isolate;
        }
        .perf::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(60rem 28rem at 0% 0%, rgba(212, 175, 55, 0.075), transparent 60%),
            radial-gradient(50rem 26rem at 100% 8%, rgba(74, 144, 217, 0.06), transparent 62%),
            radial-gradient(44rem 30rem at 55% 100%, rgba(168, 85, 247, 0.045), transparent 60%);
        }
        .perf svg.lucide {
          stroke-width: 1.6;
        }
      `}</style>
    </>
  );
}
