"use client";

// CSS do Painel (tela de início). Preto, como o resto do produto —
// mesma base visual da tela de login: fundo escuro com uma grade de
// pontos discreta e um brilho branco suave no canto.
//
// Fica num <style> escopado por `.painel` (e não em app/globals.css)
// porque são regras de uma tela só: nada daqui pode vazar pros outros
// módulos. Mesma técnica de components/drill/treino-responsive-styles.tsx.
export function PainelStyles() {
  return (
    <style>{`
      .painel {
        position: relative;
        isolation: isolate;
      }

      /* Grade de pontos + brilho de canto — os mesmos dois elementos de
         fundo da tela de login (app/login/login-form.tsx), aqui como
         pseudo-elementos pra não sujar o HTML da página. */
      .painel::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        background-image: radial-gradient(#ffffff 1px, transparent 1px);
        background-size: 32px 32px;
        opacity: 0.04;
        pointer-events: none;
      }
      .painel::after {
        content: "";
        position: fixed;
        top: -8rem;
        left: -8rem;
        width: 24rem;
        height: 24rem;
        z-index: -1;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.06);
        filter: blur(140px);
        pointer-events: none;
      }

      /* Barra de rolagem fina dentro dos cards (notas, listas). Mesma
         decisão de app/globals.css: Firefox usa o padrão, os demais o
         modelo legado -- os dois juntos fazem o Chrome ignorar o
         customizado. */
      @supports not selector(::-webkit-scrollbar) {
        .painel-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.18) transparent; }
      }
      .painel-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .painel-scroll::-webkit-scrollbar-track { background: transparent; }
      .painel-scroll::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.18);
        border-radius: 999px;
      }
    `}</style>
  );
}
