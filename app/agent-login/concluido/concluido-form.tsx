"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, Check } from "lucide-react";
import { Logo } from "@/components/logo";

const SHOW_FALLBACK_AFTER_MS = 1800;

export default function AgentLoginConcluido() {
  const searchParams = useSearchParams();
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const state = searchParams.get("state");

  const [showFallback, setShowFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  const valid = Boolean(accessToken && refreshToken && state);
  const deepLink = valid
    ? `pokersync-agent://auth?${new URLSearchParams({
        access_token: accessToken!,
        refresh_token: refreshToken!,
        state: state!,
      }).toString()}`
    : null;

  useEffect(() => {
    if (!deepLink) return;
    // Tenta abrir o agente sozinho. Se o SO souber tratar o esquema
    // pokersync-agent://, a aba fica pra trás e o app abre em foco — se
    // não souber, isso é inofensivo (o navegador ignora silenciosamente
    // ou mostra o próprio aviso de "link desconhecido").
    window.location.href = deepLink;
    const t = setTimeout(() => setShowFallback(true), SHOW_FALLBACK_AFTER_MS);
    return () => clearTimeout(t);
  }, [deepLink]);

  async function copyLink() {
    if (!deepLink) return;
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível (raro) -- o link já está selecionável na tela
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-void text-ink flex items-center justify-center p-4 overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.04] pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/[0.06] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-hairline bg-surface p-8 shadow-2xl shadow-black/60 text-center">
        <div className="flex flex-col items-center space-y-4 mb-6">
          <Logo className="h-12 w-auto" />
          {!valid ? (
            <div>
              <h1 className="text-base font-semibold">Link inválido</h1>
              <p className="text-sm text-muted mt-1">
                Volte pro PokerSync Agent e tente entrar com Google de novo.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-center gap-2 text-positive mb-1">
                <CheckCircle2 size={18} />
                <span className="text-sm font-semibold">Login confirmado</span>
              </div>
              <p className="text-sm text-muted mt-1">
                {showFallback ? "Voltando pro PokerSync Agent..." : "Abrindo o PokerSync Agent..."}
              </p>
            </div>
          )}
        </div>

        {valid && showFallback && (
          <div className="border-t border-hairline pt-5 text-left">
            <p className="text-xs text-muted mb-3">
              Não abriu sozinho? Copie o link abaixo e cole no PokerSync Agent — na tela de login, em{" "}
              <strong className="text-ink">&quot;Colar link de login&quot;</strong>.
            </p>
            <button
              type="button"
              onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-ink text-void text-sm font-semibold py-2.5 px-4 hover:bg-white/90 transition-all cursor-pointer"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copiado!" : "Copiar link de login"}
            </button>
            <p className="text-[11px] text-muted/70 mt-3 break-all font-mono">{deepLink}</p>
          </div>
        )}
      </div>
    </div>
  );
}
