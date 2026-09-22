"use client";

// CSS do protótipo de Dashboard (Dark Glassmorphism roxo neon).
//
// Fica num <style> escopado por `.psd-root` — e NÃO em app/globals.css —
// porque isto é uma maquete isolada em /design/dashboard: nenhuma regra
// daqui pode vazar pras telas de produção (mesma técnica já usada em
// components/drill/treino-responsive-styles.tsx).
//
// A paleta mistura o roxo neon da referência visual com os tokens que o
// app já tem (--color-positive/negative/training/review em
// app/globals.css), pra que indicador de lucro/prejuízo continue lendo
// igual ao resto do produto.
export function DashboardStyles() {
  return (
    <style>{`
      .psd-root {
        --psd-neon: #a855f7;          /* mesmo roxo do módulo Revisão (ACCENT.purple) */
        --psd-neon-soft: #c084fc;
        --psd-violet: #7c3aed;
        --psd-glass: rgba(255, 255, 255, 0.045);
        --psd-glass-top: rgba(255, 255, 255, 0.09);
        --psd-line: rgba(255, 255, 255, 0.08);
        --psd-line-strong: rgba(168, 85, 247, 0.35);
        position: relative;
        min-height: 100vh;
        background: #05030b;
        color: #ffffff;
        isolation: isolate;
      }

      /* Brilhos de fundo — recriam a "montanha roxa" do mockup sem
         imagem nenhuma (nada pra baixar, escala em qualquer tela). */
      .psd-root::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        background:
          radial-gradient(1100px 520px at 88% 78%, rgba(124, 58, 237, 0.34), transparent 62%),
          radial-gradient(760px 420px at 12% 4%, rgba(88, 28, 135, 0.28), transparent 60%),
          radial-gradient(520px 300px at 50% 110%, rgba(168, 85, 247, 0.18), transparent 65%);
        pointer-events: none;
      }

      /* Cartão de vidro. O backdrop-filter só aparece de verdade porque o
         fundo atrás é o gradiente acima; sobre preto puro o efeito some. */
      .psd-card {
        background: linear-gradient(160deg, var(--psd-glass-top), var(--psd-glass));
        border: 1px solid var(--psd-line);
        border-radius: 20px;
        backdrop-filter: blur(18px) saturate(140%);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        box-shadow: 0 18px 40px -28px rgba(0, 0, 0, 0.9);
        transition: border-color 0.25s ease, transform 0.25s ease;
      }
      .psd-card:hover {
        border-color: rgba(168, 85, 247, 0.28);
      }

      /* Pílula roxa do item ativo (sidebar e dock). */
      .psd-active {
        background: linear-gradient(145deg, var(--psd-neon), var(--psd-violet));
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12) inset, 0 8px 22px -8px rgba(168, 85, 247, 0.9);
      }

      .psd-neon-text {
        background: linear-gradient(92deg, var(--psd-neon-soft), #818cf8);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      /* Ícones do dock: crescem no hover, imitando o dock do macOS. */
      .psd-dock-item {
        transition: transform 0.18s ease, background-color 0.18s ease;
      }
      .psd-dock-item:hover {
        transform: translateY(-6px) scale(1.12);
      }

      /* Barra de rolagem fina dentro dos cards (lista de mãos, notas) —
         mesma decisão de app/globals.css: Firefox usa o padrão, os
         demais usam o modelo legado, nunca os dois juntos. */
      @supports not selector(::-webkit-scrollbar) {
        .psd-scroll { scrollbar-width: thin; scrollbar-color: rgba(168, 85, 247, 0.4) transparent; }
      }
      .psd-scroll::-webkit-scrollbar { width: 6px; }
      .psd-scroll::-webkit-scrollbar-track { background: transparent; }
      .psd-scroll::-webkit-scrollbar-thumb {
        background: rgba(168, 85, 247, 0.38);
        border-radius: 999px;
      }

      /* Pulso suave no anel do timer enquanto ele está rodando. */
      @keyframes psd-ring-pulse {
        0%, 100% { filter: drop-shadow(0 0 3px rgba(168, 85, 247, 0.55)); }
        50% { filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.9)); }
      }
      .psd-ring-live { animation: psd-ring-pulse 2.6s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .psd-ring-live { animation: none; }
        .psd-dock-item:hover { transform: none; }
      }
    `}</style>
  );
}
