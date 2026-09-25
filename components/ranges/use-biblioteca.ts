"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  listarMeusRanges,
  listarProntos,
  listarRangesDoTime,
  rangeReal,
  type AcaoReal,
  type RangeReal,
  type RangeSalvo,
} from "@/lib/services/range-service";
import type { RangePronto } from "@/lib/ranges/prontos";

// Tudo que a pessoa pode abrir no Construtor: os ranges dela, os prontos
// do PokerSync (GTO), os do time e o "range de verdade" (esse só carrega
// quando alguém pede, porque varre as mãos importadas).

export interface MeuTime {
  id: string;
  nome: string;
}

export function useBiblioteca() {
  const [meuId, setMeuId] = useState<string | null>(null);
  const [meus, setMeus] = useState<RangeSalvo[]>([]);
  const [prontos, setProntos] = useState<RangePronto[]>([]);
  const [time, setTime] = useState<MeuTime | null>(null);
  const [doTime, setDoTime] = useState<RangeSalvo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [reais, setReais] = useState<Partial<Record<AcaoReal, RangeReal[]>>>({});
  const [carregandoReal, setCarregandoReal] = useState<AcaoReal | null>(null);

  const recarregar = useCallback(async () => {
    const supabase = createClient();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const id = session?.user.id ?? null;
      setMeuId(id);
      const [m, p, t] = await Promise.all([
        id ? listarMeusRanges() : Promise.resolve([]),
        listarProntos(),
        id
          ? supabase.from("team_members").select("team_id").eq("user_id", id).eq("status", "ativo").maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setMeus(m);
      setProntos(p);
      const teamId = (t.data as { team_id: string } | null)?.team_id;
      if (teamId) {
        const [{ data: linhaTime }, lista] = await Promise.all([
          supabase.from("teams").select("name").eq("id", teamId).maybeSingle(),
          listarRangesDoTime(teamId),
        ]);
        setTime({ id: teamId, nome: (linhaTime as { name: string } | null)?.name ?? "Time" });
        setDoTime(lista);
      } else {
        setTime(null);
        setDoTime([]);
      }
      setErro(null);
    } catch {
      setErro("Não consegui carregar seus ranges agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const carregarReal = useCallback(
    async (acao: AcaoReal) => {
      if (reais[acao] || carregandoReal === acao) return;
      setCarregandoReal(acao);
      try {
        const lista = await rangeReal(acao);
        setReais((atual) => ({ ...atual, [acao]: lista }));
      } catch {
        setReais((atual) => ({ ...atual, [acao]: [] }));
      } finally {
        setCarregandoReal(null);
      }
    },
    [reais, carregandoReal],
  );

  return { meuId, meus, prontos, time, doTime, carregando, erro, recarregar, reais, carregarReal, carregandoReal };
}

export type Biblioteca = ReturnType<typeof useBiblioteca>;
