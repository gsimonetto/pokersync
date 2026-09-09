// app/agent-login/page.tsx
// Página de login usada SÓ pelo Radar PokerSync (app desktop) — ele abre
// isso no navegador do sistema quando o jogador clica em "Entrar com
// Google" no agente, porque o fluxo OAuth do Google não roda dentro da
// janela nativa do Tauri. Depois do login, app/auth/confirm/route.ts
// detecta o parâmetro agent_state e devolve os tokens pro agente via
// deep link (radar-pokersync://auth) em vez de abrir o produto aqui.
import { Suspense } from "react";
import AgentLoginForm from "./agent-login-form";

export const metadata = {
  title: "Entrar — Radar PokerSync",
};

export default function AgentLoginPage() {
  return (
    <Suspense>
      <AgentLoginForm />
    </Suspense>
  );
}
