"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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
} from "lucide-react";
import { fetchPlayerPerformance, type PlayerPerformance } from "@/lib/services/performance-service";

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

type TabKey = "financeiro" | "jogo" | "estudo";

const TABS: { key: TabKey; label: string }[] = [
  { key: "financeiro", label: "Financeiro" },
  { key: "jogo", label: "Jogo" },
  { key: "estudo", label: "Estudo" },
];

export default function PerformancePage() {
  const [data, setData] = useState<PlayerPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tab, setTab] = useState<TabKey>("financeiro");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchPlayerPerformance();
        if (alive) setData(d);
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
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-muted">Carregando sua performance…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/modulos"
          aria-label="Voltar"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
        >
          <ArrowLeft size={18} />
        </Link>
        <LineChart size={20} className="text-evolution" />
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight">Player Evolution</h1>
          <p className="mt-0.5 text-sm text-muted">Banca, jogo e estudo em um só lugar</p>
        </div>
      </header>

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
          <section className="rounded-xl border border-hairline bg-surface p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <HeroMetric
                label="ROI acumulado"
                value={fmtPct(data.roi_pct, 2)}
                tone={data.roi_pct === null ? "neutro" : Number(data.roi_pct) >= 0 ? "bom" : "ruim"}
                hint={data.total_investido !== null ? `sobre ${fmtMoney(data.total_investido)} investidos` : undefined}
              />
              <HeroMetric
                label="Resultado"
                value={fmtSignedMoney(data.lucro_acumulado)}
                tone={data.lucro_acumulado === null ? "neutro" : Number(data.lucro_acumulado) >= 0 ? "bom" : "ruim"}
                hint={data.dolar_hora !== null ? `${fmtMoney(data.dolar_hora)}/hora` : "sem horas registradas"}
              />
              <HeroMetric
                label="Volume"
                value={fmtNum(data.num_sessoes)}
                tone="neutro"
                hint={
                  data.frequencia_semanal_sessoes !== null
                    ? `${data.frequencia_semanal_sessoes} sessões/semana`
                    : "sessões registradas"
                }
              />
            </div>

            {veredito && (
              <p
                className={`mt-5 border-t border-hairline pt-4 text-[13px] leading-relaxed ${
                  veredito.tom === "bom" ? "text-positive" : veredito.tom === "ruim" ? "text-negative" : "text-muted"
                }`}
              >
                {veredito.texto}
              </p>
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
            {tab === "jogo" && <AbaJogo data={data} />}
            {tab === "estudo" && <AbaEstudo data={data} />}
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

function AbaJogo({ data }: { data: PlayerPerformance }) {
  const amostra = data.maos_com_dados_frequencia ?? 0;
  return (
    <div className="space-y-4">
      <Painel titulo="Frequências pré-flop" icone={<Target size={14} className="text-training" />}>
        <p className="text-xs leading-relaxed text-muted">
          Calculado sobre <strong className="text-ink/85">{amostra}</strong> {amostra === 1 ? "mão" : "mãos"} com hand
          history estruturada. A faixa clara na barra é apenas uma referência comum de MTT — não é um veredito sobre o
          seu jogo.
        </p>
        <Frequencia label="VPIP" valor={data.vpip_pct} referencia={REF.vpip} />
        <Frequencia label="PFR" valor={data.pfr_pct} referencia={REF.pfr} />
        <Frequencia label="3-Bet" valor={data.three_bet_pct} referencia={REF.threeBet} />
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

// ============================================================
// Componentes de apoio
// ============================================================
function HeroMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | null;
  hint?: string;
  tone: "bom" | "ruim" | "neutro";
}) {
  const cor = tone === "bom" ? "text-positive" : tone === "ruim" ? "text-negative" : "text-ink";
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`mt-1.5 text-4xl font-bold leading-none tabular-nums ${value ? cor : "text-muted/40"}`}>
        {value ?? "—"}
      </p>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
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
  const pos = v === null ? 0 : Math.min((v / referencia.escala) * 100, 100);
  const refLeft = (referencia.min / referencia.escala) * 100;
  const refWidth = ((referencia.max - referencia.min) / referencia.escala) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">{label}</p>
        <span className={`text-sm font-semibold tabular-nums ${v === null ? "text-muted/40" : "text-ink"}`}>
          {v === null ? "—" : `${v.toFixed(1)}%`}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-void/40">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 bg-ink/10"
          style={{ left: `${refLeft}%`, width: `${refWidth}%` }}
        />
        {v !== null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-training/70 transition-[width] duration-500 ease-out"
            style={{ width: `${pos}%` }}
          />
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted/70">
        referência comum: {referencia.min}–{referencia.max}%
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
