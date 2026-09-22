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
        /* Cresce até o fim da área de conteúdo (o AppShell põe o <main>
           dentro de um flex column). Sem isto, numa tela alta o fundo de
           fichas terminava junto com os cards e sobrava uma faixa preta
           embaixo. */
        flex: 1 1 auto;
      }

      /* Fundo: foto de ases e fichas em preto e dourado
         (public/fundo-painel.jpg, escolhida pelo usuário). Substitui a
         grade de pontos e as fichas desenhadas em vetor. Continua
         existindo por um motivo prático: o vidro fosco dos cards borra o
         que está ATRÁS deles, e sobre preto liso o efeito some.

         A foto é pequena e em pé (450x800). Esticada na largura de um
         monitor ela ficaria quase 4x maior que o original, borrada. Por
         isso, no celular (tela em pé, como a foto) ela cobre a tela
         inteira, e no computador fica encostada à direita, na altura da
         tela, com a borda esquerda sumindo no preto. As bordas da própria
         foto já são pretas, então ela se funde com o fundo da página. */
      .painel::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        /* No celular a página rola: a foto ocupa só a primeira tela e o
           resto da página segue preto, em vez de esticar a foto pela
           altura inteira do conteúdo. */
        height: 100svh;
        z-index: -1;
        background-image:
          linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)),
          url("/fundo-painel.jpg");
        background-size: cover, cover;
        background-position: center, center 65%;
        background-repeat: no-repeat;
        /* Some aos poucos embaixo, sem corte seco entre foto e preto. */
        -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
        mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
        pointer-events: none;
      }
      @media (min-width: 1280px) {
        /* No computador a foto cobre a área toda. Ela fica bem maior que
           o original (450x800), mas quase tudo dela é visto ATRAVÉS do
           vidro fosco dos cards, que já desfoca -- e o fundo da própria
           foto é desfocado (profundidade de campo), então a ampliação
           não aparece. Encostada à direita no tamanho original, ela
           ficava escondida atrás da coluna da direita e quase não se via. */
        .painel::before {
          height: 100%;
          background-position: center, center 62%;
          -webkit-mask-image: none;
          mask-image: none;
        }
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
        /* Brilho de canto em dourado, o mesmo tom da foto de fundo (a cor
           de destaque do Painel passou de roxo pra dourado). */
        background: rgba(212, 175, 55, 0.10);
        filter: blur(140px);
        pointer-events: none;
      }

      /* Nome do jogador no cabeçalho, em degradê dourado. */
      .painel-ouro {
        background: linear-gradient(92deg, #f1d78a, #d4af37 55%, #b8932a);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      /* Bloco de carregamento: pulsa devagar no formato do conteúdo, pra
         tela não "pular" quando os dados chegam. */
      @keyframes painel-pulso {
        0%, 100% { opacity: 0.55; }
        50% { opacity: 1; }
      }
      .painel-esqueleto {
        background: rgba(255, 255, 255, 0.05);
        animation: painel-pulso 1.6s ease-in-out infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .painel-esqueleto { animation: none; }
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
