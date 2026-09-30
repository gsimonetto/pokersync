"use client";

import { createContext, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Lock, type LucideIcon } from "lucide-react";

// Kit de dashboard do PokerSync — nasceu dentro do módulo de Análise
// (Player Evolution), mas o "Painel" (rounded-xl border-hairline
// bg-surface, fade + leve subida ao montar), StatCard/StatCardGrid,
// HealthGauge, Sparkline e o sistema de cor por tom não têm nada de
// específico de análise de mão -- por isso moraram pra cá (era
// components/analysis/shared.tsx), pra qualquer módulo do produto usar
// o mesmo acabamento visual em vez de cada tela reinventar o próprio
// card/gráfico/glow do zero.
// Visual do Painel: "padrao" (caixa chapada, o de sempre) ou "vidro" (o
// card de vidro fosco da tela inicial, título em frase em vez de CAIXA
// ALTA). Quem quer o vidro envolve a tela num <PainelVisual valor="vidro">
// -- hoje a Performance --, e todo Painel lá dentro (inclusive os das
// abas antigas) muda junto, sem prop em cada chamada. Fora do provider
// nada muda (Diário de Ranges e o resto seguem como estavam).
const PainelVisualCtx = createContext<"padrao" | "vidro">("padrao");
export const PainelVisual = PainelVisualCtx.Provider;
/** true dentro de <PainelVisual value="vidro"> -- pros cards próprios de
 *  cada módulo (ex.: Time) seguirem o mesmo visual de vidro. */
export function usePainelVidro(): boolean {
  return useContext(PainelVisualCtx) === "vidro";
}

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
  const vidro = useContext(PainelVisualCtx) === "vidro";
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={
        vidro
          ? "painel-vidro rounded-3xl border border-white/10 p-4 sm:p-5"
          : "rounded-xl border border-hairline bg-surface p-5"
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icone}
          <h2
            className={
              vidro
                ? "text-[15px] font-semibold tracking-tight text-ink"
                : "text-[10px] font-bold uppercase tracking-[0.14em] text-muted"
            }
          >
            {titulo}
          </h2>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </motion.section>
  );
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
  const dotClass = tone ? TONE_BG_CLASS[tone] : "bg-ink/60";
  const glow = tone ? TONE_STROKE[tone] : "transparent";
  return (
    <div className={className}>
      <div className="relative h-1.5 rounded-full bg-void/50">
        {/* faixa saudável — verde fixo (é sempre "a zona boa", independente
            de onde o marcador caiu) com opacidade alta o bastante pra
            aparecer mesmo em telas mais claras/monitores ruins. */}
        <div
          className="absolute inset-y-0 rounded-full bg-positive/35"
          style={{ left: `${bar.bandStart}%`, width: `${Math.max(0, bar.bandEnd - bar.bandStart)}%` }}
        />
        {/* marcador — bolinha com halo na cor do tone (verde/amarelo/
            vermelho), borda no tom do card pra "flutuar" sobre a trilha
            em vez de um traço fino de 3px quase invisível — mas do
            tamanho de um marcador, não maior que o próprio número. */}
        <div
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-elevated ${dotClass}`}
          style={{ left: `${bar.pct}%`, boxShadow: `0 0 4px 1px ${glow}` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] font-semibold tabular-nums text-muted/80">{bar.label}</p>
    </div>
  );
}

// Categoria opcional (ver CATEGORY_LABEL/CATEGORY_DOT_CLASS abaixo) — só
// um agrupamento visual (ponto colorido no canto do card), não muda o
// valor nem a cor por faixa do card. "posicional" só faz sentido pra
// grade de Preflop (fold to steal por posição); "resultado" é a mesma
// cor reaproveitada pra grade de Postflop, em métricas de showdown
// (WSD%/W$SD%) que não são nem defesa nem agressão.
type StatCategory = "defesa" | "agressao" | "posicional" | "resultado";

const CATEGORY_LABEL: Record<StatCategory, string> = {
  defesa: "Defesa",
  agressao: "Agressão",
  posicional: "Posicional",
  resultado: "Resultado",
};

const CATEGORY_DOT_CLASS: Record<StatCategory, string> = {
  defesa: "bg-training",
  agressao: "bg-evolution",
  posicional: "bg-review",
  resultado: "bg-review",
};

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
    coaching?: string;
  }[];
}) {
  // Um so' aberto por vez dentro da MESMA grade (mesmo padrao do
  // HeroStrip) -- estado vive aqui (nao dentro de cada StatCard) pra isso
  // funcionar; cada StatCardGrid renderizado (Preflop, Postflop x2...) tem
  // o seu proprio estado, entao abrir um card numa grade nao fecha o de
  // outra.
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((it) =>
        it.locked ? (
          <LockedMetric key={it.label} label={it.label} reason={it.locked} />
        ) : (
          <StatCard key={it.label} {...it} isOpen={open === it.label} onToggle={() => setOpen((cur) => (cur === it.label ? null : it.label))} />
        )
      )}
    </div>
  );
}

// Variante em lista densa do StatCardGrid — usada na aba Estatísticas
// (StatisticsTab), que tem muito mais métricas heterogêneas (datas,
// contagens, dinheiro, %) do que Preflop/Postflop/Por posição, onde o
// grid de cards com altura variável ficava com um visual "bagunçado"
// (cada card com tamanho diferente, sem alinhamento entre colunas).
// Lista de 2 colunas com linha fina entre itens lê melhor uma sequência
// grande de pares rótulo/valor — mesmo padrão já usado no Resumo Anual
// da Gestão de Banca.
export function StatList({
  items,
}: {
  items: {
    label: string;
    value: string | null;
    icon?: LucideIcon;
    tone?: Tone;
    hint?: string;
  }[];
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {items.map((it) => {
        const cor = it.tone ? TONE_TEXT_CLASS[it.tone] : "text-ink";
        const Icon = it.icon;
        return (
          <div key={it.label} className="flex items-center justify-between gap-3 border-b border-hairline py-2" title={it.hint}>
            <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
              {Icon && <Icon size={12} className="shrink-0 text-muted/70" />}
              <span className="truncate">{it.label}</span>
            </span>
            <span className={`shrink-0 text-sm font-bold tabular-nums ${it.value ? cor : "text-muted/30"}`}>{it.value ?? "—"}</span>
          </div>
        );
      })}
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
  coaching,
  isOpen,
  onToggle,
}: {
  label: string;
  value: string | null;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
  bar?: StatBar;
  category?: StatCategory;
  coaching?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const cor = tone ? TONE_TEXT_CLASS[tone] : "text-ink";
  // Mesma regra do HeroStrip: card so' vira clicavel quando ha' coaching
  // pra mostrar (metrica com faixa de referencia E fora dela) -- sem
  // isso, "clicar" num card que ja' esta' saudavel nao teria nada de novo
  // pra revelar alem do que o hover (`hint`) ja' mostra.
  const clickable = !!(coaching && value);
  const open = clickable && isOpen;
  return (
    <div
      className={`relative min-w-0 rounded-lg border border-hairline bg-elevated p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)] ${clickable ? "cursor-pointer" : ""}`}
      title={clickable ? undefined : hint}
      onClick={clickable ? onToggle : undefined}
    >
      {category && (
        // bottom-right (era top-right) -- topo do card agora pode ter o
        // chevron de "clicavel" na mesma esquina, movido pra nao
        // sobrepor o dot de categoria.
        <span className={`absolute bottom-2.5 right-2.5 h-1.5 w-1.5 rounded-full opacity-50 ${CATEGORY_DOT_CLASS[category]}`} title={CATEGORY_LABEL[category]} />
      )}
      <p className="flex items-center gap-1.5 pr-3 text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-muted/80">
        {Icon && <Icon size={11} className="icon-glow shrink-0" />}
        <span>{label}</span>
        {clickable && <ChevronDown size={10} className={`ml-auto shrink-0 text-muted/60 transition-transform ${open ? "rotate-180" : ""}`} />}
      </p>
      {/* break-words pelo mesmo motivo do MetricCard -- numero comprido
          sem espaço nao pode forçar a coluna do grid a crescer. */}
      <p className={`mt-1.5 break-words text-lg font-bold leading-none tabular-nums ${value ? cor : "text-muted/30"}`}>{value ?? "—"}</p>
      {bar && value && <ReferenceBar bar={bar} tone={tone} className="mt-2" />}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p className="mt-2 border-t border-hairline pt-2 text-[10.5px] leading-relaxed text-ink/80">{coaching}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
type Tone = "bom" | "abaixo" | "acima";

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

function LockedMetric({ label, reason }: { label: string; reason: string }) {
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
