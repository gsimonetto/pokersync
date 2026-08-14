"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Users, Printer, LayoutDashboard, UserRound, Mail, Settings2 } from "lucide-react";
import {
  fetchFinancialSeries,
  fetchMyTeam,
  fetchPeriodComparison,
  fetchPendingMembers,
  fetchTeamActivity,
  fetchTeamDashboard,
  fetchTeamInfo,
  fetchTeamLabels,
  fetchTeamLeaks,
  fetchTeamStaff,
  fetchInvites,
  traduzErroTime,
  type FinancialDay,
  type MyTeam,
  type PendingMember,
  type PeriodComparison,
  type TeamActivityDay,
  type TeamDashboardRow,
  type TeamInfo,
  type TeamInvite,
  type TeamLabel,
  type TeamLeak,
  type TeamStaff,
} from "@/lib/services/team-service";
import { TabVisaoGeral } from "@/components/time/tab-visao-geral";
import { TabJogadores } from "@/components/time/tab-jogadores";
import { TabConvites } from "@/components/time/tab-convites";
import { TabTime } from "@/components/time/tab-time";

// Painel do time: um so lugar, quatro abas. A aba fica na URL (?tab=)
// para que notificacao e link externo abram direto no ponto certo.
// Espacamento de borda seguindo Banca/Revisor: max-w-6xl px-6 py-10.

const PERIODOS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

type Aba = "visao" | "jogadores" | "convites" | "time";

const ABAS: { key: Aba; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "visao", label: "Visão geral", icon: LayoutDashboard },
  { key: "jogadores", label: "Jogadores", icon: UserRound },
  { key: "convites", label: "Convites", icon: Mail },
  { key: "time", label: "Time", icon: Settings2 },
];

export default function PainelPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted">Carregando…</main>}>
      <PainelConteudo />
    </Suspense>
  );
}

function PainelConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const abaUrl = (params.get("tab") as Aba) || "visao";

  const [aba, setAba] = useState<Aba>(ABAS.some((a) => a.key === abaUrl) ? abaUrl : "visao");
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [time, setTime] = useState<MyTeam | null>(null);
  const [info, setInfo] = useState<TeamInfo | null>(null);
  const [staff, setStaff] = useState<TeamStaff[]>([]);
  const [labels, setLabels] = useState<TeamLabel[]>([]);
  const [linhas, setLinhas] = useState<TeamDashboardRow[]>([]);
  const [leaks, setLeaks] = useState<TeamLeak[]>([]);
  const [atividade, setAtividade] = useState<TeamActivityDay[]>([]);
  const [financeiro, setFinanceiro] = useState<FinancialDay[]>([]);
  const [pendentes, setPendentes] = useState<PendingMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [comparacao, setComparacao] = useState<PeriodComparison | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setPronto(false);
    setErro(null);
    try {
      const [t, i] = await Promise.all([fetchMyTeam(), fetchTeamInfo()]);
      if (!t) {
        router.replace("/time");
        return;
      }
      setTime(t);
      setInfo(i);

      const [rows, lk, at, fin, st, lb, pend, inv, comp] = await Promise.all([
        fetchTeamDashboard(dias),
        fetchTeamLeaks(dias),
        fetchTeamActivity(dias),
        fetchFinancialSeries(dias),
        fetchTeamStaff().catch(() => []),
        i ? fetchTeamLabels(i.id).catch(() => []) : Promise.resolve([]),
        fetchPendingMembers().catch(() => []),
        fetchInvites(t.team.id).catch(() => []),
        fetchPeriodComparison(dias).catch(() => null),
      ]);
      setLinhas(rows);
      setLeaks(lk);
      setAtividade(at);
      setFinanceiro(fin);
      setStaff(st);
      setLabels(lb);
      setPendentes(pend);
      setInvites(inv);
      setComparacao(comp);
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => setPronto(true));
    }
  }, [dias, router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function trocarAba(nova: Aba) {
    setAba(nova);
    const url = nova === "visao" ? "/time/painel" : `/time/painel?tab=${nova}`;
    window.history.replaceState(null, "", url);
  }

  const jogadores = useMemo(() => linhas.filter((l) => l.role === "player"), [linhas]);
  const coaches = useMemo(
    () => staff.filter((s) => s.isCoach).map((s) => ({ userId: s.userId, nome: s.nome })),
    [staff]
  );
  const isAdmin = time?.role === "admin";

  return (
    <>
      <main className="mx-auto max-w-6xl px-6 py-10 text-ink print:max-w-full print:p-0">
        <header className="mb-5 flex flex-wrap items-center gap-3 print:mb-4">
          <Link href="/modulos"
            className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink print:hidden"
            aria-label="Voltar">
            <ArrowLeft size={18} />
          </Link>

          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-hairline"
            style={{ backgroundColor: `${info?.accent ?? "#5AA6E0"}18` }}>
            {info?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.logoUrl} alt={info.name} className="h-full w-full object-cover" />
            ) : (
              <Users size={18} style={{ color: info?.accent ?? "#5AA6E0" }} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="m-0 truncate text-xl font-semibold tracking-tight">{info?.name ?? "Painel do time"}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {time?.role === "coach" ? "Seus jogadores acompanhados" : "Visão geral da organização"}
              <span className="hidden print:inline"> · gerado em {new Date().toLocaleDateString("pt-BR")}</span>
            </p>
          </div>

          <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1 print:hidden">
            {PERIODOS.map((p) => (
              <button key={p.days} onClick={() => setDias(p.days)}
                className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                  dias === p.days ? "bg-ink text-void" : "text-muted hover:text-ink"
                }`}>
                {p.label}
              </button>
            ))}
          </div>

          <button onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40 print:hidden">
            <Printer size={15} />
            PDF
          </button>
        </header>

        <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-hairline print:hidden">
          {ABAS.map((a) => {
            const Icon = a.icon;
            const pend = a.key === "convites" ? pendentes.length : 0;
            return (
              <button key={a.key} onClick={() => trocarAba(a.key)}
                className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  aba === a.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}>
                <Icon size={15} />
                {a.label}
                {pend > 0 && (
                  <span className="rounded-full bg-evolution px-1.5 text-[10px] font-bold leading-4 text-void">{pend}</span>
                )}
              </button>
            );
          })}
        </nav>

        {erro && (
          <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative print:hidden">
            {erro}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted">Carregando painel…</p>
        ) : (
          <>
            {aba === "visao" && (
              <TabVisaoGeral jogadores={jogadores} atividade={atividade} financeiro={financeiro} leaks={leaks} comparacao={comparacao} pronto={pronto} dias={dias} onAtribuido={carregar} />
            )}
            {aba === "jogadores" && (
              <TabJogadores jogadores={jogadores} labels={labels} isAdmin={Boolean(isAdmin)} coaches={coaches}
                onChange={carregar} onErro={setErro} />
            )}
            {aba === "convites" && time && (
              <TabConvites pendentes={pendentes} invites={invites} isAdmin={Boolean(isAdmin)} meuPapel={time.role}
                onChange={carregar} onErro={setErro} />
            )}
            {aba === "time" && info && (
              <TabTime info={info} staff={staff} labels={labels} podeEditar={time?.role !== "player"}
                onChange={carregar} onErro={setErro} />
            )}
          </>
        )}
      </main>

      <style jsx global>{`
        @media print {
          body { background: #fff !important; color: #111 !important; }
          .text-ink, .text-ink\\/90, .font-medium, .font-semibold { color: #111 !important; }
          .text-muted { color: #555 !important; }
          .bg-surface, .bg-elevated { background: #fff !important; border-color: #ddd !important; }
          .border-hairline { border-color: #ddd !important; }
          @page { margin: 14mm; }
        }
      `}</style>
    </>
  );
}
