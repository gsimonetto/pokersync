"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { fetchSessions } from "@/lib/services/bankroll-service";

// Fecha o ciclo "jogou -> refletiu": se o jogador já lançou uma sessão
// hoje mas não preencheu mood/tilt/diaryNote (campos que já existem em
// bankroll_sessions, sem uso nenhum na Home até agora), um convite leve
// pra fechar a sessão com uma reflexão -- a alma de um diário de
// rotina de verdade, não só números. Sem sessão hoje, ou sessão já
// refletida, o componente não renderiza nada (nunca insiste à toa).
export function ReflectionPrompt() {
  const [precisaRefletir, setPrecisaRefletir] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sessions = await fetchSessions();
        if (!alive) return;
        const hoje = new Date().toISOString().slice(0, 10);
        const sessaoHoje = sessions.find((s) => s.date === hoje);
        if (sessaoHoje && !sessaoHoje.mood && sessaoHoje.tilt == null && !sessaoHoje.diaryNote) {
          setPrecisaRefletir(true);
        }
      } catch {
        // sem Supabase/sessão: não mostra nada, não quebra a tela
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!precisaRefletir) return null;

  return (
    <Link
      href="/banca"
      className="fade-in-up flex items-center gap-3 rounded-2xl border border-training/35 bg-training/8 p-4 transition-colors hover:border-training/60"
      style={{ animationDelay: "30ms" }}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-training/40 bg-training/15 text-training">
        <NotebookPen size={16} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">Como foi a sessão de hoje?</span>
        <span className="block text-xs text-muted">Registrar o humor e uma nota rápida leva 30 segundos.</span>
      </span>
    </Link>
  );
}
