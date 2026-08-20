// CSS de impressao (PDF) compartilhado entre o painel do time e a ficha
// individual do jogador — mesmo bloco @media print nos dois.
export function TeamPrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        body { background: #fff !important; color: #111 !important; }
        .text-ink, .text-ink\\/90, .font-medium, .font-semibold { color: #111 !important; }
        .text-muted { color: #555 !important; }
        .bg-surface, .bg-elevated { background: #fff !important; border-color: #ddd !important; }
        .border-hairline { border-color: #ddd !important; }
        @page { margin: 14mm; }
      }
    `}</style>
  );
}
