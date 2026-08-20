"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  LineChart,
  Lock,
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
import {
  fetchPlayerPerformance,
  fetchPositionStats,
  fetchPlayerTimeline,
  fetchMatchupStats,
  fetchIpOopSplit,
  fetchSkillBreakdown,
  fetchPeriodComparison,
  fetchPlayerInsights,
  nivelDoScore,
  computePositionHighlights,
  fetchPreflopSituations,
  type PlayerPerformance,
  type PositionStat,
  type TimelineEvent,
  type MatchupStat,
  type IpOopSplit,
  type SkillArea,
  type PeriodComparisonRow,
  type PreflopSituation,
} from "@/lib/services/performance-service";

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

type TabKey = "financeiro" | "jogo" | "estudo" | "evolucao";

const TABS: { key: TabKey; label: string }[] = [
  { key: "financeiro", label: "Financeiro" },
  { key: "jogo", label: "Jogo" },
  { key: "estudo", label: "Estudo" },
  { key: "evolucao", label: "Evolução" },
];

export default function PerformancePage() {
  const [data, setData] = useState<PlayerPerformance | null>(null);
  const [posStats, setPosStats] = useState<PositionStat[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [matchupStats, setMatchupStats] = useState<MatchupStat[]>([]);
  const [ipOop, setIpOop] = useState<IpOopSplit | null>(null);
  const [skills, setSkills] = useState<SkillArea[]>([]);
  const [periods, setPeriods] = useState<PeriodComparisonRow[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [preflopSit, setPreflopSit] = useState<PreflopSituation[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tab, setTab] = useState<TabKey>("financeiro");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, ps, tl, ms, io, sk, pc, ins, pfs] = await Promise.all([
          fetchPlayerPerformance(),
          fetchPositionStats(),
          fetchPlayerTimeline(),
          fetchMatchupStats(),
          fetchIpOopSplit(),
          fetchSkillBreakdown(),
          fetchPeriodComparison(),
          fetchPlayerInsights(),
          fetchPreflopSituations(),
        ]);
        if (alive) {
          setData(d);
          setPosStats(ps);
          setTimeline(tl);
          setMatchupStats(ms);
          setIpOop(io);
          setSkills(sk);
          setPeriods(pc);
          setInsights(ins);
          setPreflopSit(pfs);
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
      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <p className="text-sm text-muted">Carregando sua performance…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-10 text-ink">
      <AppHeader
        backHref="/modulos"
        icon={LineChart}
        iconColor="var(--color-evolution)"
        title="Player Evolution"
        subtitle="Banca, jogo e estudo em um só lugar"
        right={
          data?.score_geral !== null && data?.score_geral !== undefined ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-medium text-muted sm:inline">{nivelDoScore(Number(data.score_geral))}</span>
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 text-center"
                style={{
                  borderColor:
                    Number(data.score_geral) >= 70 ? "#2FB89A" : Number(data.score_geral) >= 45 ? "#E0B24C" : "#e0555a",
                }}
                title="Score Geral de Evolução"
              >
                <div>
                  <p className="text-base font-bold leading-none tabular-nums">{Math.round(Number(data.score_geral))}</p>
                  <p className="mt-0.5 text-[8px] uppercase tracking-wide text-muted">/100</p>
                </div>
              </div>
            </div>
          ) : undefined
        }
      />

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
          </div>
        </section>
      )}

      {data && (
        <>
          {/* ----------------------------------------------------------
              Faixa herói: os 3 números que o grinder olha primeiro. Peso
              visual desproporcional de propósito — o resto da tela é
              contexto, isto aqui é o placar.
             ---------------------------------------------------------- */}
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

          {/* Abas — mesmo segmented control já usado no resto do produto. */}
          <div className="mt-6 flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                  tab === t.key ? "bg-ink text-void" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "financeiro" && <AbaFinanceiro data={data} />}
            {tab === "jogo" && (
              <AbaJogo data={data} posStats={posStats} matchupStats={matchupStats} ipOop={ipOop} preflopSit={preflopSit} />
            )}
            {tab === "estudo" && <AbaEstudo data={data} />}
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

// Referencias de MTT usadas so como CONTEXTO visual (faixa clara ao
// fundo da barra), nunca como veredito de certo/errado — VPIP/PFR
// "ideal" varia demais por stack, mesa e fase do torneio pra virar
// semaforo verde/vermelho.
const REF = {
  vpip: { min: 18, max: 28, escala: 60 },
  pfr: { min: 14, max: 22, escala: 60 },
  threeBet: { min: 5, max: 10, escala: 20 },
};

function AbaJogo({
  data,
  posStats,
  matchupStats,
  ipOop,
  preflopSit,
}: {
  data: PlayerPerformance;
  posStats: PositionStat[];
  matchupStats: MatchupStat[];
  ipOop: IpOopSplit | null;
  preflopSit: PreflopSituation[];
}) {
  const amostra = data.maos_com_dados_frequencia ?? 0;
  const ipTotal = (ipOop?.ip_hands ?? 0) + (ipOop?.oop_hands ?? 0);
  return (
    <div className="space-y-4">
      <Painel titulo="Situações pré-flop" icone={<Target size={14} className="text-training" />}>
        <p className="text-xs leading-relaxed text-muted">
          Steal, 3-bet/4-bet e defesa de blinds — direto da hand history, sem depender de solver. Re-steal e squeeze
          aparecem só como contagem: ainda não guardamos quantas vezes um oponente tentou roubar contra você, então uma
          % aqui seria inventada.
        </p>
        <div className="mt-2 divide-y divide-hairline">
          {preflopSit.map((s) => (
            <div key={s.label} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted">{s.label}</span>
              <span className="tabular-nums">
                {s.pct !== null ? <strong className="text-ink">{s.pct}%</strong> : <strong className="text-ink">{s.sample}</strong>}
                <span className="ml-1.5 text-[11px] text-muted/70">
                  {s.pct !== null ? `(${s.sample})` : "mãos"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </Painel>

      <Painel titulo="Frequências pré-flop" icone={<Target size={14} className="text-training" />}>
        <p className="text-xs leading-relaxed text-muted">
          Calculado sobre <strong className="text-ink/85">{amostra}</strong> {amostra === 1 ? "mão" : "mãos"} com hand
          history estruturada. A faixa marcada na régua é apenas uma referência comum de MTT — não é um veredito sobre o
          seu jogo.
        </p>
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
          <Frequencia label="VPIP" valor={data.vpip_pct} referencia={REF.vpip} />
          <Frequencia label="PFR" valor={data.pfr_pct} referencia={REF.pfr} />
          <Frequencia label="3-Bet" valor={data.three_bet_pct} referencia={REF.threeBet} />
        </div>
      </Painel>

      <Painel titulo="Por posição" icone={<Target size={14} className="text-evolution" />}>
        {posStats.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted">
            Ainda sem mãos suficientes com posição identificada para separar por posição.
          </p>
        ) : (
          <>
            {computePositionHighlights(posStats).length > 0 && (
              <ul className="mb-3 space-y-1">
                {computePositionHighlights(posStats).map((h, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink">
                    <span className="text-evolution">•</span>
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <div className="overflow-hidden rounded-lg border border-hairline">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-hairline bg-elevated text-[10px] uppercase tracking-[0.08em] text-muted">
                    <th className="px-3 py-2 text-left font-bold">Posição</th>
                    <th className="px-3 py-2 text-right font-bold">Mãos</th>
                    <th className="px-3 py-2 text-right font-bold">VPIP</th>
                    <th className="px-3 py-2 text-right font-bold">PFR</th>
                    <th className="px-3 py-2 text-right font-bold">3-Bet</th>
                  </tr>
                </thead>
                <tbody>
                  {posStats.map((p) => (
                    <tr key={p.position} className="border-b border-hairline last:border-b-0">
                      <td className="px-3 py-2 font-semibold text-ink">{p.position}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">{p.hands}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.vpip_pct) ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.pfr_pct) ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(p.three_bet_pct) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Painel>

      <Painel titulo="Dentro vs fora de posição" icone={<Target size={14} className="text-training" />}>
        <p className="text-xs leading-relaxed text-muted">
          Só conta mãos onde exatamente 2 jogadores chegaram ao flop (heads-up pot) — é o único caso em que IP/OOP tem
          um valor único e correto. Mãos com 3+ jogadores no flop não entram aqui.
        </p>
        {ipTotal === 0 ? (
          <p className="mt-2 text-xs text-muted/70">Sem mãos heads-up suficientes ainda.</p>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-void/40">
              <div className="h-full bg-positive" style={{ width: `${((ipOop?.ip_hands ?? 0) / ipTotal) * 100}%` }} />
              <div className="h-full bg-review" style={{ width: `${((ipOop?.oop_hands ?? 0) / ipTotal) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-positive">Em posição — {ipOop?.ip_hands ?? 0} mãos ({fmtPct(ipOop?.ip_pct) ?? "—"})</span>
              <span className="text-review">Fora de posição — {ipOop?.oop_hands ?? 0} mãos</span>
            </div>
          </div>
        )}
      </Painel>

      <Painel titulo="Matchups mais jogados" icone={<Target size={14} className="text-review" />}>
        {matchupStats.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted">
            Ainda sem matchups heads-up suficientes para listar.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-hairline">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-hairline bg-elevated text-[10px] uppercase tracking-[0.08em] text-muted">
                  <th className="px-3 py-2 text-left font-bold">Matchup</th>
                  <th className="px-3 py-2 text-right font-bold">Mãos</th>
                  <th className="px-3 py-2 text-right font-bold">VPIP</th>
                  <th className="px-3 py-2 text-right font-bold">PFR</th>
                </tr>
              </thead>
              <tbody>
                {matchupStats.map((m) => (
                  <tr key={m.matchup} className="border-b border-hairline last:border-b-0">
                    <td className="px-3 py-2 font-semibold text-ink">{m.matchup}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{m.hands}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(m.vpip_pct) ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(m.pfr_pct) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <Painel titulo="Precisão" icone={<Lock size={14} className="text-muted" />}>
        <Bloqueado
          titulo="bb/100"
          texto="Depende do stake numérico real de cada mão. Chega junto com o agente desktop, que lê o hand history direto da pasta da sala."
        />
        <Bloqueado
          titulo="ITM% real"
          texto="Exige ligar a colocação final do torneio ao buy-in da sessão. Também vem com o agente desktop."
        />
      </Painel>
    </div>
  );
}

function AbaEstudo({ data }: { data: PlayerPerformance }) {
  const leaks = data.top_leaks ?? [];
  const maxLeak = leaks.length ? Math.max(...leaks.map((l) => l.ocorrencias)) : 1;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

// Barra de frequência com faixa de referência ao fundo. O ponto não é
// dizer "certo/errado" — é dar escala: 31% de VPIP sozinho não significa
// nada pra quem não tem parâmetro na cabeça.
// Régua em vez de barra preenchida. A barra cheia competia visualmente
// com a faixa de referência (o pedaço cinza sobrando depois do
// preenchimento parecia defeito) e sugeria "quanto mais cheio, melhor" —
// leitura errada para VPIP/PFR, onde o que importa é ONDE você está, não
// o tamanho. O marcador resolve isso: a faixa é o contexto, o traço é
// você.
function Frequencia({
  label,
  valor,
  referencia,
}: {
  label: string;
  valor: number | null;
  referencia: { min: number; max: number; escala: number };
}) {
  const v = valor === null || valor === undefined ? null : Number(valor);
  const pos = v === null ? 0 : Math.min(Math.max((v / referencia.escala) * 100, 0), 100);
  const refLeft = (referencia.min / referencia.escala) * 100;
  const refWidth = ((referencia.max - referencia.min) / referencia.escala) * 100;

  const situacao =
    v === null ? null : v < referencia.min ? "abaixo" : v > referencia.max ? "acima" : "dentro";

  return (
    <div className="rounded-lg border border-hairline bg-elevated p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted/80">{label}</p>
      <p className={`mt-1 text-2xl font-bold leading-none tabular-nums ${v === null ? "text-muted/30" : "text-ink"}`}>
        {v === null ? "—" : `${v.toFixed(1)}%`}
      </p>

      <div className="relative mt-4 h-1 w-full rounded-full bg-void/60">
        {/* faixa de referência */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 rounded-full bg-ink/15"
          style={{ left: `${refLeft}%`, width: `${refWidth}%` }}
        />
        {/* marcador do jogador */}
        {v !== null && (
          <span
            className="absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-training shadow-[0_0_8px_rgba(90,166,224,.6)] transition-[left] duration-500 ease-out"
            style={{ left: `${pos}%` }}
          />
        )}
      </div>

      <p className="mt-2.5 text-[11px] text-muted/70">
        {situacao === "dentro" ? (
          <span className="text-muted">dentro da referência ({referencia.min}–{referencia.max}%)</span>
        ) : (
          <>
            {situacao === null ? "referência" : situacao} de {referencia.min}–{referencia.max}%
          </>
        )}
      </p>
    </div>
  );
}

function Bloqueado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-hairline p-3.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-void/40 text-muted">
        <Lock size={13} />
      </span>
      <div>
        <p className="text-sm font-medium text-muted">{titulo}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted/70">{texto}</p>
      </div>
    </div>
  );
}
