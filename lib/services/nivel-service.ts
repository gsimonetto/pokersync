"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Nível + XP do nível atual de qualquer jogador, pro anel em volta da
// foto (components/avatar-nivel.tsx). Uma foto pede o nível pelo id; os
// pedidos que chegam juntos (uma lista inteira renderizando) viram UMA
// chamada à RPC get_players_level, e o resultado fica guardado na
// memória da aba -- abrir a mesma lista de novo não consulta outra vez.
//
// Sem a RPC no banco (migração ainda não aplicada) tudo volta vazio e a
// foto aparece com o anel neutro, sem quebrar nada.

export interface NivelJogador {
  nivel: number;
  xpAtual: number;
}

const cache = new Map<string, NivelJogador | null>();
const pendentes = new Set<string>();
const ouvintes = new Set<() => void>();
let agendado: ReturnType<typeof setTimeout> | null = null;
let rpcDisponivel = true;

function avisar() {
  for (const o of ouvintes) o();
}

async function buscarPendentes() {
  agendado = null;
  const ids = [...pendentes];
  pendentes.clear();
  if (ids.length === 0) return;
  if (!rpcDisponivel) {
    for (const id of ids) cache.set(id, null);
    avisar();
    return;
  }
  try {
    const supabase = createClient();
    for (let i = 0; i < ids.length; i += 500) {
      const lote = ids.slice(i, i + 500);
      const { data, error } = await supabase.rpc("get_players_level", { p_ids: lote });
      if (error) {
        if (error.code === "PGRST202" || error.code === "42883") rpcDisponivel = false;
        for (const id of lote) cache.set(id, null);
        continue;
      }
      const achados = new Set<string>();
      for (const r of (data ?? []) as { user_id: string; level: number; xp_current: number }[]) {
        cache.set(r.user_id, { nivel: r.level ?? 1, xpAtual: r.xp_current ?? 0 });
        achados.add(r.user_id);
      }
      for (const id of lote) if (!achados.has(id)) cache.set(id, null);
    }
  } catch {
    for (const id of ids) if (!cache.has(id)) cache.set(id, null);
  }
  avisar();
}

function pedir(id: string) {
  if (cache.has(id) || pendentes.has(id)) return;
  pendentes.add(id);
  if (!agendado) agendado = setTimeout(buscarPendentes, 20);
}

/** Guarda um nível que a tela já recebeu por outro caminho (ex.: ranking). */
export function lembrarNivel(id: string, dados: NivelJogador) {
  cache.set(id, dados);
}

/** Esquece um jogador (ex.: o próprio usuário depois de ganhar XP). */
export function esquecerNivel(id: string) {
  cache.delete(id);
}

export function useNivelDoJogador(id: string | null | undefined): NivelJogador | null {
  const [, setVersao] = useState(0);
  useEffect(() => {
    if (!id) return;
    const ouvir = () => setVersao((v) => v + 1);
    ouvintes.add(ouvir);
    pedir(id);
    return () => {
      ouvintes.delete(ouvir);
    };
  }, [id]);
  return id ? cache.get(id) ?? null : null;
}
