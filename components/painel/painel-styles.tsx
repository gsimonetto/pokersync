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

      /* Fundo: pilhas de fichas de poker em 3D (public/fundo-fichas.webp),
         renderizadas com luz, sombra e desfoque de câmera reais. Substitui
         a foto anterior. Continua existindo por um motivo prático: o vidro
         fosco dos cards borra o que está ATRÁS deles, e sobre preto liso o
         efeito some.

         A imagem é deitada (16:9) e as fichas ficam no lado direito, com a
         esquerda quase preta -- é onde começa o texto do cabeçalho, então
         a leitura não disputa com o fundo. No celular (tela em pé) ela é
         recortada ancorada à direita, pra pilha continuar aparecendo. */
      .painel::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        /* No celular a página rola: a imagem ocupa só a primeira tela e o
           resto da página segue preto, em vez de esticar pela altura
           inteira do conteúdo. */
        height: 100svh;
        z-index: -1;
        background-image:
          linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)),
          url("/fundo-fichas.webp");
        background-size: cover, cover;
        background-position: center, 72% center;
        background-repeat: no-repeat;
        /* Some aos poucos embaixo, sem corte seco entre imagem e preto. */
        -webkit-mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
        mask-image: linear-gradient(to bottom, #000 70%, transparent 100%);
        pointer-events: none;
      }
      @media (min-width: 1280px) {
        /* No computador a imagem cobre a área toda, sem máscara: a tela
           inteira cabe na janela, então não há "resto da página". */
        .painel::before {
          height: 100%;
          background-position: center, right bottom;
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
        /* Brilho de canto em dourado, o mesmo tom das fichas do fundo (a
           cor de destaque do Painel passou de roxo pra dourado). */
        background: rgba(212, 175, 55, 0.10);
        filter: blur(140px);
        pointer-events: none;
      }

      /* Ícones em traço fino e do mesmo peso na tela toda (padrão do
         produto: ícone minimalista, stroke fino). O lucide desenha com
         traço 2 por padrão; CSS vence o atributo do SVG, então uma regra
         só ajusta todos os ícones do Painel sem mexer em cada um. */
      .painel svg.lucide {
        stroke-width: 1.6;
      }

      /* Números da tela inicial em Geist (components/painel/fonte-numeros.ts);
         a variável só existe dentro do .painel, então nada vaza pro resto
         do app. Space Grotesk fica de reserva se a Geist não carregar. */
      .painel-numero {
        font-family: var(--font-numeros), var(--font-sans), ui-sans-serif, sans-serif;
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
