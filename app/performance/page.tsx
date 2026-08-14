"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Hash, Percent, Flame, BookOpen, Target, Award, ShieldAlert } from "lucide-react";
import { fetchPlayerPerformance, type PlayerPerformance } from "@/lib/services/performance-service";

function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtSignedMoney(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const s = fmtMoney(Math.abs(v));
  return v < 0 ? `-${s}` : `+${s}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(2)}%`;
}

export default function PerformancePage() {
  const [data, setData] = useState<PlayerPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchPlayerPerformance();
        if (alive) setData(d);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "Falha ao carregar sua performance.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <main className="p-10 text-center text-sm text-muted">Carregando sua performance...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-center gap-3">
        <Link
          href="/modulos"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
          <p className="mt-0.5 text-sm text-muted">Sua evolução como jogador — banca, estudo e leaks, tudo em um lugar.</p>
        </div>
      </div>

      {err && (
        <p className="mt-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{err}</p>
      )}

      {!err && !data && (
        <p className="mt-6 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-muted">
          Ainda não há dados suficientes. Registre sessões na Gestão de Banca e revise mãos para ver sua performance aqui.
        </p>
      )}

      {data && (
        <>
          {/* Financeiro */}
          <SectionTitle>Financeiro</SectionTitle>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="ROI" value={fmtPct(data.roi_pct)} accent="#22d3ee" />
            <StatCard
              label="Lucro acumulado"
              value={fmtSignedMoney(data.lucro_acumulado)}
              tone={Number(data.lucro_acumulado) >= 0 ? "positive" : "negative"}
              accent={Number(data.lucro_acumulado) >= 0 ? "#22c55e" : "#e0555a"}
            />
            <StatCard label="$/hora" value={fmtMoney(data.dolar_hora)} accent="#6366f1" />
            <StatCard label="ABI (torneio)" value={fmtMoney(data.abi_torneio)} accent="#f59e0b" />
            <StatCard label="Maior sessão +" value={fmtSignedMoney(data.maior_sessao_positiva)} accent="#22c55e" />
            <StatCard label="Maior sessão -" value={fmtSignedMoney(data.maior_sessao_negativa)} accent="#e0555a" />
            <StatCard
              label="Downswing atual"
              value={fmtMoney(data.downswing_atual)}
              icon={<ShieldAlert size={11} />}
              accent={Number(data.downswing_atual) > 0 ? "#e0555a" : "#22c55e"}
            />
            <StatCard label="ITM% (aprox.)" value={fmtPct(data.itm_pct_aproximado)} accent="#f59e0b" />
          </div>

          {/* Volume */}
          <SectionTitle>Volume</SectionTitle>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Sessões" value={String(data.num_sessoes ?? "—")} icon={<Hash size={11} />} accent="#14b8a6" />
            <StatCard label="Horas jogadas" value={data.horas_jogadas ? `${data.horas_jogadas}h` : "—"} accent="#14b8a6" />
            <StatCard label="Torneios / Cash" value={`${data.num_torneios ?? 0} / ${data.num_cash ?? 0}`} accent="#6366f1" />
            <StatCard label="Frequência" value={data.frequencia_semanal_sessoes ? `${data.frequencia_semanal_sessoes}/sem` : "—"} accent="#6366f1" />
          </div>

          {/* Frequências de jogo — aproximado */}
          <SectionTitle>Frequências de jogo (aproximado)</SectionTitle>
          <p className="mt-1 text-xs text-muted">
            Calculado a partir das mãos coladas manualmente ({data.maos_com_dados_frequencia ?? 0} mãos com dado estruturado).
            Fica mais preciso com o agente desktop.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="VPIP" value={fmtPct(data.vpip_pct)} icon={<Percent size={11} />} accent="#22d3ee" />
            <StatCard label="PFR" value={fmtPct(data.pfr_pct)} icon={<Percent size={11} />} accent="#22d3ee" />
            <StatCard label="3-Bet" value={fmtPct(data.three_bet_pct)} icon={<Percent size={11} />} accent="#22d3ee" />
            <StatCard label="bb/100" value="Em breve" accent="#666" />
          </div>

          {/* Estudo / Evolução */}
          <SectionTitle>Estudo e evolução</SectionTitle>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Streak atual" value={String(data.streak_atual ?? 0)} icon={<Flame size={11} />} accent="#f59e0b" />
            <StatCard label="Recorde de streak" value={String(data.streak_best ?? 0)} icon={<Award size={11} />} accent="#f59e0b" />
            <StatCard label="XP total" value={String(data.xp_total ?? 0)} accent="#a855f7" />
            <StatCard label="Mãos revisadas" value={String(data.maos_revisadas ?? 0)} icon={<BookOpen size={11} />} accent="#a855f7" />
            <StatCard label="Drills treinados" value={String(data.num_drills ?? "—")} icon={<Target size={11} />} accent="#3b82f6" />
            <StatCard label="Taxa de acerto (Treino)" value={fmtPct(data.taxa_acerto_treino_pct)} accent="#3b82f6" />
          </div>

          {/* Leaks recorrentes */}
          <SectionTitle>Leaks mais recorrentes</SectionTitle>
          <section className="mt-2 rounded-xl border border-hairline bg-surface p-5">
            {!data.top_leaks || data.top_leaks.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhum leak identificado ainda. Marque &quot;Errei&quot; com o motivo na auto-avaliação por rua do Revisor de Mãos
                pra alimentar essa lista.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.top_leaks.map((leak) => (
                  <div key={leak.code} className="flex items-center justify-between rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold">{leak.label ?? leak.code}</p>
                      {leak.category && <p className="text-xs text-muted capitalize">{leak.category}</p>}
                    </div>
                    <span className="text-sm font-bold text-evolution">{leak.ocorrencias}x</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="mt-6 text-center text-[11px] text-muted">
            Atualizado em {new Date(data.updated_at).toLocaleString("pt-BR")}
          </p>
        </>
      )}
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-muted">{children}</h2>;
}

function StatCard({
  label,
  value,
  tone,
  icon,
  accent,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  icon?: React.ReactNode;
  accent: string;
}) {
  const color = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-ink";
  return (
    <div
      style={{ "--acc": accent } as React.CSSProperties}
      className="acc-card acc-lift group relative overflow-hidden rounded-xl border border-hairline bg-surface p-3.5"
    >
      <div aria-hidden="true" className="acc-glow pointer-events-none absolute -right-6 -top-6 size-20 rounded-full blur-2xl" />
      <p className="relative flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        {icon}
        {label}
      </p>
      <p className={`relative mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
