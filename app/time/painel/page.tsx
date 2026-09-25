"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AlertTriangle, UserRound, Settings2, CalendarDays, Kanban, IdCard, LayoutGrid, Inbox, Mail, ShieldCheck, Tag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  fetchFinancialSeries,
  fetchMyTeam,
  fetchPeriodComparison,
  fetchPendingMembers,
  fetchTeamActivity,
  fetchTeamDashboard,
  fetchTeamInfo,
  fetchTeamLabels,
  fetchTeamScoreHistory,
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
  type TeamScoreHistoryPoint,
  type TeamStaff,
} from "@/lib/services/team-service";
import { fetchTeamEvents, type TeamEvent } from "@/lib/services/team-calendar-service";
import { TabVisaoGeral } from "@/components/time/tab-visao-geral";
import { TabJogadores } from "@/components/time/tab-jogadores";
import { TabConvites } from "@/components/time/tab-convites";
import { EquipeTecnica, EtiquetasTime, ExcluirTime, PerfilDoTime } from "@/components/time/tab-time";
import { TabCalendario } from "@/components/time/tab-calendario";
import { TabMaosRecebidas } from "@/components/time/tab-maos-recebidas";
import { TeamPrintStyles } from "@/components/time/print-styles";
import { useConfirm } from "@/components/confirm-dialog";
import { PainelVisual } from "@/components/dashboard/kit";
import { EASE } from "@/components/painel/painel-card";
import { PerfEstilos } from "@/components/performance/perf-estilos";
import { AbasAnimadas } from "@/components/performance/abas-animadas";
import { FunilAba } from "@/components/time/funil-aba";

// Painel do time, no visual da tela inicial e da Performance (vidro,
// menu animado no topo, atalhos 1-6). Seis abas: o dia a dia do coach na
// frente (Visão geral, Jogadores, Funil, Calendário, Mãos recebidas) e as
// ações raras juntas em "Gestão" (perfil do time, configurações e
// convites). A aba fica na URL (?tab=) pra notificação e link externo
// abrirem direto no ponto certo; os nomes antigos continuam valendo.

const PERIODOS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

type Aba = "geral" | "jogadores" | "funil" | "calendario" | "maos" | "gestao";

const ABAS: { value: Aba; label: string; icon: typeof LayoutGrid; soCoach?: boolean }[] = [
  { value: "geral", label: "Visão geral", icon: LayoutGrid },
  { value: "jogadores", label: "Jogadores", icon: UserRound },
  { value: "funil", label: "Funil", icon: Kanban },
  { value: "calendario", label: "Calendário", icon: CalendarDays },
  { value: "maos", label: "Mãos recebidas", icon: Inbox, soCoach: true },
  { value: "gestao", label: "Gestão", icon: Settings2 },
];

// Abas antigas -> novas (links de notificação e favoritos). A seção de
// destino dentro de "Gestão" recebe foco por âncora.
const ABA_ANTIGA: Record<string, { aba: Aba; secao?: string }> = {
  estatisticas: { aba: "geral" },
  perfil: { aba: "gestao", secao: "gestao-perfil" },
  time: { aba: "gestao", secao: "gestao-perfil" },
  convites: { aba: "gestao", secao: "gestao-convites" },
};

function lerAba(v: string | null): { aba: Aba; secao?: string } {
  if (!v) return { aba: "geral" };
  if (ABA_ANTIGA[v]) return ABA_ANTIGA[v];
  return ABAS.some((a) => a.value === v) ? { aba: v as Aba } : { aba: "geral" };
}

export default function PainelPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <main className="w-full px-6 py-10 sm:px-8 text-sm text-muted">Carregando…</main>
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
  const inicial = lerAba(params.get("tab"));
  const [aba, setAba] = useState<Aba>(inicial.aba);
  const [secaoAlvo, setSecaoAlvo] = useState<string | undefined>(inicial.secao);
  const [direcao, setDirecao] = useState(1);
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
  const [historicoScoreTime, setHistoricoScoreTime] = useState<TeamScoreHistoryPoint[]>([]);
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

      const [rows, at, fin, st, lb, pend, inv, comp, ev, histScore] = await Promise.all([
        fetchTeamDashboard(dias),
        fetchTeamActivity(dias),
        fetchFinancialSeries(dias),
        fetchTeamStaff().catch(() => []),
        i ? fetchTeamLabels(i.id).catch(() => []) : Promise.resolve([]),
        fetchPendingMembers().catch(() => []),
        fetchInvites(t.team.id).catch(() => []),
        fetchPeriodComparison(dias).catch(() => null),
        fetchTeamEvents().catch(() => []),
        // Jogador não tem permissão pra essa RPC (é visão de admin/coach) -- cai pra vazio sem quebrar a tela.
        fetchTeamScoreHistory(dias).catch(() => []),
      ]);
      setLinhas(rows);
      setAtividade(at);
      setFinanceiro(fin);
      setStaff(st);
      setLabels(lb);
      setPendentes(pend);
      setInvites(inv);
      setComparacao(comp);
      setEventos(ev);
      setHistoricoScoreTime(histScore);
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
    const de = ABAS.findIndex((a) => a.value === aba);
    const para = ABAS.findIndex((a) => a.value === nova);
    if (para !== de) setDirecao(para > de ? 1 : -1);
    setAba(nova);
    setSecaoAlvo(undefined);
    const url = nova === "geral" ? "/time/painel" : `/time/painel?tab=${nova}`;
    window.history.replaceState(null, "", url);
  }

  // Link antigo pra Convites/Perfil/Time: abre Gestão e rola até a seção.
  useEffect(() => {
    if (!secaoAlvo || loading) return;
    const t = setTimeout(() => document.getElementById(secaoAlvo)?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
    return () => clearTimeout(t);
  }, [secaoAlvo, loading]);

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
  const abasVisiveis = useMemo(
    () => ABAS.filter((a) => !a.soCoach || podeEditarTime).map((a) => (a.value === "gestao" ? { ...a, badge: pendentes.length } : a)),
    [podeEditarTime, pendentes.length],
  );

  return (
    <AppShell>
      <PainelVisual value="vidro">
        <MotionConfig reducedMotion="user">
          <main className="perf w-full px-4 pb-12 pt-6 text-ink md:px-6 print:p-0">
            <PerfEstilos />

            <header className="mb-4 flex flex-col gap-1 print:hidden">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{info?.name ?? time?.team.name ?? "Meu time"}</h1>
              <p className="text-[12.5px] text-muted">
                Painel do time{time ? ` · ${time.role === "admin" ? "você é admin" : time.role === "coach" ? "você é coach" : "você é jogador"}` : ""}. Passe o mouse nos números pra saber o que são.
              </p>
            </header>

            {/* Menu no topo, igual Performance: preso ao rolar, atalhos 1-6,
                e no celular rola de lado em vez de virar menu sanduíche. */}
            <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-white/[0.06] bg-black/70 px-4 pt-2 backdrop-blur-xl md:-mx-6 md:px-6 print:hidden">
              <AbasAnimadas value={aba} onChange={trocarAba} options={abasVisiveis} rotulo="Seções do time" />
            </div>

            {erro && (
              <p className="mb-4 rounded-xl border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative print:hidden">{erro}</p>
            )}

            {loading ? (
              <div className="grid gap-3.5">
                <div className="painel-esqueleto h-[210px] rounded-3xl" />
                <div className="grid gap-3.5 lg:grid-cols-2">
                  <div className="painel-esqueleto h-[300px] rounded-3xl" />
                  <div className="painel-esqueleto h-[300px] rounded-3xl" />
                </div>
              </div>
            ) : (
              <div className="overflow-x-clip">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={aba}
                    initial={{ opacity: 0, x: 28 * direcao }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28 * direcao }}
                    transition={{ duration: 0.28, ease: EASE }}
                  >
                    {aba === "geral" && time && (
                      <TabVisaoGeral jogadores={jogadores} atividade={atividade} financeiro={financeiro} comparacao={comparacao} eventos={eventos} historicoScoreTime={historicoScoreTime} pronto={pronto} dias={dias} periodos={PERIODOS} onDiasChange={setDias} />
                    )}
                    {aba === "jogadores" && time && (
                      <Moldura>
                        <TabJogadores jogadores={jogadores} labels={labels} isAdmin={Boolean(isAdmin)} coaches={coaches}
                          onChange={carregar} onErro={setErro} />
                      </Moldura>
                    )}
                    {aba === "funil" && time && <FunilAba time={time} onErro={setErro} />}
                    {/* Calendário já vem no próprio cartão de vidro (mesmo do Início). */}
                    {aba === "calendario" && time && (
                        <TabCalendario eventos={eventos} jogadores={linhas} teamId={time.team.id}
                          meuUserId={time.members.find((m) => m.isMe)?.userId ?? ""} meuPapel={time.role}
                          podeCriar={time.role === "admin" || time.role === "coach"}
                          prefillPlayerId={prefillEventoPlayerId}
                          onPrefillConsumido={() => setPrefillEventoPlayerId(null)}
                          onChange={carregar} onErro={setErro} />
                    )}
                    {aba === "maos" && podeEditarTime && (
                      <Moldura>
                        <TabMaosRecebidas />
                      </Moldura>
                    )}
                    {aba === "gestao" && time && (
                      // Um bloco por assunto, sem repetir capa nem equipe
                      // (antes Perfil + Configurações mostravam as duas
                      // coisas duas vezes). Zona de perigo só pro dono.
                      // grid-cols-1 = coluna minmax(0,1fr): sem isso, no
                      // celular a coluna crescia até o texto mais comprido
                      // e tudo ficava cortado na borda direita.
                      <div className="grid grid-cols-1 gap-3.5">
                        {info && (
                          <Moldura id="gestao-perfil" titulo="Perfil do time" icone={<IdCard size={15} />}>
                            <PerfilDoTime
                              info={info}
                              podeEditar={podeEditarTime}
                              enviandoBanner={enviandoBanner}
                              onUploadBanner={() => bannerRef.current?.click()}
                              onRemoveBanner={removerBanner}
                              onChange={carregar}
                              onErro={setErro}
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
                          </Moldura>
                        )}
                        {info && (
                          <Moldura id="gestao-equipe" titulo="Equipe técnica" icone={<ShieldCheck size={15} />}>
                            <EquipeTecnica info={info} staff={staff} jogadores={jogadores} />
                          </Moldura>
                        )}
                        {info && (
                          <Moldura id="gestao-etiquetas" titulo="Etiquetas" icone={<Tag size={15} />}>
                            <EtiquetasTime info={info} labels={labels} podeEditar={podeEditarTime} onChange={carregar} onErro={setErro} />
                          </Moldura>
                        )}
                        <Moldura id="gestao-convites" titulo="Convites e pedidos" icone={<Mail size={15} />}>
                          <TabConvites pendentes={pendentes} invites={invites} isAdmin={Boolean(isAdmin)} meuPapel={time.role}
                            onChange={carregar} onErro={setErro} />
                        </Moldura>
                        {info && info.ownerId === time.members.find((m) => m.isMe)?.userId && (
                          <Moldura id="gestao-perigo" titulo="Zona de perigo" icone={<AlertTriangle size={15} className="text-negative" />}>
                            <ExcluirTime info={info} onExcluido={() => router.replace("/time")} />
                          </Moldura>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
          </main>
        </MotionConfig>
      </PainelVisual>

      <TeamPrintStyles />
    </AppShell>
  );
}

// Caixa de vidro pras abas que ainda têm conteúdo "solto" (listas,
// calendário, formulários): o fundo e a borda seguem o visual novo sem
// mexer no miolo de cada aba. Com título, vira seção da aba Gestão.
function Moldura({ children, id, titulo, icone }: { children: React.ReactNode; id?: string; titulo?: string; icone?: React.ReactNode }) {
  return (
    <section id={id} className="painel-vidro min-w-0 scroll-mt-24 rounded-3xl border border-white/10 p-4 sm:p-5">
      {titulo && (
        <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-muted">{icone}</span>
          {titulo}
        </h2>
      )}
      {children}
    </section>
  );
}
