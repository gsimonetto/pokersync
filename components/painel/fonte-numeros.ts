import { Geist } from "next/font/google";

// Fonte só dos NÚMEROS da tela inicial (indicadores, banca total e
// relógio) -- o resto do app continua em Space Grotesk. Escolhida entre 6
// opções comparadas lado a lado: moderna e técnica, com cortes retos, e
// sem a "bandeirinha" do 1 da Space Grotesk, que pesava em tamanho grande
// ("11", "41"). Carregada aqui, e não no layout, pra só a tela inicial
// baixar o arquivo; a classe `painel-numero` (painel-styles.tsx) aplica.
export const fonteNumeros = Geist({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-numeros",
  display: "swap",
});
