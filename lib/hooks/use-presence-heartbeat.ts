"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Mesma janela usada em lib/services/friend-service.ts (isOnline) --
// precisa bater um heartbeat bem mais frequente que a janela pra
// "online" nao piscar entre atualizacoes.
const HEARTBEAT_MS = 60_000;

// Sem Supabase Realtime/Presence: so' grava profiles.last_seen_at
// periodicamente enquanto o app esta aberto (qualquer sessao logada --
// mesmo padrao de polling ja usado no resto do chat). A bolinha
// online/offline em qualquer lugar do app le esse timestamp.
export function usePresenceHeartbeat() {
  useEffect(() => {
    let ativo = true;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    async function bater() {
      const { data } = await supabase.auth.getUser();
      if (!ativo || !data.user) return;
      await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id);
    }

    bater();
    const id = setInterval(bater, HEARTBEAT_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, []);
}
