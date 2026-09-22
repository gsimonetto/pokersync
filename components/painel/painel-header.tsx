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

  // No computador o cabeçalho precisa ser BAIXO: a tela inteira tem que
  // caber na janela sem barra de rolagem, então cada pixel gasto aqui
  // sai do espaço dos cards. Por isso a sequência fica ao lado da
  // saudação (não embaixo) e o relógio ao lado da banca.
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
          <span className="text-muted">{agora ? saudacao(hora) : "Olá"},</span>{" "}
          <span className="painel-roxo">{nome || "jogador"}</span> 👋
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <p className="text-[12px] text-muted/70">Estude · Jogue · Revise · Evolua</p>
          {streak != null && streak > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-evolution/25 bg-evolution/10 px-2.5 py-1">
              <Flame size={12} className="text-evolution" />
              <span className="text-[11px] font-semibold text-evolution">
                {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          {/* 24h, sem AM/PM: é o formato usado no Brasil (a referência
              visual é americana, ali o "AM" fazia sentido). */}
          <p className="tnum text-3xl font-light leading-none sm:text-4xl">
            {agora
              ? `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`
              : "--:--"}
          </p>
          <p className="mt-1 text-[11px] capitalize text-muted/70">
            {agora
              ? agora.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-3.5 py-2.5">
          <TileIcone cor="#a855f7">
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
