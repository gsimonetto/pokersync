"use client";

import { useEffect, useState } from "react";
import { Flame, Wallet } from "lucide-react";
import { Selo, TileIcone } from "./painel-card";
import { fetchProfile } from "@/lib/services/profile-service";
import { fetchProgress } from "@/lib/services/xp-service";
import { fetchSessions, fetchSettings, fetchTransactions } from "@/lib/services/bankroll-service";
import { aggregate, netWorth } from "@/lib/bankroll/calc";
import { formatBRL } from "@/lib/format";
import type { Session, Transaction } from "@/lib/bankroll/types";

function saudacao(hora: number): string {
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// Sessões dos últimos 30 dias contados a partir de HOJE. Não reaproveita
// filterSessionsByRange(sessions, "30D") de propósito: aquela função conta
// a partir da sessão mais recente, então quem parou de jogar há meses
// veria o resultado de um mês antigo rotulado como "30 dias".
function ultimos30Dias(sessions: Session[]): Session[] {
  const corte = new Date();
  corte.setDate(corte.getDate() - 30);
  const iso = corte.toISOString().slice(0, 10);
  return sessions.filter((s) => s.date >= iso);
}

export function PainelHeader() {
  const [nome, setNome] = useState("");
  const [streak, setStreak] = useState<number | null>(null);
  const [banca, setBanca] = useState<number | null>(null);
  const [delta30, setDelta30] = useState<number | null>(null);
  const [agora, setAgora] = useState<Date | null>(null);

  // Relógio ao vivo. Começa como null e só assume valor no cliente —
  // renderizar a hora direto no servidor daria erro de hidratação
  // (o horário do servidor nunca é igual ao do navegador).
  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [perfil, progresso, settings, sessions, transactions] = await Promise.allSettled([
        fetchProfile(),
        fetchProgress(),
        fetchSettings(),
        fetchSessions(),
        fetchTransactions(),
      ]);
      if (!vivo) return;

      if (perfil.status === "fulfilled") {
        setNome(perfil.value.apelido?.trim() || perfil.value.nome?.trim() || "");
      }
      if (progresso.status === "fulfilled") setStreak(progresso.value.streak_days);

      // Banca em jogo = base cadastrada + lucro das sessões + depósitos
      // - saques - caixinha (mesma conta da Gestão de Banca, netWorth()).
      const base = settings.status === "fulfilled" ? settings.value.bankroll : 0;
      const lista: Session[] = sessions.status === "fulfilled" ? sessions.value : [];
      const movs: Transaction[] = transactions.status === "fulfilled" ? transactions.value : [];
      if (settings.status === "fulfilled" || sessions.status === "fulfilled") {
        const lucro = aggregate(lista).profit;
        setBanca(netWorth(base, lucro, movs).playingBankroll);
        setDelta30(aggregate(ultimos30Dias(lista)).profit);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const hora = agora?.getHours() ?? 0;

  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          <span className="text-muted">{agora ? saudacao(hora) : "Olá"},</span>{" "}
          {nome || "jogador"} 👋
        </h1>
        <p className="mt-2 text-[13px] text-muted/70">Estude · Jogue · Revise · Evolua</p>

        {streak != null && streak > 0 && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-hairline bg-surface py-1.5 pl-1.5 pr-3.5">
            <TileIcone cor="#F59E0B">
              <Flame size={14} />
            </TileIcone>
            <span className="text-xs font-semibold text-evolution">
              {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
            </span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-5 sm:flex-col sm:items-end sm:gap-3">
        <div className="text-right">
          {/* 24h, sem AM/PM: é o formato usado no Brasil (a referência
              visual é americana, ali o "AM" fazia sentido). */}
          <p className="tnum text-4xl font-light leading-none sm:text-5xl">
            {agora
              ? `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`
              : "--:--"}
          </p>
          <p className="mt-1.5 text-[11px] capitalize text-muted/70">
            {agora
              ? agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3">
          <TileIcone cor="#2FB89A">
            <Wallet size={15} />
          </TileIcone>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted/70">Banca total</p>
            <p className="tnum text-base font-semibold leading-tight">
              {banca == null ? "—" : formatBRL(banca)}
            </p>
          </div>
          {delta30 != null && (
            <div className="border-l border-hairline pl-3">
              <Selo cor={delta30 > 0 ? "#22c55e" : delta30 < 0 ? "#e0555a" : "#c4c7c8"}>
                {delta30 > 0 ? "+" : ""}
                {formatBRL(delta30)}
              </Selo>
              <p className="mt-1 text-[10px] text-muted/60">30 dias</p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
