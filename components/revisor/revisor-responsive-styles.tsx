"use client";

// Responsividade do Revisor de Mãos (RevisorSessao) -- pedido explicito:
// "adapte o revisor de maos igual ao modo treino" no celular. Mesmo
// padrao ja usado em components/drill/treino-responsive-styles.tsx: a
// coluna lateral (aqui, a lista de maos em vez dos filtros) sai do fluxo
// no mobile e vira uma gaveta deslizante, a coluna principal (mesa, com
// os botoes de navegacao/replay, nomes e stats dos jogadores) ocupa a
// tela inteira, e a pagina trava em 100dvh (nao 100vh) pra nao sobrar
// espaco morto nem cortar os controles quando a barra de enderecos do
// navegador mobile encolhe/expande.
export function RevisorResponsiveStyles() {
  return (
    <style>{`
      .ps-rv-list-toggle { display: none; }
      .ps-rv-list-backdrop { display: none; }
      .ps-rv-list-close { display: none; }

      @media (max-width: 768px) {
        html, body { overflow: hidden; }
        .ps-rv-page {
          height: calc(100dvh - var(--ps-rv-top, 0px));
          overflow: hidden;
          gap: 8px !important;
        }
        .ps-rv-list-toggle { display: flex !important; }

        .ps-rv-body {
          grid-template-columns: 1fr !important;
          height: 100% !important;
          min-height: 0 !important;
        }
        /* Lista vira gaveta deslizante -- mesmo tratamento da gaveta de
           filtros do Treino (.ps-tr-filters): fixed, fora do fluxo,
           translateX quando fechada, z-index acima de tudo da mesa. */
        .ps-rv-list {
          position: fixed !important;
          inset: 0;
          z-index: 60;
          width: 82%;
          max-width: 320px;
          border-radius: 0 !important;
          transform: translateX(-100%);
          transition: transform 220ms ease;
        }
        .ps-rv-list--open { transform: translateX(0); }
        .ps-rv-list-backdrop--open {
          display: block !important;
          position: fixed;
          inset: 0;
          z-index: 55;
          background: rgba(0,0,0,0.55);
        }
        .ps-rv-list-close { display: grid !important; }

        /* Mesa ocupa a tela inteira -- os controles de navegacao
           (anterior/proximo/autoplay), nomes/stats dos jogadores e os
           botoes de acao (Salvar/Compartilhar/Analisar) continuam TODOS
           no DOM, so' o layout encolhe pra caber sem cortar nada. */
        .ps-rv-table-col { min-height: 0 !important; }
      }

      @media (max-width: 480px) {
        /* Telas bem estreitas: os chips de info (torneio, blinds) e os
           botoes de acao do header da mesa ficam grandes demais lado a
           lado -- encolhe fonte/padding pra caber em 2 linhas legiveis
           em vez de estourar ou cortar texto. */
        .ps-rv-table-header-chip { padding: 5px 9px !important; font-size: 11px !important; }
        .ps-rv-table-action-btn { padding: 6px 10px !important; font-size: 11px !important; }
      }
    `}</style>
  );
}
