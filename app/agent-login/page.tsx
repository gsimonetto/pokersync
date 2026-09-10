// app/agent-login/page.tsx
// Página de login usada SÓ pelo Radar PokerSync (app desktop) — ele abre
// isso no navegador do sistema quando o jogador clica em "Entrar com
// Google" no agente, porque o fluxo OAuth do Google não roda dentro da
// janela nativa do Tauri. Depois do login, app/auth/confirm/route.ts
// detecta o parâmetro agent_state e devolve um código de uso único pro
// agente via deep link (radar-pokersync://auth) em vez de abrir o
// produto aqui -- o agente troca esse código pelos tokens reais em
// app/api/agent/exchange-code/route.ts (nunca mais o token cru na URL).
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
