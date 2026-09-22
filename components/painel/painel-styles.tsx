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

      /* Fundo de fichas de poker (public/fichas-painel.svg, desenhado em
         vetor) + a grade de pontos da tela de login por cima. O fundo
         existe por um motivo prático, não decorativo: o efeito de vidro
         fosco dos cards borra o que está ATRÁS deles -- sobre preto liso
         não há o que borrar e o vidro some. O próprio SVG já traz um véu
         escuro pra garantir a leitura do texto. */
      .painel::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        background-image:
          radial-gradient(rgba(255, 255, 255, 0.55) 1px, transparent 1px),
          url("/fichas-painel.svg");
        background-size: 32px 32px, cover;
        background-attachment: scroll, fixed;
        background-position: center, center;
        background-repeat: repeat, no-repeat;
        pointer-events: none;
      }
      .painel::after {
        content: "";
        position: absolute;
        top: -8rem;
        left: -8rem;
        width: 24rem;
        height: 24rem;
        z-index: -1;
        border-radius: 9999px;
        /* Mesmo brilho de canto da tela de login, com um toque do roxo da
           marca -- o fundo continua preto, só a luz é colorida. */
        background: rgba(168, 85, 247, 0.16);
        filter: blur(140px);
        pointer-events: none;
      }

      /* Nome do jogador no cabeçalho, no degradê roxo da identidade. */
      .painel-roxo {
        background: linear-gradient(92deg, #c084fc, #818cf8);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      /* Vidro fosco do card: semitransparente + desfoque do que está
         atrás (backdrop-filter). Os dois andam juntos -- card opaco não
         deixa ver o fundo, e desfoque sem transparência não tem efeito.
         O -webkit- continua necessário pro Safari. */
      .painel-vidro {
        background-color: rgba(17, 17, 17, 0.62);
        backdrop-filter: blur(22px) saturate(130%);
        -webkit-backdrop-filter: blur(22px) saturate(130%);
      }
      /* Navegador sem suporte a backdrop-filter cai num card sólido, que
         é o comportamento anterior -- nunca num card transparente e
         ilegível por cima das fichas. */
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        .painel-vidro { background-color: #111111; }
      }

      /* Blocos internos das listas ficam um pouco mais opacos que o card,
         senão as fichas atravessam duas camadas de vidro e o texto perde
         contraste. */
      .painel-vidro .painel-bloco {
        background-color: rgba(255, 255, 255, 0.05);
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
