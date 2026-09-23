import localFont from "next/font/local";

// Fonte só dos NÚMEROS da tela inicial (indicadores, banca total e
// relógio) -- o resto do app continua em Space Grotesk. Escolhida entre 6
// opções comparadas lado a lado: moderna e técnica, com cortes retos, e
// sem a "bandeirinha" do 1 da Space Grotesk, que pesava em tamanho grande
// ("11", "41"). A classe `painel-numero` (painel-styles.tsx) aplica.
//
// Arquivo EMBUTIDO no projeto (fontes/, licença SIL OFL 1.1 junto), e não
// baixado do Google Fonts no build: pra Geist o Google às vezes devolve o
// endereço do arquivo sem extensão (".../l/font?kit=..."), o next/font
// quebra com "Cannot read properties of null (reading '1')" e o build
// falha de forma intermitente -- aconteceu no CI. Local não depende de rede.
// Só o subconjunto latino, peso variável 100-900 (29 KB).
export const fonteNumeros = localFont({
  src: "./fontes/geist-latin-wght.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-numeros",
  display: "swap",
});
