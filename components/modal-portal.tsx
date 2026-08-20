"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";

// Renderiza direto em document.body, fora da arvore do TopNav —
// os 3 menus do header (Notificacoes, Ajuda, Perfil) viviam dentro do
// <header sticky ... z-30>, que cria seu proprio contexto de
// empilhamento; o z-50 do modal so' era comparado DENTRO desse
// contexto, entao o header inteiro (como unidade) podia ficar atras de
// outro conteudo da pagina (ex: banner do Time) dependendo do
// navegador — bug reportado como "modal abre atras do banner". Portal
// resolve isso de vez, sem depender de ajuste fino de z-index.
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
