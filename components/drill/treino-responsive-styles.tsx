"use client";

// Extraído de app/treino/page.tsx pra evitar import circular (o
// RfiJamDrill precisava do mesmo CSS responsivo, e importar de dentro
// de um arquivo de página pra um componente é frágil). Mesmo
// conteúdo de antes, sem nenhuma mudança de comportamento.

export function TreinoResponsiveStyles() {
  return (
    <style>{`
      /* Botao de esconder/mostrar filtros — visivel em qualquer tamanho
         de tela agora (antes so' existia no mobile; no desktop os
         filtros ficavam sempre abertos ocupando os 240px fixos, sem
         opcao de recolher pra sobrar mais espaco pra mesa). */
      .ps-tr-filters-toggle { display: flex; }
      .ps-tr-filters-backdrop { display: none; }

      @media (max-width: 768px) {
        /* Tela travada em 100dvh com overflow hidden: o jogador não
           deve precisar rolar pra achar os botões de aposta (bug
           reportado). dvh em vez de vh porque a barra de endereço do
           navegador mobile encolhe a viewport e o vh não reage. */
        html, body { overflow: hidden; }
        .ps-treino-page {
          padding: 0 !important;
          height: 100dvh !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .ps-treino-card {
          padding: 0 !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          height: 100dvh !important;
          gap: 0 !important;
          overflow: hidden !important;
        }
        /* Tabs agora vivem dentro da própria linha do header (não são
           mais absolutas): basta não deixá-las esticar. */
        .ps-treino-tabs { transform: scale(.88); transform-origin: center right; }
        .ps-tr-header {
          padding: 6px 8px 0 !important;
          justify-content: flex-start !important;
          gap: 8px !important;
          flex-shrink: 0;
        }
        /* Botão de filtros à esquerda — as tabs ocupam a direita. */
        .ps-tr-filters-toggle { display: flex !important; order: 0; }
        .ps-tr-session { flex: 1 1 auto !important; order: 1; }
        .ps-tr-body {
          grid-template-columns: 1fr !important;
          padding: 0 8px 8px !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .ps-tr-filters {
          position: fixed;
          inset: 0;
          z-index: 40;
          width: 82%;
          max-width: 320px;
          background: #050505;
          padding: 16px;
          overflow-y: auto;
          transform: translateX(-100%);
          transition: transform 220ms ease;
        }
        .ps-tr-filters--open { transform: translateX(0); }
        .ps-tr-filters-backdrop { display: block; }
        .ps-tr-feedback-idle { display: none !important; }
        .ps-tr-feedback-sheet {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 30;
          max-height: 62dvh;
          overflow-y: auto;
          border-radius: 18px 18px 0 0 !important;
          box-shadow: 0 -20px 50px rgba(0,0,0,.6);
          padding-bottom: calc(14px + env(safe-area-inset-bottom)) !important;
        }
        .ps-tr-table-col { gap: 6px !important; min-height: 0 !important; }
        .ps-tr-table-inner { padding-top: 0 !important; }
        .ps-tr-table-wrap { max-width: none !important; max-height: none !important; }
        .ps-tr-sheet-close { display: flex !important; }
        /* Barra de apostas compacta: botões menores e sempre visíveis
           dentro da tela, sem scroll (bug reportado). */
        .ps-tr-actions {
          min-height: 0 !important;
          padding-bottom: env(safe-area-inset-bottom);
        }
        .ps-tr-actions button {
          padding: 8px 10px !important;
          border-radius: 10px !important;
        }
        .ps-tr-actions button span { font-size: 12px !important; }
      }
    `}</style>
  );
}
