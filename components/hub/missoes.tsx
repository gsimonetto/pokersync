"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen, Calendar, Check, CheckCircle2, ChevronRight, Circle, ClipboardList, Clock, Flame, HelpCircle,
  Notebook, Scale, Shield, Spade, Target, TrendingUp, Trophy, type LucideIcon,
} from "lucide-react";
import { EASE } from "@/components/painel/painel-card";
import { proximaRenovacao, tempoAte, type TipoMissao } from "@/lib/hub/missoes-regras";

const XP_VERDE = "#22c55e";

// Cor da missão = cor do módulo de origem (missions.category), igual aos
// accents de lib/modules-data.ts.
const COR_CATEGORIA: Record<string, string> = {
  drill: "#2FB89A",
  bankroll: "#5AA6E0",
  review: "#A855F7",
  habit: "#E0B24C",
};

// Pra onde o cartão leva -- fecha o ciclo "vi a missão -> fui cumprir".
// "habit" não tem módulo próprio, então fica sem link.
const DESTINO: Record<string, { href: string; rotulo: string }> = {
  drill: { href: "/treino", rotulo: "Modo Treino" },
  bankroll: { href: "/banca", rotulo: "Gestão de Banca" },
  review: { href: "/revisor", rotulo: "Revisão de Mãos" },
};

// Mapeado 1:1 contra os valores reais de missions.icon.
const ICONES: Record<string, LucideIcon> = {
  target: Target,
  "check-circle": CheckCircle2,
  "trending-up": TrendingUp,
  flame: Flame,
  calendar: Calendar,
  shield: Shield,
  notebook: Notebook,
  "clipboard-list": ClipboardList,
  clock: Clock,
  spade: Spade,
  "book-open": BookOpen,
  "help-circle": HelpCircle,
  scale: Scale,
};

const DIFICULDADE: Record<string, { rotulo: string; cor: string; ordem: number }> = {
  facil: { rotulo: "Fácil", cor: "#22c55e", ordem: 0 },
  media: { rotulo: "Média", cor: "#f59e0b", ordem: 1 },
  dificil: { rotulo: "Difícil", cor: "#f97316", ordem: 2 },
  expert: { rotulo: "Expert", cor: "#e0555a", ordem: 3 },
};

interface MissaoVista {
  chave: string;
  tipo: TipoMissao;
  titulo: string;
  descricao: string;
  categoria: string | null;
  icone: string | null;
  dificuldade: string | null;
  xp: number;
  progresso: number;
  meta: number;
  concluida: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bruto = any;

function normalizar(ativas: Bruto[], catalogo: Bruto[]): { itens: MissaoVista[]; previa: boolean } {
  if (ativas.length > 0) {
    return {
      previa: false,
      itens: ativas.map((um, i) => ({
        chave: um.id ?? String(i),
        tipo: um.missions?.kind ?? "daily",
        titulo: um.missions?.title ?? "Missão",
        descricao: um.missions?.description ?? "",
        categoria: um.missions?.category ?? null,
        icone: um.missions?.icon ?? null,
        dificuldade: um.missions?.difficulty ?? null,
        xp: um.missions?.xp_reward ?? 0,
        progresso: Math.min(um.progress ?? 0, um.goal_value ?? 1),
        meta: Math.max(1, um.goal_value ?? 1),
        concluida: um.status === "completed",
      })),
    };
  }
  return {
    previa: true,
    itens: catalogo.map((m, i) => ({
      chave: m.code ?? String(i),
      tipo: m.kind ?? "daily",
      titulo: m.title,
      descricao: m.description ?? "",
      categoria: m.category ?? null,
      icone: m.icon ?? null,
      dificuldade: m.difficulty ?? null,
      xp: m.xp_reward ?? 0,
      progresso: 0,
      meta: Math.max(1, m.goal_base ?? 1),
      concluida: false,
    })),
  };
}

const ABAS: { tipo: TipoMissao; rotulo: string; icone: LucideIcon; renova: string }[] = [
  { tipo: "daily", rotulo: "Diárias", icone: Calendar, renova: "Renova em" },
  { tipo: "weekly", rotulo: "Semanais", icone: Flame, renova: "Renova em" },
  { tipo: "monthly", rotulo: "Mensais", icone: Trophy, renova: "Renova em" },
  { tipo: "challenge", rotulo: "Desafios", icone: Shield, renova: "" },
];

// Ordem dentro da aba: pendentes primeiro, da mais fácil pra mais difícil
// (vitória rápida no topo), e as concluídas no fim -- continuam visíveis
// porque "2 de 3 feitas" é parte da recompensa.
function ordenar(a: MissaoVista, b: MissaoVista) {
  if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
  const da = DIFICULDADE[a.dificuldade ?? ""]?.ordem ?? 9;
  const db = DIFICULDADE[b.dificuldade ?? ""]?.ordem ?? 9;
  return da - db;
}

export function Missoes({ ativas, catalogo }: { ativas: Bruto[]; catalogo: Bruto[] }) {
  const { itens, previa } = useMemo(() => normalizar(ativas, catalogo), [ativas, catalogo]);
  const porTipo = useMemo(() => {
    const m = new Map<TipoMissao, MissaoVista[]>();
    for (const a of ABAS) m.set(a.tipo, itens.filter((i) => i.tipo === a.tipo).sort(ordenar));
    return m;
  }, [itens]);

  // Desafios só aparece quando existe algum -- aba vazia permanente é ruído.
  const abas = ABAS.filter((a) => a.tipo !== "challenge" || (porTipo.get("challenge")?.length ?? 0) > 0);
  const [aba, setAba] = useState<TipoMissao>("daily");
  const atual = abas.find((a) => a.tipo === aba) ?? abas[0];
  const lista = porTipo.get(atual.tipo) ?? [];
  const feitas = lista.filter((m) => m.concluida).length;
  const xpAberto = lista.filter((m) => !m.concluida).reduce((s, m) => s + m.xp, 0);

  // Relógio da renovação: atualiza a cada minuto (texto em minutos).
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const renovacao = proximaRenovacao(atual.tipo, agora);

  return (
    <section className="mt-4">
      {/* Abas numa linha só (rola de lado se faltar espaço), cada uma com
          "feitas/total" -- o jogador vê onde ainda tem XP na mesa sem
          precisar abrir aba por aba. */}
      <div className="hub-scroll-x -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Período das missões" className="flex w-max min-w-full gap-1 rounded-xl border border-hairline bg-elevated p-1">
          {abas.map((a) => {
            const Icone = a.icone;
            const itensAba = porTipo.get(a.tipo) ?? [];
            const feitasAba = itensAba.filter((m) => m.concluida).length;
            const ativa = a.tipo === atual.tipo;
            const completa = itensAba.length > 0 && feitasAba === itensAba.length;
            return (
              <button
                key={a.tipo}
                role="tab"
                aria-selected={ativa}
                onClick={() => setAba(a.tipo)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[12.5px] sm:px-3 font-semibold transition-colors ${
                  ativa ? "text-void" : "text-muted hover:text-ink"
                }`}
              >
                {ativa && (
                  <motion.span layoutId="hub-aba-missao" className="absolute inset-0 rounded-lg bg-ink" transition={{ duration: 0.3, ease: EASE }} />
                )}
                <span className="relative flex items-center gap-1.5">
                  <Icone size={13} className="hidden sm:block" />
                  {a.rotulo}
                  {itensAba.length > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10.5px] font-bold tabular-nums leading-[18px] ${
                        completa ? "bg-positive/20 text-positive" : ativa ? "bg-void/15" : "bg-white/[0.07]"
                      }`}
                    >
                      {completa ? <Check size={10} className="my-1" /> : `${feitasAba}/${itensAba.length}`}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumo da aba: o que falta, quanto XP ainda está na mesa e
          quando zera. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
        {previa ? (
          <span>Missões do catálogo geral — ainda não personalizadas pro seu nível.</span>
        ) : lista.length > 0 ? (
          <>
            <span>
              <span className="font-semibold text-ink">{feitas}</span> de {lista.length} concluídas
            </span>
            {xpAberto > 0 && (
              <span>
                <span className="font-semibold" style={{ color: XP_VERDE }}>
                  +{xpAberto} XP
                </span>{" "}
                ainda disponíveis
              </span>
            )}
          </>
        ) : null}
        {renovacao && !previa && (
          <span className="flex items-center gap-1 sm:ml-auto">
            <Clock size={12} /> {atual.renova} {tempoAte(renovacao, agora)}
          </span>
        )}
      </div>

      <div className="mt-3">
        {lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline p-8 text-center text-sm text-muted">
            {atual.tipo === "monthly" ? "As missões mensais deste mês ainda não chegaram." : "Nenhuma missão aqui por enquanto."}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {lista.map((m, i) => (
              <motion.li
                key={m.chave}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: i * 0.04 }}
              >
                <CartaoMissao m={m} previa={previa} />
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CartaoMissao({ m, previa }: { m: MissaoVista; previa: boolean }) {
  const Icone = ICONES[m.icone ?? ""] ?? Circle;
  const cor = m.concluida ? XP_VERDE : COR_CATEGORIA[m.categoria ?? ""] ?? "#E0B24C";
  const destino = !previa && !m.concluida ? DESTINO[m.categoria ?? ""] : undefined;
  const pct = Math.min(100, (m.progresso / m.meta) * 100);
  const dif = DIFICULDADE[m.dificuldade ?? ""];

  const corpo = (
    <>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
        style={{ background: `${cor}17`, color: cor, boxShadow: `inset 0 0 0 1px ${cor}33` }}
      >
        {m.concluida ? <Check size={17} strokeWidth={2.4} /> : <Icone size={17} strokeWidth={1.7} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className={`flex-1 text-[13.5px] font-semibold leading-snug ${m.concluida ? "text-muted line-through decoration-white/20" : "text-ink"}`}>
            {m.titulo}
          </span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
            style={{ color: XP_VERDE, background: "rgba(34,197,94,0.1)", boxShadow: "inset 0 0 0 1px rgba(34,197,94,0.3)" }}
          >
            {m.concluida ? "✓ " : "+"}
            {m.xp} XP
          </span>
        </span>
        {m.descricao && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted">{m.descricao}</span>}
        <span className="mt-2.5 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.span
              className="block h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
              style={{ background: cor }}
            />
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted">
            {m.progresso}/{m.meta}
          </span>
        </span>
        <span className="mt-2 flex items-center gap-2 text-[11px]">
          {dif && (
            <span className="flex items-center gap-1" style={{ color: dif.cor }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: dif.cor }} />
              {dif.rotulo}
            </span>
          )}
          {destino && (
            <span className="ml-auto flex items-center gap-0.5 text-muted transition-colors group-hover:text-ink">
              {destino.rotulo} <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          )}
          {m.concluida && <span className="ml-auto text-positive">Concluída</span>}
        </span>
      </span>
    </>
  );

  const classe = `group flex h-full gap-3 rounded-2xl border p-3.5 transition-colors ${
    m.concluida ? "border-positive/20 bg-positive/[0.04]" : "border-hairline bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.035]"
  } ${previa ? "opacity-80" : ""}`;

  return destino ? (
    <Link href={destino.href} className={classe}>
      {corpo}
    </Link>
  ) : (
    <div className={classe}>{corpo}</div>
  );
}
