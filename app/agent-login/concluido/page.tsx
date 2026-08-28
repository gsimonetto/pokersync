// app/agent-login/concluido/page.tsx
// Última parada do login com Google do agente desktop. Tenta abrir o
// deep link automaticamente (pokersync-agent://auth) e, ao mesmo tempo,
// mostra um link pra copiar e colar manualmente — porque o registro do
// esquema customizado no SO nem sempre funciona (varia por SO e até por
// forma de instalação, ex.: .deb vs AppImage no Linux), e quando falha o
// navegador só fica "carregando" pra sempre sem erro nenhum.
import { Suspense } from "react";
import AgentLoginConcluido from "./concluido-form";

export const metadata = {
  title: "Login concluído — PokerSync Agent",
};

export default function Page() {
  return (
    <Suspense>
      <AgentLoginConcluido />
    </Suspense>
  );
}
