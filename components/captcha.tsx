"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// CAPTCHA do login (Cloudflare Turnstile): confere em segundo plano se é
// uma pessoa -- quase sempre sem pedir clique nenhum. O token gerado vai
// junto do login/cadastro/esqueci-senha e o PRÓPRIO Supabase valida
// (Authentication → Attack Protection → CAPTCHA), então um robô que
// chama a API do Supabase direto, sem passar pelo site, também é barrado.
//
// Liga só quando NEXT_PUBLIC_TURNSTILE_SITE_KEY existe. Sem a chave o
// componente não renderiza nada e o login segue como antes -- ordem
// segura de ativar: publicar o site com a chave, e SÓ DEPOIS ligar o
// CAPTCHA no Supabase (ao contrário, todo login falharia).
export const CAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const CAPTCHA_ATIVO = CAPTCHA_SITE_KEY.length > 0;

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let carregando: Promise<void> | null = null;
function carregarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!carregando) {
    carregando = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => {
        carregando = null;
        falha(new Error("captcha"));
      };
      document.head.appendChild(s);
    });
  }
  return carregando;
}

export interface CaptchaHandle {
  /** Cada token vale uma vez só: chame depois de cada tentativa. */
  reset: () => void;
}

export const Captcha = forwardRef<CaptchaHandle, { onToken: (token: string | null) => void }>(function Captcha({ onToken }, ref) {
  const caixa = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const aviso = useRef(onToken);
  aviso.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      aviso.current(null);
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!CAPTCHA_ATIVO) return;
    let vivo = true;
    carregarScript()
      .then(() => {
        if (!vivo || !caixa.current || !window.turnstile) return;
        widget.current = window.turnstile.render(caixa.current, {
          sitekey: CAPTCHA_SITE_KEY,
          theme: "dark",
          language: "pt-br",
          size: "flexible",
          callback: (t: string) => aviso.current(t),
          "expired-callback": () => aviso.current(null),
          "error-callback": () => aviso.current(null),
        });
      })
      .catch(() => aviso.current(null));
    return () => {
      vivo = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  if (!CAPTCHA_ATIVO) return null;
  return <div ref={caixa} className="min-h-[65px] w-full" />;
});
