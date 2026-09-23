"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Layers, Star, Target, Trophy, X, Zap, type LucideIcon } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { EASE, Numero } from "@/components/painel/painel-card";
import {
  MAX_LEVEL,
  levelColor,
  levelMaterial,
  levelSubTier,
  xpForNextLevel,
  type Progress,
} from "@/lib/services/xp-service";

const ACCENT = "#E0B24C";
const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

// Animações do Hub, escopadas neste componente (não vão pro globals.css).
// A cor de cada selo entra por variável CSS (--badge) em vez de ser
// escrita dentro do @keyframes: antes a "respiração" usava a cor do
// jogador pra TODOS os selos, e na galeria de patentes o Bronze brilhava
// dourado, o Rubi brilhava dourado etc.
export function HubEstilos() {
  return (
    <style>{`
      @keyframes hubGirar { to { transform: rotate(360deg); } }
      @keyframes hubRespirar {
        0%, 100% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--badge) 14%, transparent), 0 0 20px 0 color-mix(in srgb, var(--badge) 50%, transparent); }
        50%      { box-shadow: 0 0 0 7px color-mix(in srgb, var(--badge) 22%, transparent), 0 0 34px 4px color-mix(in srgb, var(--badge) 70%, transparent); }
      }
      @keyframes hubHalo { 0%, 100% { opacity: .5; transform: scale(1); } 50% { opacity: .9; transform: scale(1.1); } }
      @keyframes hubBrilho { 0% { transform: translateX(-140%) skewX(-18deg); } 55%, 100% { transform: translateX(240%) skewX(-18deg); } }
      @keyframes hubChama { 0%, 100% { transform: scale(1) rotate(0); } 30% { transform: scale(1.1) rotate(-3deg); } 60% { transform: scale(.96) rotate(2deg); } }
      @keyframes hubBrasa { from { transform: translate(0, 0) scale(1); opacity: .9; } to { transform: translate(var(--bx, 3px), -18px) scale(.2); opacity: 0; } }
      .hub-anel { animation: hubGirar 6s linear infinite; }
      .hub-anel-fino { animation: hubGirar 10s linear infinite reverse; }
      .hub-selo { animation: hubRespirar 2.6s ease-in-out infinite; }
      .hub-halo { animation: hubHalo 2.6s ease-in-out infinite; }
      .hub-orbita { animation: hubGirar 5s linear infinite; }
      .hub-brilho { animation: hubBrilho 3.4s ease-in-out infinite; }
      .hub-chama { animation: hubChama var(--vel, 2s) ease-in-out infinite; transform-origin: 50% 90%; }
      .hub-brasa { animation: hubBrasa 1.5s ease-in infinite; }
      @keyframes hubVarre { 0%, 70% { transform: translateX(-120%) skewX(-16deg); } 100% { transform: translateX(260%) skewX(-16deg); } }
      .hub-varre { animation: hubVarre 7s ease-in-out infinite; }
      @keyframes hubPulso { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
      .painel-esqueleto { background: rgba(255, 255, 255, 0.05); animation: hubPulso 1.6s ease-in-out infinite; }
      .hub-scroll-x { scrollbar-width: none; }
      .hub-scroll-x::-webkit-scrollbar { display: none; }
      @media (prefers-reduced-motion: reduce) {
        .hub-anel, .hub-anel-fino, .hub-selo, .hub-halo, .hub-orbita, .hub-brilho, .hub-chama, .hub-brasa, .hub-varre, .painel-esqueleto { animation: none !important; }
      }
    `}</style>
  );
}

// Selo de nível: anel girando na cor da faixa, respiração, brilho
// passando. `size` escala tudo junto (hero, galeria).
export function LevelBadge({ level, size = 80 }: { level: number; size?: number }) {
  const cor = levelColor(level);
  const faixa = Math.min(9, Math.max(0, Math.ceil(level / 10) - 1));
  const epico = faixa >= 7;
  const s = size / 80;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size, ["--badge" as string]: cor }}>
      <div
        className="hub-halo pointer-events-none absolute rounded-full blur-2xl"
        style={{ inset: -18 * s, background: `radial-gradient(circle, ${cor}${epico ? "66" : "3d"} 0%, transparent 70%)` }}
      />
      {epico && (
        <div className="hub-orbita pointer-events-none absolute inset-0">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: 4 * s,
                height: 4 * s,
                background: cor,
                boxShadow: `0 0 ${6 * s}px 1px ${cor}`,
                transform: `rotate(${i * 120}deg) translateX(${46 * s}px)`,
              }}
            />
          ))}
        </div>
      )}
      <div
        className="hub-anel pointer-events-none absolute rounded-full opacity-90 blur-[1.5px]"
        style={{ inset: -7 * s, background: `conic-gradient(from 0deg, transparent, ${cor}, ${cor}, transparent 55%)` }}
      />
      <div className="hub-anel-fino pointer-events-none absolute rounded-full border" style={{ inset: -2 * s, borderColor: `${cor}55` }} />
      <div
        className="hub-selo relative grid place-items-center overflow-hidden rounded-2xl bg-void font-extrabold tabular-nums"
        style={{ width: size, height: size, border: `2px solid ${cor}`, color: cor, fontSize: 28 * s }}
      >
        <span
          className="hub-brilho pointer-events-none absolute inset-y-0 left-0 w-1/2"
          style={{ background: "linear-gradient(115deg, transparent, rgba(255,255,255,.45), transparent)" }}
        />
        <span className="relative" style={{ textShadow: `0 0 12px ${cor}88` }}>
          {level}
        </span>
      </div>
    </div>
  );
}

/** Próximo marco visível: troca de divisão (Ouro IV → III) ou de material. */
function proximoMarco(level: number): { nivel: number; rotulo: string } | null {
  if (level >= MAX_LEVEL) return null;
  const atual = `${levelMaterial(level)} ${levelSubTier(level)}`;
  for (let l = level + 1; l <= MAX_LEVEL; l++) {
    const r = `${levelMaterial(l)} ${levelSubTier(l)}`;
    if (r !== atual) return { nivel: l, rotulo: r };
  }
  return null;
}

// Cartão de nível da aba Missões. Leitura em 3 camadas:
//   1) quem você é agora -- selo + patente;
//   2) quanto falta -- barra com os dois números nas pontas (nunca
//      encavalados: cada um fica numa ponta e não quebra linha);
//   3) seus hábitos -- sequência, XP total, combo e recorde, em 4 blocos
//      iguais (2x2 no celular, 1 linha no resto).
export function CartaoNivel({ progress, onVerPatentes }: { progress: Progress; onVerPatentes: () => void }) {
  const level = progress.level;
  const max = level >= MAX_LEVEL;
  const cor = levelColor(level);
  const necessario = max ? 0 : xpForNextLevel(level);
  const pct = max ? 100 : Math.min(100, (progress.xp_current / necessario) * 100);
  const marco = proximoMarco(level);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-hairline bg-surface p-4 sm:p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 0% 0%, ${cor}14 0%, transparent 55%)` }}
      />

      <div className="relative flex items-center gap-4 sm:gap-5">
        <div className="p-2">
          <LevelBadge level={level} size={64} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em]"
              style={{ color: cor, background: `${cor}1f`, boxShadow: `inset 0 0 0 1px ${cor}55` }}
            >
              {levelMaterial(level)} {levelSubTier(level)}
            </span>
            {progress.prestige_count > 0 && (
              <span
                className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold"
                style={{ color: "#F5D48C", background: "#F5D48C1f" }}
                title={`Prestígio ${progress.prestige_count}x — chegou no nível máximo e recomeçou`}
              >
                <Star size={10} fill="#F5D48C" /> {progress.prestige_count}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Nível {level}
            <span className="text-sm font-medium text-muted"> / {MAX_LEVEL}</span>
          </p>
          <button
            type="button"
            onClick={onVerPatentes}
            className="mt-0.5 flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
          >
            <Layers size={12} />
            {marco ? (
              <>
                Próxima: <span style={{ color: levelColor(marco.nivel) }}>{marco.rotulo}</span> no nível {marco.nivel}
              </>
            ) : (
              "Ver todas as patentes"
            )}
          </button>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 }}
            style={{ background: `linear-gradient(90deg, ${cor}, #F5D48C)` }}
          />
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3 whitespace-nowrap text-[11.5px] tabular-nums text-muted">
          <span>
            <span className="font-semibold text-ink">{fmt(progress.xp_current)}</span>
            {!max && <> / {fmt(necessario)} XP</>}
          </span>
          <span>{max ? "Nível máximo" : `faltam ${fmt(necessario - progress.xp_current)} XP`}</span>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <BlocoSequencia dias={progress.streak_days} recorde={progress.streak_best} />
        <Bloco icone={Zap} rotulo="XP total" valor={progress.xp_total} />
        <Bloco icone={Target} rotulo="Combo GTO" valor={progress.combo_gto} ajuda="Acertos seguidos no Modo Treino (multiplica o XP)" />
        <Bloco icone={Trophy} rotulo="Recorde" valor={progress.streak_best} sufixo=" dias" ajuda="Maior sequência de dias seguidos ganhando XP" />
      </div>
    </section>
  );
}

function Bloco({
  icone: Icone,
  rotulo,
  valor,
  sufixo = "",
  ajuda,
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: number;
  sufixo?: string;
  ajuda?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5" title={ajuda}>
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
        <Icone size={12} className="shrink-0" />
        <span className="truncate">{rotulo}</span>
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-ink">
        <Numero valor={valor} formatar={fmt} />
        {sufixo && <span className="text-xs font-medium text-muted">{sufixo}</span>}
      </p>
    </div>
  );
}

// Sequência de dias ganha a chama animada (intensidade sobe com a
// sequência) -- é o hábito que mais pesa no XP, então é o bloco que chama
// o olho. Sequência zerada fica cinza e diz o que fazer.
function BlocoSequencia({ dias, recorde }: { dias: number; recorde: number }) {
  const nivel = dias >= 7 ? 2 : dias >= 3 ? 1 : dias >= 1 ? 0.5 : 0;
  const cor = nivel === 2 ? "#FBBF24" : nivel >= 0.5 ? "#F97316" : "#6B6B6B";
  const vel = nivel === 2 ? "1.1s" : nivel === 1 ? "1.6s" : "2.4s";
  return (
    <div
      className="relative overflow-hidden rounded-xl border px-3 py-2.5"
      style={{ borderColor: nivel > 0 ? `${cor}40` : "rgba(255,255,255,0.06)", background: nivel > 0 ? `${cor}0d` : "rgba(255,255,255,0.025)" }}
      title={recorde > 0 ? `Seu recorde é ${recorde} dias` : undefined}
    >
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: nivel > 0 ? cor : undefined }}>
        <span className="relative grid h-3 w-3 place-items-center" style={{ ["--vel" as string]: vel }}>
          {nivel >= 1 &&
            [0, 1].map((i) => (
              <span
                key={i}
                className="hub-brasa absolute bottom-0 left-1/2 h-[3px] w-[3px] rounded-full"
                style={{ background: cor, animationDelay: `${i * 0.6}s`, ["--bx" as string]: `${i ? -4 : 4}px` }}
              />
            ))}
          <Flame size={12} className={nivel > 0 ? "hub-chama" : ""} color={cor} fill={nivel === 2 ? cor : "none"} />
        </span>
        <span className={nivel > 0 ? "" : "text-muted"}>Sequência</span>
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-ink">
        {dias}
        <span className="text-xs font-medium text-muted"> {dias === 1 ? "dia" : "dias"}</span>
      </p>
      {dias === 0 && <p className="-mt-0.5 text-[10.5px] text-muted">Ganhe XP hoje pra começar</p>}
    </div>
  );
}

// Galeria das 10 patentes (uma por faixa de 10 níveis).
const PREVIA_FAIXAS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99];

export function PatentesModal({ nivelAtual, onFechar }: { nivelAtual: number; onFechar: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onFechar]);

  const faixaAtual = Math.min(9, Math.max(0, Math.ceil(nivelAtual / 10) - 1));

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Patentes">
        <div className="absolute inset-0" onClick={onFechar} aria-hidden />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="relative max-h-[88svh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-surface p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Layers size={16} style={{ color: ACCENT }} /> Patentes
            </h2>
            <button onClick={onFechar} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-ink" aria-label="Fechar">
              <X size={16} />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted">A patente muda a cada 10 níveis, até o 99. Dentro de cada uma, você sobe de IV até I.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {PREVIA_FAIXAS.map((lvl, idx) => {
              const cor = levelColor(lvl);
              const atual = idx === faixaAtual;
              return (
                <div
                  key={lvl}
                  className="flex flex-col items-center gap-2 rounded-xl border p-3"
                  style={atual ? { borderColor: `${cor}70`, background: `${cor}0F` } : { borderColor: "transparent" }}
                >
                  <div className="p-2">
                    <LevelBadge level={lvl} size={52} />
                  </div>
                  <span className="text-center text-[10.5px] font-bold uppercase tracking-wide" style={{ color: cor }}>
                    {levelMaterial(lvl)}
                  </span>
                  <span className="text-[10.5px] text-muted">
                    Nível {idx === 9 ? 91 : lvl - 9}–{lvl}
                  </span>
                  {atual && (
                    <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase" style={{ color: cor, background: `${cor}22` }}>
                      você está aqui
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </ModalPortal>
  );
}
