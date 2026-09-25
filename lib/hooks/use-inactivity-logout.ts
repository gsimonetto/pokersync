"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { sairDesteAparelho } from "@/lib/supabase/sair-deste-aparelho";

// Mesmo teto de lib/supabase/middleware.ts -- os dois precisam bater
// pro comportamento ser consistente entre "sentou parado numa tela" e
// "voltou depois de dias e o middleware barra na proxima navegacao".
const LIMIT_MS = 2 * 60 * 60 * 1000; // 2 horas
const STORAGE_KEY = "pokersync:last-activity";
const CHECK_INTERVAL_MS = 30_000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;

// O middleware (lib/supabase/middleware.ts) so' reavalia inatividade
// quando uma requisicao chega ao servidor Next -- numa SPA o usuario
// pode ficar horas numa mesma tela (chat, funil, etc.) sem nenhuma nova
// navegacao acontecer, entao esse relogio no servidor nunca e'
// reconferido e a sessao nunca expira de verdade. Este hook mede
// atividade real no navegador (mouse/teclado/scroll), guarda em
// localStorage (sobrevive a troca de aba/rota, sincroniza entre abas
// da mesma origem) e forca logout + hard-redirect quando estoura o
// mesmo teto de 2h. Montado uma vez no AppShell, cobre toda pagina
// logada.
export function useInactivityLogout() {
  const saindoRef = useRef(false);

  useEffect(() => {
    let ativo = true;
    let temSessao = false;

    // So' liga o watcher se houver sessao -- o hook e' montado tambem
    // em paginas publicas via TopNav (components/top-nav.tsx renderiza
    // sempre, mesmo quando devolve null pro proprio nav), e nao faria
    // sentido forcar "sessao expirada" em quem nunca logou.
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    function gravar() {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // localStorage indisponivel (ex: modo privado) -- sem watcher
        // nesse caso, mas nao quebra o resto da tela por isso
      }
    }

    function expirou(): boolean {
      try {
        const last = Number(localStorage.getItem(STORAGE_KEY) ?? Date.now());
        return Date.now() - last > LIMIT_MS;
      } catch {
        return false;
      }
    }

    // Movimento/tecla: ANTES de renovar o relógio, confere se ele já
    // tinha estourado. Antes renovava direto -- aba esquecida aberta a
    // noite toda (ou PC que hibernou) "voltava à vida" no primeiro
    // movimento do mouse, antes da checagem periódica rodar, e a sessão
    // nunca expirava (bug relatado).
    function marcarAtividade() {
      if (!temSessao || saindoRef.current) return;
      if (expirou()) {
        sair();
        return;
      }
      gravar();
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!ativo) return;
      temSessao = Boolean(data.user);
      // Baseline: a página acabou de carregar e o servidor
      // (lib/supabase/middleware.ts) já conferiu a inatividade nesta
      // requisição -- então vale como atividade, mesmo que o valor
      // guardado aqui seja de um login antigo.
      if (temSessao) gravar();
    });

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, marcarAtividade, { passive: true }));

    // A aba volta ao foco (PC acordou, trocou de aba): confere na hora.
    function aoVoltar() {
      if (document.visibilityState === "visible" && temSessao && !saindoRef.current && expirou()) sair();
    }
    document.addEventListener("visibilitychange", aoVoltar);

    const id = setInterval(() => {
      if (saindoRef.current || !temSessao) return;
      if (expirou()) sair();
    }, CHECK_INTERVAL_MS);

    async function sair() {
      if (saindoRef.current) return;
      saindoRef.current = true;
      try {
        const supabase = createClient();
        await sairDesteAparelho(supabase);
      } catch {
        // segue o redirect mesmo se a chamada falhar
      }
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // sem problema deixar sobrar -- a proxima sessao sobrescreve
      }
      // Hard navigation: garante que a tela de login carregue
      // refletindo os cookies de verdade (ja limpos pelo signOut acima),
      // sem depender de estado do router client-side.
      window.location.href = "/login?expirado=1";
    }

    return () => {
      ativo = false;
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, marcarAtividade));
      document.removeEventListener("visibilitychange", aoVoltar);
      clearInterval(id);
    };
  }, []);
}
