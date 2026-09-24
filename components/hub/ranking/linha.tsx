"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Flame, Minus, Trophy } from "lucide-react";
import { AvatarNivel } from "@/components/avatar-nivel";
import { EASE } from "@/components/painel/painel-card";
import type { JogadorRanking } from "@/lib/services/ranking-service";
import { fmtXP, movimento, type Movimento } from "@/lib/hub/ranking-regras";

const OURO = "#E0B24C";

// Foto de jogador do ranking com o anel de nível. Quando o ranking já
// trouxe o XP do nível (RPC nova), desenha direto; senão busca pelo id.
export function FotoRanking({
  j,
  tamanho,
  animar = false,
  brilho = false,
  mostrarNivel,
}: {
  j: JogadorRanking;
  tamanho: number;
  animar?: boolean;
  brilho?: boolean;
  mostrarNivel?: boolean;
}) {
  const temXp = j.xpNivel != null;
  return (
    <AvatarNivel
      userId={temXp ? null : j.userId}
      nivel={temXp ? j.nivel : undefined}
      xpAtual={temXp ? j.xpNivel : undefined}
      avatarId={j.avatarId}
      avatarUrl={j.avatarUrl}
      tamanho={tamanho}
      animar={animar}
      brilho={brilho}
      mostrarNivel={mostrarNivel}
    />
  );
}

// Seta de movimento na semana. Nunca só cor: sempre ícone + número.
export function SetaMovimento({ m, grande = false }: { m: Movimento; grande?: boolean }) {
  if (!m) return <span className={grande ? "" : "w-7"} aria-hidden />;
  const base = `inline-flex items-center justify-center gap-0.5 font-bold tabular-nums ${grande ? "text-[12px]" : "w-7 text-[10.5px]"}`;
  if (m.tipo === "novo")
    return (
      <span className={`${base} ${grande ? "rounded-md bg-training/15 px-1.5 py-0.5" : ""} text-training`} title="Entrou no ranking nesta semana">
        {grande ? "Novo na semana" : "novo"}
      </span>
    );
  if (m.tipo === "igual")
    return (
      <span className={`${base} text-muted/60`} title="Mesma posição de 7 dias atrás">
        <Minus size={grande ? 13 : 11} />
        {grande && <span className="font-medium">Mesma posição da semana passada</span>}
      </span>
    );
  const sobe = m.tipo === "subiu";
  return (
    <span
      className={`${base} ${sobe ? "text-positive" : "text-negative"} ${grande ? `rounded-md px-1.5 py-0.5 ${sobe ? "bg-positive/10" : "bg-negative/10"}` : ""}`}
      title={`${sobe ? "Subiu" : "Caiu"} ${m.casas} ${m.casas === 1 ? "posição" : "posições"} em 7 dias`}
    >
      {sobe ? <ChevronUp size={grande ? 14 : 12} strokeWidth={2.6} /> : <ChevronDown size={grande ? 14 : 12} strokeWidth={2.6} />}
      {m.casas}
      {grande && <span className="font-medium">{m.casas === 1 ? " posição" : " posições"} na semana</span>}
    </span>
  );
}

// Linha da lista (4º em diante). O botão inteiro abre a ficha do
// jogador. Hierarquia: posição > nome > XP; o resto (nível, ritmo da
// semana, sequência) é contexto em tom apagado. A faixa dourada no fundo
// é a distância pro líder -- dá pra "ver" o tamanho da diferença sem ler
// número nenhum.
export const LinhaRanking = forwardRef<
  HTMLButtonElement,
  { j: JogadorRanking; liderXp: number; indice: number; onAbrir: () => void }
>(function LinhaRanking({ j, liderXp, indice, onAbrir }, ref) {
  const m = movimento(j);
  const fatia = liderXp > 0 ? Math.max(3, Math.min(100, (j.xp / liderXp) * 100)) : 0;
  return (
    <motion.button
      ref={ref}
      layout="position"
      type="button"
      onClick={onAbrir}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE, delay: Math.min(indice, 12) * 0.03 }}
      className={`group relative flex w-full items-center gap-2 overflow-hidden rounded-xl border px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40 sm:gap-3 sm:px-3 ${
        j.souEu ? "border-[#E0B24C]/45 bg-[#E0B24C]/[0.07]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
      aria-label={`${j.posicao}º ${j.nome}, ${fmtXP(j.xp)} XP. Abrir ficha`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-700"
        style={{ width: `${fatia}%`, background: `linear-gradient(90deg, ${OURO}12, transparent)` }}
      />
      <span className="relative w-7 shrink-0 text-right text-[13px] font-bold tabular-nums text-muted sm:w-8">{j.posicao}</span>
      <span className="relative shrink-0">
        <SetaMovimento m={m} />
      </span>
      <span className="relative shrink-0">
        <FotoRanking j={j} tamanho={42} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-ink">{j.nome}</span>
          {j.titulos.length > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-[#F5D48C]" title={`Campeão da Temporada ${j.titulos.map((n) => `#${n}`).join(", ")}`}>
              <Trophy size={11} fill="#F5D48C" />
              {j.titulos.length > 1 && `x${j.titulos.length}`}
            </span>
          )}
          {j.souEu && <span className="shrink-0 rounded bg-ink px-1 text-[9.5px] font-bold uppercase leading-4 text-void">você</span>}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
          {j.xp7d != null && j.xp7d > 0 && <span className="tabular-nums text-positive/90">+{fmtXP(j.xp7d)} na semana</span>}
          {j.streak > 0 && (
            <span className="hidden items-center gap-0.5 tabular-nums min-[400px]:flex" title={`${j.streak} dias seguidos ganhando XP`}>
              <Flame size={11} className="text-orange-400" />
              {j.streak}
            </span>
          )}
        </span>
      </span>
      <span className="relative shrink-0 text-right">
        <span className="block text-[14px] font-bold tabular-nums" style={{ color: OURO }}>
          {fmtXP(j.xp)}
        </span>
        <span className="block text-[10px] uppercase tracking-wider text-muted">XP</span>
      </span>
    </motion.button>
  );
});
