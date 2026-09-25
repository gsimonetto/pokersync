// Conversa entre as telas e o menu de Configurações (components/app-shell.tsx):
// uma tela pede pra abrir o menu (ex.: "Preencher" no cartão das Vagas)
// e fica sabendo quando o perfil muda lá dentro.
export const ABRIR_CONFIGURACOES = "pokersync:abrir-configuracoes";
export const PERFIL_MUDOU = "pokersync:perfil-mudou";

export function abrirConfiguracoes() {
  window.dispatchEvent(new Event(ABRIR_CONFIGURACOES));
}
