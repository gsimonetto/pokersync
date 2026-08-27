"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11C3.24 21.3 7.28 24 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.27 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.62H1.26A11.97 11.97 0 000 12c0 1.94.46 3.77 1.26 5.38l4.01-3.11z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.28 0 3.24 2.7 1.26 6.62l4.01 3.11c.95-2.85 3.6-4.96 6.73-4.96z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function AgentLoginForm() {
  const searchParams = useSearchParams();
  const state = searchParams.get("state");
  const deviceName = searchParams.get("device");

  const [isLoading, setIsLoading] = useState(false);
  const [err, setErr] = useState(
    state ? "" : "Link inválido — abra o login pelo botão \"Entrar com Google\" dentro do PokerSync Agent."
  );

  async function handleGoogleLogin() {
    if (!state) return;
    setErr("");
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/confirm?agent_state=${encodeURIComponent(state)}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setErr(message || "Não foi possível entrar com o Google.");
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full bg-void text-ink flex items-center justify-center p-4 overflow-hidden font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.04] pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/[0.06] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm rounded-xl border border-hairline bg-surface p-8 shadow-2xl shadow-black/60 text-center">
        <div className="flex flex-col items-center space-y-4 mb-6">
          <Logo className="h-12 w-auto" />
          <div>
            <h1 className="text-base font-semibold">Entrar no PokerSync Agent</h1>
            <p className="text-sm text-muted mt-1">
              {deviceName ? `Autorizando "${deviceName}"` : "Autorizando o agente desktop"} com sua conta PokerSync.
            </p>
          </div>
        </div>

        {err && (
          <p className="flex items-center gap-1.5 text-sm text-negative mb-4 text-left">
            <AlertCircle size={14} className="shrink-0" />
            {err}
          </p>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading || !state}
          className="w-full bg-elevated hover:bg-white/10 border border-hairline text-ink font-medium text-sm py-2.5 px-4 rounded-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />
          ) : (
            <>
              <GoogleIcon className="w-4 h-4" />
              <span>Continuar com Google</span>
            </>
          )}
        </button>

        <p className="text-xs text-muted mt-6">
          Essa janela fecha sozinha depois do login. Se nada acontecer, volte pro PokerSync Agent.
        </p>
      </div>
    </div>
  );
}
