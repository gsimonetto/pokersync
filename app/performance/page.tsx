"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  LineChart,
  ShieldAlert,
  Flame,
  BookOpen,
  Target,
  Award,
  Wallet,
  Clock,
  Hash,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import { TabNav } from "@/components/ui/tab-nav";
import {
  fetchPlayerPerformance,
  fetchPlayerTimeline,
  fetchSkillBreakdown,
  fetchPeriodComparison,
  fetchPlayerInsights,
  nivelDoScore,
  type PlayerPerformance,
  type TimelineEvent,
  type SkillArea,
  type PeriodComparisonRow,
} from "@/lib/services/performance-service";
import { fetchPlayerCards, STAT_METRIC_LABEL, type PlayerCard } from "@/lib/services/team-funnel-service";

// ------------------------------------------------------------
// Formatadores locais — a tela e' so leitura, nao reusa o form de banca.
// Todos devolvem null (nao "—") quando nao ha dado: quem decide como
// mostrar a ausencia e' o componente, nao o formatador.
function fmtMoney(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtSignedMoney(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = fmtMoney(Math.abs(Number(v)))!;
  return Number(v) < 0 ? `-${s}` : `+${s}`;
}

function fmtPct(v: number | null | undefined, digits = 1): string | null {
  if (v === null || v === undefined) return null;
  return `${Number(v).toFixed(digits)}%`;
}

function fmtNum(v: number | null | undefined, suffix = ""): string | null {
  if (v === null || v === undefined) return null;
  return `${Number(v).toLocaleString("pt-BR")}${suffix}`;
}

// "analise" nunca é setada via onChange (é uma opção href, ver TabNav) —
// só existe na união pra não precisar de cast na lista de abas abaixo.
type TabKey = "financeiro" | "estudo" | "evolucao" | "analise";

// "Análise avançada" entra como última aba (href, ver TabNav) em vez de
// botão separado — as métricas de jogo (VPIP/PFR/posição/matchups) que
// viviam na aba "Jogo" agora só existem lá, sem duplicar as duas telas.
const TABS: { value: TabKey; label: string; icon: typeof Wallet; href?: string }[] = [
  { value: "financeiro", label: "Financeiro", icon: Wallet },
  { value: "estudo", label: "Estudo", icon: BookOpen },
  { value: "evolucao", label: "Evolução", icon: TrendingUp },
  { value: "analise", label: "Análise avançada", icon: LineChart, href: "/performance/analise" },
];

export default function PerformancePage() {
  const [data, setData] = useState<PlayerPerformance | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [skills, setSkills] = useState<SkillArea[]>([]);
  const [periods, setPeriods] = useState<PeriodComparisonRow[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [metaCoach, setMetaCoach] = useState<PlayerCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tab, setTab] = useState<TabKey>("financeiro");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, tl, sk, pc, ins, cards] = await Promise.all([
          fetchPlayerPerformance(),
          fetchPlayerTimeline(),
          fetchSkillBreakdown(),
          fetchPeriodComparison(),
          fetchPlayerInsights(),
          // So' quem tem time atribui essa meta -- sem time, a RPC volta
          // vazia (nao e' erro), entao o card "Meta do coach" so' aparece
          // pra quem de fato tem um coach acompanhando.
          fetchPlayerCards().catch(() => []),
        ]);
        if (alive) {
          setData(d);
          setTimeline(tl);
          setSkills(sk);
          setPeriods(pc);
          setInsights(ins);
          setMetaCoach(cards[0] ?? null);
        }
      } catch (e) {
        if (alive) setErro(e instanceof Error ? e.message : "Falha ao carregar sua performance.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Leitura em uma frase — a primeira coisa que o jogador le, antes de
  // qualquer numero. Traduz o dado em "o que isso significa pra mim".
  const veredito = useMemo(() => {
    if (!data) return null;
    const roi = data.roi_pct === null ? null : Number(data.roi_pct);
    const n = data.num_sessoes ?? 0;
    if (n < 10)
      return {
        tom: "neutro" as const,
        texto: `Amostra pequena (${n} ${n === 1 ? "sessão" : "sessões"}) — os números ainda oscilam muito.`,
      };
    if (roi === null) return { tom: "neutro" as const, texto: "Registre buy-ins e cashouts para calcular seu ROI." };
    if (roi >= 15)
      return { tom: "bom" as const, texto: "ROI acima de 15% no acumulado — ritmo consistente para pensar em subir de ABI com controle." };
    if (roi >= 0)
      return { tom: "bom" as const, texto: "Você está no positivo, com margem estreita. Volume e disciplina de stake pesam mais que ajustes finos agora." };
    return { tom: "ruim" as const, texto: "ROI negativo no acumulado. Priorize revisão de mãos e segure o ABI até estabilizar." };
  }, [data]);

  if (loading) {
    return (
      <AppShell>
        <main className="w-full px-6 py-10">
          <p className="text-sm text-muted">Carregando sua performance…</p>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <main className="w-full px-6 py-10 text-ink">
      {erro && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
      )}

      {!erro && !data && (
        <section className="max-w-xl rounded-xl border border-hairline bg-surface p-6">
          <h2 className="text-base font-semibold">Ainda sem dados suficientes</h2>
          <p className="mt-1 text-sm text-muted">
            Registre sessões na Gestão de Banca e revise mãos no Revisor — sua performance aparece aqui automaticamente.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/banca"
              className="rounded-lg bg-ink px-3.5 py-2 text-xs font-semibold text-void transition-transform hover:scale-[1.02]"
            >
              Registrar sessão
            </Link>
            <Link
              href="/revisor"
              className="rounded-lg border border-hairline bg-elevated px-3.5 py-2 text-xs font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink"
            >
              Revisar mãos
            </Link>
            <Link
              href="/performance/analise"
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-elevated px-3.5 py-2 text-xs font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink"
            >
              <LineChart size={13} />
              Análise avançada
            </Link>
          </div>
        </section>
      )}

      {data && (
        <>
          {/* Barra superior: abas fazem o papel de filtro deste módulo
              (mesmo padrão do resto do produto — filtros/navegação no
              topo). "Análise avançada" é a última aba da lista (ver
              TABS/TabNav), não um botão separado; só o Score Geral fica
              fora da lista de abas, à direita. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabNav value={tab} onChange={setTab} options={TABS} className="min-w-0 flex-1" />
            <div className="flex shrink-0 items-center gap-3">
              {data.score_geral !== null && data.score_geral !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs font-medium text-muted sm:inline">{nivelDoScore(Number(data.score_geral))}</span>
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 text-center"
                    style={{
                      borderColor:
                        Number(data.score_geral) >= 70 ? "#2FB89A" : Number(data.score_geral) >= 45 ? "#E0B24C" : "#e0555a",
                    }}
                    title="Score Geral de Evolução"
                  >
                    <div>
                      <p className="text-sm font-bold leading-none tabular-nums">{Math.round(Number(data.score_geral))}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {tab === "financeiro" && (
              <>
                {/* ----------------------------------------------------
                    Faixa herói: os 3 números que o grinder olha primeiro.
                    Peso visual desproporcional de propósito. Só aparece na
                    aba Financeiro agora — antes ficava fixa em toda aba,
                    competindo com o conteúdo das outras.
                   ---------------------------------------------------- */}
                <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface">
                  {/* Halo de acento atras do KPI principal — da profundidade e
                      ancora o olho no canto superior esquerdo, onde a leitura
                      comeca. Cor segue o sinal do ROI. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-24 -top-24 size-64 rounded-full opacity-[0.13] blur-3xl"
                    style={{
                      background:
                        data.roi_pct === null ? "#5AA6E0" : Number(data.roi_pct) >= 0 ? "#2FB89A" : "#e0555a",
                    }}
                  />

                  <div className="relative grid grid-cols-1 divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    <HeroMetric
                      label="ROI acumulado"
                      value={fmtPct(data.roi_pct, 2)}
                      tone={data.roi_pct === null ? "neutro" : Number(data.roi_pct) >= 0 ? "bom" : "ruim"}
                      hint={data.total_investido !== null ? `sobre ${fmtMoney(data.total_investido)} investidos` : undefined}
                      destaque
                    />
                    <HeroMetric
                      label="Resultado"
                      value={fmtSignedMoney(data.lucro_acumulado)}
                      tone={data.lucro_acumulado === null ? "neutro" : Number(data.lucro_acumulado) >= 0 ? "bom" : "ruim"}
                      hint={data.dolar_hora !== null ? `${fmtMoney(data.dolar_hora)} por hora` : "sem horas registradas"}
                    />
                    <HeroMetric
                      label="Volume"
                      value={fmtNum(data.num_sessoes)}
                      tone="neutro"
                      hint={
                        data.frequencia_semanal_sessoes !== null
                          ? `${data.frequencia_semanal_sessoes} sessões por semana`
                          : "sessões registradas"
                      }
                    />
                  </div>

                  {/* Veredito como faixa propria, nao como paragrafo solto: barra
                      de acento a esquerda + fundo levemente tingido dao a ele o
                      peso de "conclusao", nao de legenda. */}
                  {veredito && (
                    <div
                      className={`relative flex items-start gap-3 border-t border-hairline px-6 py-4 ${
                        veredito.tom === "bom"
                          ? "bg-positive/[0.06]"
                          : veredito.tom === "ruim"
                            ? "bg-negative/[0.06]"
                            : "bg-elevated/40"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-0 w-[3px] ${
                          veredito.tom === "bom" ? "bg-positive" : veredito.tom === "ruim" ? "bg-negative" : "bg-muted/40"
                        }`}
                      />
                      <Sparkles
                        size={14}
                        className={`mt-0.5 shrink-0 ${
                          veredito.tom === "bom" ? "text-positive" : veredito.tom === "ruim" ? "text-negative" : "text-muted"
                        }`}
                      />
                      <p className="text-[13px] leading-relaxed text-ink/80">{veredito.texto}</p>
                    </div>
                  )}
                </section>
                <AbaFinanceiro data={data} />
              </>
            )}
            {tab === "estudo" && <AbaEstudo data={data} metaCoach={metaCoach} />}
            {tab === "evolucao" && (
              <AbaEvolucao data={data} timeline={timeline} skills={skills} periods={periods} insights={insights} />
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted">
            Atualizado automaticamente a cada 15 min · última leitura{" "}
            {new Date(data.updated_at).toLocaleString("pt-BR")}
          </p>
        </>
      )}
    </main>
    </AppShell>
  );
}

// ============================================================
// Abas
// ============================================================
function AbaFinanceiro({ data }: { data: PlayerPerformance }) {
  const dd = data.downswing_atual;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Painel titulo="Resultado" icone={<Wallet size={14} className="text-training" />}>
        <Linha
          label="Maior sessão positiva"
          valor={fmtSignedMoney(data.maior_sessao_positiva)}
          tom="bom"
          icone={<TrendingUp size={13} />}
        />
        <Linha
          label="Maior sessão negativa"
          valor={fmtSignedMoney(data.maior_sessao_negativa)}
          tom="ruim"
          icone={<TrendingDown size={13} />}
        />
        <Linha label="Total investido" valor={fmtMoney(data.total_investido)} />
        <Linha label="ABI (torneios)" valor={fmtMoney(data.abi_torneio)} />
        <Linha
          label="ITM aproximado"
          valor={fmtPct(data.itm_pct_aproximado)}
          nota="Conta todo torneio com cashout acima de zero — o ITM exato chega com o agente desktop."
        />
      </Painel>

      <Painel titulo="Risco e volume" icone={<ShieldAlert size={14} className="text-negative" />}>
        <div className="rounded-lg border border-hairline bg-elevated p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Downswing atual</p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${Number(dd) > 0 ? "text-negative" : "text-positive"}`}>
            {fmtMoney(dd) ?? "—"}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {Number(dd) > 0
              ? "Distância entre o seu pico histórico e o saldo de hoje."
              : "Você está no topo da sua curva — sem downswing aberto."}
          </p>
        </div>
        <Linha label="Sessões" valor={fmtNum(data.num_sessoes)} icone={<Hash size={13} />} />
        <Linha
          label="Horas jogadas"
          valor={fmtNum(data.horas_jogadas, "h")}
          icone={<Clock size={13} />}
          vazio={{ texto: "Preencha a duração ao registrar a sessão", href: "/banca", cta: "Registrar" }}
        />
        <Linha label="Torneios / Cash" valor={`${data.num_torneios ?? 0} / ${data.num_cash ?? 0}`} />
      </Painel>
    </div>
  );
}

function AbaEstudo({ data, metaCoach }: { data: PlayerPerformance; metaCoach: PlayerCard | null }) {
  const leaks = data.top_leaks ?? [];
  const maxLeak = leaks.length ? Math.max(...leaks.map((l) => l.ocorrencias)) : 1;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {metaCoach && <MetaDoCoach card={metaCoach} />}

      <Painel titulo="Consistência" icone={<Flame size={14} className="text-evolution" />}>
        <div className="grid grid-cols-2 gap-3">
          <MiniCard label="Streak atual" valor={fmtNum(data.streak_atual) ?? "0"} accent="#E0B24C" icone={<Flame size={12} />} />
          <MiniCard label="Recorde" valor={fmtNum(data.streak_best) ?? "0"} accent="#E0B24C" icone={<Award size={12} />} />
        </div>
        <Linha label="XP total" valor={fmtNum(data.xp_total)} />
        <Linha label="Mãos revisadas" valor={fmtNum(data.maos_revisadas)} icone={<BookOpen size={13} />} />
        <Linha
          label="Drills treinados"
          valor={fmtNum(data.num_drills)}
          vazio={{ texto: "Nenhum drill registrado ainda", href: "/treino", cta: "Treinar" }}
        />
        <Linha
          label="Acerto no Treino"
          valor={fmtPct(data.taxa_acerto_treino_pct)}
          vazio={{ texto: "Sem drills para medir", href: "/treino", cta: "Treinar" }}
        />
      </Painel>

      <Painel titulo="Leaks recorrentes" icone={<Target size={14} className="text-review" />}>
        {leaks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-hairline p-4">
            <p className="text-sm leading-relaxed text-muted">
              Nenhum leak mapeado ainda. Marque <strong className="text-ink/85">Errei</strong> com o motivo na
              auto-avaliação por rua do Revisor — é isso que alimenta esta lista.
            </p>
            <Link
              href="/revisor"
              className="mt-3 inline-block rounded-lg border border-hairline bg-elevated px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-ink/40 hover:text-ink"
            >
              Abrir Revisor
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {leaks.map((l) => (
              <div key={l.code}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate text-sm font-medium">{l.label ?? l.code}</p>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-review">{l.ocorrencias}x</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void/40">
                  <div
                    className="h-full rounded-full bg-review transition-[width] duration-500 ease-out"
                    style={{ width: `${(l.ocorrencias / maxLeak) * 100}%` }}
                  />
                </div>
                {l.category && <p className="mt-1 text-[11px] capitalize text-muted">{l.category}</p>}
              </div>
            ))}
          </div>
        )}
      </Painel>
    </div>
  );
}

// Meta atribuida pelo coach no Funil (Time > Painel > Estatísticas >
// Jogadores) -- mesmos numeros (drillsDone/reviewsDone/statValue) que
// aparecem no card do Kanban pro coach, so' que do lado do jogador.
// Nao e' um snapshot: cada vez que o jogador treina ou revisa uma mao,
// o proximo carregamento desta tela (e do card no Funil) reflete o
// progresso novo, porque os dois leem a mesma RPC (team_funnel_cards)
// em cima das mesmas tabelas -- nada fica dessincronizado entre as
// duas telas.
function MetaDoCoach({ card }: { card: PlayerCard }) {
  return (
    <Painel titulo="Meta do coach" icone={<Target size={14} className="text-training" />}>
      <p className="-mt-1 text-xs text-muted">
        Fase atual: <span className="font-medium text-ink/85">{card.phaseName}</span>
      </p>

      <BarraMeta
        label="Drills treinados"
        done={card.drillsDone}
        target={card.drillsTarget}
        cor="var(--color-training)"
        cta={{ texto: "Treinar", href: "/treino" }}
      />
      <BarraMeta
        label="Mãos revisadas"
        done={card.reviewsDone}
        target={card.reviewsTarget}
        cor="var(--color-review)"
        cta={{ texto: "Revisar", href: "/revisor" }}
      />

      {card.statMetric && (
        <div className="flex items-center justify-between border-t border-hairline pt-2.5 text-sm">
          <span className="text-muted">{STAT_METRIC_LABEL[card.statMetric]} atual</span>
          <span className="font-semibold tnum">
            {card.statValue ?? "—"}%{card.statTarget != null && <span className="text-muted"> · meta {card.statTarget}%</span>}
          </span>
        </div>
      )}
    </Painel>
  );
}

function BarraMeta({
  label,
  done,
  target,
  cor,
  cta,
}: {
  label: string;
  done: number;
  target: number;
  cor: string;
  cta: { texto: string; href: string };
}) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 100;
  const completo = target > 0 && done >= target;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <span className="shrink-0 text-xs font-bold tabular-nums text-ink/85">
          {done}/{target}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void/40">
        <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: cor }} />
      </div>
      {!completo && (
        <Link href={cta.href} className="mt-1.5 inline-block text-[11px] font-semibold text-muted hover:text-ink">
          {cta.texto} →
        </Link>
      )}
    </div>
  );
}

// Rotulo + cor por componente do score — usado tanto na barra quanto na
// legenda, pra nao duplicar a lista em dois lugares.
const SCORE_COMPONENTS: { key: keyof PlayerPerformance; label: string }[] = [
  { key: "score_tecnica", label: "Técnica" },
  { key: "score_conhecimento", label: "Conhecimento" },
  { key: "score_disciplina", label: "Disciplina" },
  { key: "score_performance", label: "Performance" },
  { key: "score_consistencia", label: "Consistência" },
];

function corDoScore(v: number) {
  return v >= 70 ? "#2FB89A" : v >= 45 ? "#E0B24C" : "#e0555a";
}

function AbaEvolucao({
  data,
  timeline,
  skills,
  periods,
  insights,
}: {
  data: PlayerPerformance;
  timeline: TimelineEvent[];
  skills: SkillArea[];
  periods: PeriodComparisonRow[];
  insights: string[];
}) {
  return (
    <div className="space-y-4">
      {insights.length > 0 && (
        <Painel titulo="Insights" icone={<Sparkles size={14} className="text-evolution" />}>
          <p className="text-xs leading-relaxed text-muted">
            Gerado por regra simples comparando a primeira metade do seu histórico com a mais recente — sem IA.
          </p>
          <ul className="mt-2 space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="text-evolution">•</span>
                {ins}
              </li>
            ))}
          </ul>
        </Painel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Painel titulo="Score Geral de Evolução" icone={<Sparkles size={14} className="text-evolution" />}>
          <p className="text-xs leading-relaxed text-muted">
            Combina 5 frentes numa nota só. Componente sem dado suficiente entra neutro (50) — não puxa a nota pra
            baixo nem pra cima.
          </p>
          <div className="space-y-3 pt-1">
            {SCORE_COMPONENTS.map((c) => {
              const raw = data[c.key];
              const v = raw === null || raw === undefined ? 50 : Number(raw);
              return (
                <div key={c.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] text-muted">{c.label}</p>
                    <span className="text-xs font-bold tabular-nums" style={{ color: corDoScore(v) }}>
                      {Math.round(v)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void/40">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{ width: `${v}%`, backgroundColor: corDoScore(v) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Painel>

        <Painel titulo="Timeline" icone={<Award size={14} className="text-evolution" />}>
          {timeline.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted">
              Ainda sem marcos registrados. Eles aparecem conforme você joga sessões, revisa mãos e treina drills.
            </p>
          ) : (
            <div className="space-y-3">
              {timeline
                .slice()
                .sort((a, b) => (a.event_date < b.event_date ? -1 : 1))
                .map((ev, i) => (
                  <div key={`${ev.event_type}-${i}`} className="flex gap-3 border-b border-hairline pb-3 last:border-b-0 last:pb-0">
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-evolution" />
                    <div>
                      <p className="text-sm font-medium text-ink">{ev.title}</p>
                      {ev.detail && <p className="text-[11px] text-muted">{ev.detail}</p>}
                      <p className="mt-0.5 text-[11px] text-muted/70">
                        {new Date(ev.event_date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Painel>

        <Painel titulo="Evolução por habilidade" icone={<Target size={14} className="text-training" />}>
          <p className="text-xs leading-relaxed text-muted">
            Precisão da sua auto-avaliação no Revisor (acertei/errei), por área. ICM ficou de fora — ainda sem dado de
            bolha/ICM (depende do agente desktop, que não existe ainda).
          </p>
          <div className="space-y-3 pt-1">
            {skills.map((s) => (
              <div key={s.area}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] text-muted">{s.area}</p>
                  <span className="text-xs font-bold tabular-nums">
                    {s.accuracy_pct !== null ? `${s.accuracy_pct}%` : "—"}{" "}
                    <span className="font-normal text-muted/70">({s.sample_count})</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-void/40">
                  <div
                    className="h-full rounded-full bg-training transition-[width] duration-500 ease-out"
                    style={{ width: `${s.accuracy_pct ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Painel>

        <Painel titulo="Comparação entre períodos" icone={<LineChart size={14} className="text-evolution" />}>
          <p className="text-xs leading-relaxed text-muted">
            Primeira metade do seu histórico de sessões vs. a mais recente.
          </p>
          {periods.length === 0 ? (
            <p className="mt-2 text-xs text-muted/70">Precisa de mais sessões registradas pra comparar períodos.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {periods.map((p) => (
                <div key={p.metric} className="flex items-center justify-between border-b border-hairline pb-2 text-sm last:border-b-0">
                  <span className="text-muted">{p.metric}</span>
                  <span className="tabular-nums">
                    {p.period_early !== null ? `${p.period_early}${p.unit}` : "—"}
                    <span className="mx-1.5 text-muted/50">→</span>
                    <strong className="text-ink">{p.period_recent !== null ? `${p.period_recent}${p.unit}` : "—"}</strong>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Painel>
      </div>
    </div>
  );
}

// ============================================================
// Componentes de apoio
// ============================================================
function HeroMetric({
  label,
  value,
  hint,
  tone,
  destaque = false,
}: {
  label: string;
  value: string | null;
  hint?: string;
  tone: "bom" | "ruim" | "neutro";
  destaque?: boolean;
}) {
  const cor = tone === "bom" ? "text-positive" : tone === "ruim" ? "text-negative" : "text-ink";
  return (
    <div className="px-6 py-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">{label}</p>
      <p
        className={`mt-2 font-bold leading-none tracking-tight tabular-nums ${
          destaque ? "text-[2.75rem]" : "text-[2.25rem]"
        } ${value ? cor : "text-muted/30"}`}
      >
        {value ?? "—"}
      </p>
      {hint && <p className="mt-2.5 text-[11.5px] text-muted">{hint}</p>}
    </div>
  );
}

function Painel({ titulo, icone, children }: { titulo: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <div className="mb-3 flex items-center gap-1.5">
        {icone}
        <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{titulo}</h2>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

// Linha densa label/valor — substitui o card por métrica. Métrica sem
// dado não some: fica esmaecida com um caminho pra preencher, em vez de
// um traço mudo ocupando espaço nobre.
function Linha({
  label,
  valor,
  nota,
  tom,
  icone,
  vazio,
}: {
  label: string;
  valor: string | null;
  nota?: string;
  tom?: "bom" | "ruim";
  icone?: React.ReactNode;
  vazio?: { texto: string; href: string; cta: string };
}) {
  const cor = tom === "bom" ? "text-positive" : tom === "ruim" ? "text-negative" : "text-ink";
  return (
    <div className="border-b border-hairline pb-2.5 last:border-b-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] text-muted">
          {icone}
          {label}
        </p>
        {valor ? (
          <span className={`shrink-0 text-sm font-semibold tabular-nums ${cor}`}>{valor}</span>
        ) : vazio ? (
          <Link
            href={vazio.href}
            className="shrink-0 text-xs font-semibold text-training transition-opacity hover:opacity-75"
          >
            {vazio.cta} →
          </Link>
        ) : (
          <span className="shrink-0 text-sm text-muted/40">—</span>
        )}
      </div>
      {!valor && vazio && <p className="mt-0.5 text-[11px] text-muted/70">{vazio.texto}</p>}
      {valor && nota && <p className="mt-0.5 text-[11px] text-muted/70">{nota}</p>}
    </div>
  );
}

function MiniCard({
  label,
  valor,
  accent,
  icone,
}: {
  label: string;
  valor: string;
  accent: string;
  icone: React.ReactNode;
}) {
  return (
    <div
      style={{ "--acc": accent } as React.CSSProperties}
      className="acc-card relative overflow-hidden rounded-lg border border-hairline bg-elevated p-3"
    >
      <div aria-hidden="true" className="acc-glow pointer-events-none absolute -right-5 -top-5 size-16 rounded-full blur-2xl" />
      <p className="relative flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
        {icone}
        {label}
      </p>
      <p className="relative mt-0.5 text-xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}
