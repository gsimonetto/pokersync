"use client";

// So' montado quando RevisorSessao esta no modo tela-cheia do celular
// (ver revisor-sessao.tsx) -- a troca de layout desktop/mobile virou
// condicional de verdade em JS (isMobile), nao mais colapso de grid via
// CSS, entao esse arquivo so' precisa do que o portal em si nao resolve
// sozinho: travar o scroll da PAGINA por tras do portal (posicao fixa
// nao impede o body de rolar sozinho) e encolher os chips/botoes do
// header da mesa em telas bem estreitas.
export function RevisorResponsiveStyles() {
  return (
    <style>{`
      html, body { overflow: hidden; }

      @media (max-width: 480px) {
        .ps-rv-table-header-chip { padding: 5px 9px !important; font-size: 11px !important; }
        .ps-rv-table-action-btn { padding: 6px 10px !important; font-size: 11px !important; }
      }
    `}</style>
  );
}
