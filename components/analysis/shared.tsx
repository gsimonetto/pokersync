"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Lock, type LucideIcon } from "lucide-react";
import { REFERENCE_PROFILE_LABEL, type ReferenceProfile } from "@/types/analysis";

// Blocos reusados pelas 5 abas do módulo de Análise — mesmo "Painel"
// (rounded-xl border-hairline bg-surface) que app/performance/page.tsx já
// usa, centralizado aqui porque as 5 abas precisam dele em paralelo (uma
// única tela, não 5 telas isoladas reinventando o card cada uma). Entra
// com um fade + leve subida (framer-motion) em vez de aparecer estático,
// pra dar mais vida à troca de aba/sub-aba.
export function Painel({
  titulo,
  icone,
  action,
  children,
}: {
  titulo: string;
  icone?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-xl border border-hairline bg-surface p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icone}
          <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{titulo}</h2>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </motion.section>
  );
}

export function MetricCard({ label, value, sample, tone }: { label: string; value: string | null; sample?: number; tone?: Tone }) {
  const cor = tone ? TONE_TEXT_CLASS[tone] : "text-ink";
  return (
    <div className="rounded-lg border border-hairline bg-elevated p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted/80">{label}</p>
      <p className={`mt-1 text-xl font-bold leading-none tabular-nums ${value ? cor : "text-muted/30"}`}>{value ?? "—"}</p>
      {sample !== undefined && <p className="mt-1.5 text-[11px] text-muted/70">{sample} {sample === 1 ? "amostra" : "amostras"}</p>}
    </div>
  );
}

// Grade densa de métricas (rótulo + valor + amostra opcional) — usada nas
// Data Grids de Preflop/Postflop/Torneios em vez de tabela HTML, pra
// caber bem em telas estreitas e mobile sem scroll horizontal.
export function MetricGrid({ items }: { items: { label: string; value: string | null; sample?: number | null; locked?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((it) =>
        it.locked ? (
          <LockedMetric key={it.label} label={it.label} reason={it.locked} />
        ) : (
          <MetricCard key={it.label} label={it.label} value={it.value} sample={it.sample ?? undefined} />
        )
      )}
    </div>
  );
}

// Faixa de destaque — mesmo padrão da "Faixa herói" da Gestão de Banca
// (HeroMetric): número grande e em negrito, label pequeno em caixa alta
// acima, divisor fino entre blocos em vez de borda por métrica. Só pros
// 3-4 headliners de cada card (ex. VPIP/PFR/3-Bet%/Steal% no Preflop) —
// o resto continua na StatList abaixo, senão a tela vira uma parede de
// números grandes competindo entre si.
// `coaching` só existe quando a métrica saiu da faixa (ver chamadas em
// PreflopMatrix/PostflopStats) — card sem coaching fica só informativo
// (hover mostra a definição via `hint`); card com coaching vira clicável
// e expande o texto embaixo, no lugar de um painel de insights à parte
// duplicando a mesma informação.
type HeroStripItem = {
  label: string;
  value: string | null;
  tone?: Tone;
  trend?: number[];
  hint?: string;
  bar?: StatBar;
  coaching?: string;
};

export function HeroStrip({ items }: { items: HeroStripItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div
      className="grid grid-cols-2 divide-x divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-elevated sm:grid-cols-4 sm:divide-y-0"
      style={{ gridAutoRows: "1fr" }}
    >
      {items.map((it) => {
        const cor = it.tone ? TONE_TEXT_CLASS[it.tone] : "text-ink";
        const clickable = !!(it.coaching && it.value);
        const isOpen = clickable && open === it.label;
        return (
          <div
            key={it.label}
            className={`px-4 py-3.5 transition-colors ${clickable ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
            title={clickable ? undefined : it.hint}
            onClick={clickable ? () => setOpen(isOpen ? null : it.label) : undefined}
          >
            <div className="flex items-center gap-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted/80">{it.label}</p>
              {clickable && (
                <ChevronDown size={11} className={`text-muted/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              )}
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <p className={`text-2xl font-bold leading-none tracking-tight tabular-nums ${it.value ? cor : "text-muted/30"}`}>{it.value ?? "—"}</p>
              {it.trend && it.trend.length >= 2 && <Sparkline points={it.trend} tone={it.tone} />}
            </div>
            {it.bar && it.value && <ReferenceBar bar={it.bar} tone={it.tone} className="mt-2.5" />}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <p className="mt-2.5 border-t border-hairline pt-2.5 text-[11px] leading-relaxed text-ink/80">{it.coaching}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// Anel de "saúde" — média de quão perto cada headliner está da própria
// faixa de referência (100 = na faixa, cai proporcional à distância).
// Mesmos min/max já usados no toneFromRange/statBar de cada card, então
// nunca diverge do que os cards individuais já mostram.
function computeHealthScore(items: { value: number | null; min: number; max: number }[]): number | null {
  const valid = items.filter((i) => i.value !== null) as { value: number; min: number; max: number }[];
  if (valid.length === 0) return null;
  const scores = valid.map((i) => {
    if (i.value >= i.min && i.value <= i.max) return 100;
    const dist = i.value < i.min ? i.min - i.value : i.value - i.max;
    const span = i.max - i.min || 1;
    return Math.max(0, 100 - (dist / span) * 100);
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function HealthGauge({ items }: { items: { value: number | null; min: number; max: number }[] }) {
  const score = computeHealthScore(items);
  if (score === null) return null;
  const valid = items.filter((i) => i.value !== null) as { value: number; min: number; max: number }[];
  const inRange = valid.filter((i) => i.value >= i.min && i.value <= i.max).length;
  const cor = score >= 70 ? "text-positive" : score >= 45 ? "text-evolution" : "text-negative";
  const stroke = score >= 70 ? "var(--color-positive)" : score >= 45 ? "var(--color-evolution)" : "var(--color-negative)";
  const label = score >= 70 ? "Sólido" : score >= 45 ? "Atenção" : "Crítico";
  const resumo =
    score >= 70
      ? "Headliners majoritariamente dentro da faixa."
      : score >= 45
        ? "Alguns headliners fora da faixa — clique num card acima pra ver o porquê."
        : "Vários headliners fora da faixa — vale revisar.";
  const r = 30;
  const cx = 36;
  const cy = 36;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-hairline bg-elevated p-4">
      <div className="relative shrink-0">
        <svg width={72} height={72} viewBox="0 0 72 72" className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - (score / 100) * circ }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 4px ${stroke})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold leading-none tabular-nums ${cor}`}>{score}</span>
          <span className="text-[8px] text-muted/70">/100</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${cor}`}>{label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{resumo}</p>
        <div className="mt-2 flex gap-3 text-[11px]">
          <span>
            <b className="tabular-nums text-positive">{inRange}</b> <span className="text-muted/70">na faixa</span>
          </span>
          <span>
            <b className="tabular-nums text-negative">{valid.length - inRange}</b> <span className="text-muted/70">fora</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Cabeçalho de subseção dentro de um Painel — separa grupos de métricas
// relacionadas sem abrir um novo card pra cada grupo (evita a "poluição"
// de muitos cards pequenos competindo por atenção na mesma tela).
export function SubHeader({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/70 first:mt-0">{children}</p>;
}

// Grade compacta de métricas (rótulo + valor num card pequeno) — substitui
// a antiga StatList (linha full-width, rótulo numa ponta e valor na outra)
// porque em telas largas essa linha sobrava um vão vazio enorme no meio
// sem nenhuma informação. Um grid de 3-5 colunas usa a mesma largura pra
// mostrar 3-5x mais números por vez, sem a "poluição" do MetricGrid antigo
// porque todo card aqui tem o mesmo desenho (ícone, cor por faixa, barra
// quando existe referência) em vez de layouts variados competindo.
// `label` carrega o texto exato da faixa (ex. "ref. 20–28%") calculado a
// partir dos mesmos min/max passados pra toneFromRange/statBar — nunca um
// número novo inventado só pra exibição.
type StatBar = { pct: number; bandStart: number; bandEnd: number; label: string };

// Trilha + marcador + rótulo da faixa ideal — usada tanto no StatCard
// (grade densa) quanto no HeroStrip (headliners), pra manter a mesma
// linguagem visual de "onde você está vs. onde seria o ideal" em
// qualquer tamanho de card.
function ReferenceBar({ bar, tone, className }: { bar: StatBar; tone?: Tone; className?: string }) {
  const barCor = tone ? TONE_BG_CLASS[tone] : "bg-muted";
  return (
    <div className={className}>
      <div className="relative h-1 rounded-full bg-void/40">
        <div
          className="absolute inset-y-0 rounded-full bg-positive/15"
          style={{ left: `${bar.bandStart}%`, width: `${Math.max(0, bar.bandEnd - bar.bandStart)}%` }}
        />
        <div className={`absolute inset-y-0 w-[3px] rounded-full ${barCor}`} style={{ left: `calc(${bar.pct}% - 1.5px)` }} />
      </div>
      <p className="mt-1 text-[10px] font-medium tabular-nums text-muted/60">{bar.label}</p>
    </div>
  );
}

// Categoria opcional (ver CATEGORY_LABEL/CATEGORY_DOT_CLASS abaixo) — só
// um agrupamento visual (ponto colorido no canto do card), não muda o
// valor nem a cor por faixa do card.
export type StatCategory = "defesa" | "agressao" | "posicional";

export const CATEGORY_LABEL: Record<StatCategory, string> = {
  defesa: "Defesa",
  agressao: "Agressão",
  posicional: "Posicional",
};

const CATEGORY_DOT_CLASS: Record<StatCategory, string> = {
  defesa: "bg-training",
  agressao: "bg-evolution",
  posicional: "bg-review",
};

// Legenda das categorias acima — uma vez por grid categorizado (ver
// "Outras frequências" em PreflopMatrix.tsx), não repetida em cada card.
export function CategoryLegend({ categories }: { categories: StatCategory[] }) {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted/70">
      {categories.map((c) => (
        <span key={c} className="flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT_CLASS[c]}`} />
          {CATEGORY_LABEL[c]}
        </span>
      ))}
    </div>
  );
}

export function StatCardGrid({
  items,
}: {
  items: {
    label: string;
    value: string | null;
    icon?: LucideIcon;
    tone?: Tone;
    hint?: string;
    bar?: StatBar;
    locked?: string;
    category?: StatCategory;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((it) =>
        it.locked ? (
          <LockedMetric key={it.label} label={it.label} reason={it.locked} />
        ) : (
          <StatCard key={it.label} {...it} />
        )
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  bar,
  category,
}: {
  label: string;
  value: string | null;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
  bar?: StatBar;
  category?: StatCategory;
}) {
  const cor = tone ? TONE_TEXT_CLASS[tone] : "text-ink";
  return (
    <div
      className="relative rounded-lg border border-hairline bg-elevated p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)]"
      title={hint}
    >
      {category && (
        <span className={`absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full opacity-50 ${CATEGORY_DOT_CLASS[category]}`} title={CATEGORY_LABEL[category]} />
      )}
      <p className="flex items-center gap-1.5 pr-3 text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-muted/80">
        {Icon && <Icon size={11} className="icon-glow shrink-0" />}
        <span>{label}</span>
      </p>
      <p className={`mt-1.5 text-lg font-bold leading-none tabular-nums ${value ? cor : "text-muted/30"}`}>{value ?? "—"}</p>
      {bar && value && <ReferenceBar bar={bar} tone={tone} className="mt-2" />}
    </div>
  );
}

// Mini-gráfico de tendência (últimos N blocos do período filtrado, ver
// computeMetricTrend em analysis-service.ts) — mesma ideia do "Graphing"
// do HM3/PT4, mas em miniatura dentro da própria linha da lista em vez de
// aba separada. Só aparece quando a amostra é grande o bastante pra não
// virar ruído (gate fica na chamada de computeMetricTrend). Área
// preenchida com gradiente + traço animado (desenha ao entrar em tela) e
// um ponto pulsando no último valor, pra chamar mais atenção que uma
// polyline estática.
function Sparkline({ points, tone }: { points: number[]; tone?: Tone }) {
  const w = 56;
  const h = 20;
  const gradientId = useId();
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const [lastX, lastY] = coords[coords.length - 1];
  const stroke = tone ? TONE_STROKE[tone] : "currentColor";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible text-muted/60" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={2}
        fill={stroke}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.4, 1], opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6, ease: "easeOut" }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={2}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        initial={{ scale: 1, opacity: 0.6 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 1.6, delay: 0.9, repeat: Infinity, ease: "easeOut" }}
      />
    </svg>
  );
}

// Monta a URL do Revisor já filtrado pras mãos passadas (deep-link
// "?hands=...&label=..." — ver RevisorFila) — clicar num recorte da
// Análise (posição, matchup, leak) leva direto pra lá com a lista pronta,
// em vez de abrir uma listagem solta aqui na própria tela de Análise.
// Teto de 150 ids: a base de um usuário hoje é ~200 mãos no total (ver
// fetchAnalysisHandRows), então nenhum recorte real bate nisso — é só
// uma trava de sanidade pro tamanho da URL, não um corte que aconteça.
export function revisorHandsHref(handIds: string[], label: string): string {
  const ids = handIds.slice(-150);
  return `/revisor?hands=${ids.join(",")}&label=${encodeURIComponent(label)}`;
}

// Três estados (não dois) pra faixa de referência — verde na medida
// certa, amarelo quando fica abaixo, vermelho quando fica acima. Mesmo
// código de cor em todo lugar que lê `tone`: número do card, sparkline,
// barra de referência.
export type Tone = "bom" | "abaixo" | "acima";

// Referência simplificada de "faixa saudável" pra colorir os cards sem
// depender do solver — mesmo espírito da matriz 13×13 (heurística de
// população, não output de GTO). Devolve undefined (cor neutra) fora das
// métricas com consenso conhecido, em vez de inventar faixa pra tudo.
export function toneFromRange(value: number | null, min: number, max: number): Tone | undefined {
  if (value === null) return undefined;
  if (value >= min && value <= max) return "bom";
  return value < min ? "abaixo" : "acima";
}

const TONE_TEXT_CLASS: Record<Tone, string> = {
  bom: "text-positive",
  abaixo: "text-evolution",
  acima: "text-negative",
};

const TONE_BG_CLASS: Record<Tone, string> = {
  bom: "bg-positive",
  abaixo: "bg-evolution",
  acima: "bg-negative",
};

const TONE_STROKE: Record<Tone, string> = {
  bom: "var(--color-positive, #22c55e)",
  abaixo: "var(--color-evolution, #f59e0b)",
  acima: "var(--color-negative, #e0555a)",
};

// Pra call sites fora deste arquivo que precisam da mesma cor (ex. a
// tabela "Por posição" em PreflopMatrix.tsx) sem reimplementar o mapa.
export function toneTextClass(tone: Tone | undefined): string {
  return tone ? TONE_TEXT_CLASS[tone] : "text-ink";
}

// Texto de coaching pra um headliner do HeroStrip — só devolve algo
// quando o valor está fora da própria faixa de referência (mesma
// condição de `ruim` no toneFromRange), pra não inventar conselho pra
// métrica que já está saudável. `low`/`high` são a mensagem pronta pra
// cada direção, escrita no call site (varia por métrica).
export function rangeCoaching(value: number | null, min: number, max: number, low: string, high: string): string | undefined {
  if (value === null) return undefined;
  if (value < min) return low;
  if (value > max) return high;
  return undefined;
}

// Texto exato da faixa ideal (ex. "ref. 20–28%") a partir dos mesmos
// min/max usados em toneFromRange/statBar — nunca uma escala nova
// inventada só pra exibição.
function fmtRangeLabel(min: number, max: number, unit: string): string {
  const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  return `ref. ${f(min)}–${f(max)}${unit}`;
}

// Monta a trilha visual (StatBar) pra uma métrica com faixa de referência
// conhecida — `scaleMax` é só o teto visual da barra (não um limite real),
// escolhido folgado o bastante pra outliers não estourarem 100%. `unit`
// vai só no rótulo (ex. "%"), pra métricas em razão (Aggression Factor)
// não ganharem um "%" que não faz sentido.
export function statBar(value: number | null, min: number, max: number, scaleMax: number, unit = "%"): StatBar | undefined {
  if (value === null) return undefined;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return {
    pct: clamp((value / scaleMax) * 100),
    bandStart: clamp((min / scaleMax) * 100),
    bandEnd: clamp((max / scaleMax) * 100),
    label: fmtRangeLabel(min, max, unit),
  };
}

// Contador único de amostra pro cabeçalho de um Painel (slot `action`) —
// uma vez por card, no lugar do número repetido em cada métrica dentro
// dele (era isso que gerava "203 amostras" três vezes na mesma tela).
export function SampleBadge({ hands }: { hands: number }) {
  return (
    <span className="text-[10.5px] font-semibold text-muted/70">
      {hands} {hands === 1 ? "mão" : "mãos"}
    </span>
  );
}

// Transparência sobre de onde vem a faixa "ideal" mostrada nos cards —
// escolhida automaticamente pelo formato predominante nas mãos filtradas
// (ver computeReferenceProfile em analysis-service.ts), nunca à mão.
export function ReferenceProfileBadge({ profile }: { profile: ReferenceProfile }) {
  return (
    <span
      className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted/70"
      title="Perfil de referência usado nas faixas ideais desta tela — escolhido automaticamente pelo formato predominante nas mãos filtradas."
    >
      ref. {REFERENCE_PROFILE_LABEL[profile]}
    </span>
  );
}

export function LockedMetric({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline p-2.5 opacity-70" title={reason}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-muted/60">
        <Lock size={11} className="shrink-0" />
        <span>{label}</span>
      </p>
      <p className="mt-1.5 text-lg font-bold leading-none text-muted/30">—</p>
    </div>
  );
}

export function Bloqueado({ titulo, texto }: { titulo: string; texto: string }) {
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

export function EmptyState({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline p-6 text-center">
      <p className="text-sm text-muted">{texto}</p>
    </div>
  );
}
