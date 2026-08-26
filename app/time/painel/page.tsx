"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, UserRound, Mail, Settings2, CalendarDays, Kanban, ArrowUpRight } from "lucide-react";
import { Chip } from "@/components/chip";
import { AppShell } from "@/components/app-shell";
import { PrintButton } from "@/components/period-selector";
import { TeamBanner } from "@/components/time/team-banner";
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
  uploadTeamBanner,
  removeTeamBanner,
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
import { fetchTeamEvents, type TeamEvent } from "@/lib/services/team-calendar-service";
import { TabVisaoGeral } from "@/components/time/tab-visao-geral";
import { TabJogadores } from "@/components/time/tab-jogadores";
import { TabConvites } from "@/components/time/tab-convites";
import { TabTime } from "@/components/time/tab-time";
import { TabCalendario } from "@/components/time/tab-calendario";
import { TeamPrintStyles } from "@/components/time/print-styles";
import { useConfirm } from "@/components/confirm-dialog";

// Painel do time: um so lugar, cinco abas (Funil tem pagina propria em
// /time/painel/funil — precisa de mais espaco vertical que uma aba
// permite). A aba fica na URL (?tab=) para que notificacao e link
// externo abram direto no ponto certo.

const PERIODOS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

type Aba = "visao" | "jogadores" | "convites" | "calendario" | "time";

const ABAS: { key: Aba; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "visao", label: "Visão geral", icon: LayoutDashboard },
  { key: "jogadores", label: "Jogadores", icon: UserRound },
  { key: "convites", label: "Convites", icon: Mail },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
  { key: "time", label: "Time", icon: Settings2 },
];

export default function PainelPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-sm text-muted">Carregando…</main>
        </AppShell>
      }
    >
      <PainelConteudo />
    </Suspense>
  );
}

function PainelConteudo() {
  const confirm = useConfirm();
  const router = useRouter();
  const params = useSearchParams();
  const abaUrl = (params.get("tab") as Aba) || "visao";

  const [aba, setAba] = useState<Aba>(ABAS.some((a) => a.key === abaUrl) ? abaUrl : "visao");
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviandoBanner, setEnviandoBanner] = useState(false);
  const bannerRef = useRef<HTMLInputElement>(null);

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
  const [eventos, setEventos] = useState<TeamEvent[]>([]);
  const [prefillEventoPlayerId, setPrefillEventoPlayerId] = useState<string | null>(null);

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

      const [rows, lk, at, fin, st, lb, pend, inv, comp, ev] = await Promise.all([
        fetchTeamDashboard(dias),
        fetchTeamLeaks(dias),
        fetchTeamActivity(dias),
        fetchFinancialSeries(dias),
        fetchTeamStaff().catch(() => []),
        i ? fetchTeamLabels(i.id).catch(() => []) : Promise.resolve([]),
        fetchPendingMembers().catch(() => []),
        fetchInvites(t.team.id).catch(() => []),
        fetchPeriodComparison(dias).catch(() => null),
        fetchTeamEvents().catch(() => []),
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
      setEventos(ev);
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

  useEffect(() => {
    const prefill = params.get("prefill");
    if (prefill) setPrefillEventoPlayerId(prefill);
  }, [params]);

  function trocarAba(nova: Aba) {
    setAba(nova);
    const url = nova === "visao" ? "/time/painel" : `/time/painel?tab=${nova}`;
    window.history.replaceState(null, "", url);
  }

  async function enviarBanner(file: File) {
    if (!info) return;
    if (file.size > 4 * 1024 * 1024) return setErro("Imagem muito grande (máximo 4 MB).");
    setEnviandoBanner(true);
    try {
      await uploadTeamBanner(info.id, file);
      await carregar();
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setEnviandoBanner(false);
    }
  }

  async function removerBanner() {
    if (!(await confirm({ title: "Remover banner", message: "O time volta pro degradê padrão.", confirmLabel: "Remover" }))) return;
    setEnviandoBanner(true);
    try {
      await removeTeamBanner();
      await carregar();
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setEnviandoBanner(false);
    }
  }

  const jogadores = useMemo(() => linhas.filter((l) => l.role === "player"), [linhas]);
  const coaches = useMemo(
    () => staff.filter((s) => s.isCoach).map((s) => ({ userId: s.userId, nome: s.nome })),
    [staff]
  );
  const isAdmin = time?.role === "admin";
  const podeEditarTime = time?.role !== "player";

  return (
    <AppShell>
      <main className="w-full mx-auto max-w-[1280px] px-6 py-10 text-ink print:max-w-full print:p-0">
        {/* Banner so' na Visao Geral (primeira tela) — nas outras abas ele
            so' empurrava conteudo pra baixo sem servir de navegacao real.
            Ali o banner substitui o header: leva o voltar embutido no
            canto, sem repetir nome/subtitulo que ele mesmo ja mostra. */}
        {aba === "visao" ? (
          info && (
            <div className="mb-6">
              {coaches.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center justify-end gap-1.5 print:hidden">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Coach{coaches.length > 1 ? "es" : ""}
                  </span>
                  {coaches.map((c) => (
                    <Chip key={c.userId} color={info.accent} size="sm">{c.nome}</Chip>
                  ))}
                </div>
              )}
              <TeamBanner
                name={info.name}
                description={info.description}
                accent={info.accent}
                logoUrl={info.logoUrl}
                bannerUrl={info.bannerUrl}
                editable={podeEditarTime}
                uploading={enviandoBanner}
                onUploadClick={() => bannerRef.current?.click()}
                onRemoveClick={removerBanner}
                right={<PrintButton />}
              />
              {podeEditarTime && (
                <input
                  ref={bannerRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) enviarBanner(f);
                    e.target.value = "";
                  }}
                />
              )}
            </div>
          )
        ) : null}

        {/* Print fica dentro da propria barra de abas (canto direito) nas
            demais abas — antes vinha num AppHeader vazio (so' esse botao),
            que virava uma faixa preta sem nada mais em cima da barra. */}
        <nav className="relative mb-5 flex justify-center gap-1 overflow-x-auto border-b border-hairline pt-4 print:hidden">
          {aba !== "visao" && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2">
              <PrintButton />
            </div>
          )}
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

          <Link href="/time/painel/funil"
            className="-mb-px flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:text-ink">
            <Kanban size={15} />
            Funil
            <ArrowUpRight size={12} className="text-muted/70" />
          </Link>
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
              <TabVisaoGeral jogadores={jogadores} atividade={atividade} financeiro={financeiro} comparacao={comparacao} pronto={pronto} dias={dias} periodos={PERIODOS} onDiasChange={setDias}
                onAbrirFunil={() => router.push("/time/painel/funil")} />
            )}
            {aba === "jogadores" && time && (
              <TabJogadores teamId={time.team.id} jogadores={jogadores} labels={labels} isAdmin={Boolean(isAdmin)}
                podeConversar={time?.role === "admin" || time?.role === "coach"} coaches={coaches}
                leaks={leaks} dias={dias} onAtribuido={carregar}
                onChange={carregar} onErro={setErro} />
            )}
            {aba === "convites" && time && (
              <TabConvites pendentes={pendentes} invites={invites} isAdmin={Boolean(isAdmin)} meuPapel={time.role}
                onChange={carregar} onErro={setErro} />
            )}
            {aba === "calendario" && time && (
              <TabCalendario eventos={eventos} jogadores={linhas} teamId={time.team.id}
                meuUserId={time.members.find((m) => m.isMe)?.userId ?? ""} meuPapel={time.role}
                podeCriar={time.role === "admin" || time.role === "coach"}
                prefillPlayerId={prefillEventoPlayerId}
                onPrefillConsumido={() => setPrefillEventoPlayerId(null)}
                onChange={carregar} onErro={setErro} />
            )}
            {aba === "time" && info && (
              <TabTime info={info} staff={staff} labels={labels} podeEditar={time?.role !== "player"}
                onChange={carregar} onErro={setErro} />
            )}
          </>
        )}
      </main>

      <TeamPrintStyles />
    </AppShell>
  );
}
