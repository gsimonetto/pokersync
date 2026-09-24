"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/avatar";
import { MAX_LEVEL, levelColor, levelMaterial, levelSubTier, xpForNextLevel } from "@/lib/services/xp-service";
import { useNivelDoJogador } from "@/lib/services/nivel-service";

const EASE = [0.22, 1, 0.36, 1] as const;

/** 0-100: quanto do nível atual já foi feito (o que falta pro próximo). */
export function progressoDoNivel(nivel: number, xpAtual: number) {
  if (nivel >= MAX_LEVEL) return 100;
  return Math.max(0, Math.min(100, (xpAtual / xpForNextLevel(nivel)) * 100));
}

// Foto de jogador com o anel de nível -- o padrão de TODA foto de
// jogador no app (pedido explícito). Leitura:
//   * cor do anel = patente (a cor muda a cada 10 níveis: 11 prata,
//     21 ouro ... 99 lendário), a mesma do RankChip e do Hub;
//   * quanto do anel está preenchido = quanto falta pro próximo nível;
//   * número embaixo = o nível.
//
// Quem já tem nível e XP em mãos (ranking) passa `nivel`/`xpAtual`;
// quem só tem o id passa `userId` e o nível é buscado (em lote, com
// cache). Sem nível conhecido, o anel fica neutro e sem número.
export function AvatarNivel({
  userId,
  avatarId,
  avatarUrl,
  tamanho = 40,
  nivel: nivelDado,
  xpAtual: xpDado,
  mostrarNivel,
  animar = false,
  quadrado = false,
  brilho = false,
  className = "",
}: {
  userId?: string | null;
  avatarId: number;
  avatarUrl?: string | null;
  tamanho?: number;
  nivel?: number | null;
  xpAtual?: number | null;
  /** Número do nível embaixo da foto. Padrão: só a partir de 30px. */
  mostrarNivel?: boolean;
  animar?: boolean;
  /** Foto quadrada (cartão de perfil) com o anel acompanhando os cantos. */
  quadrado?: boolean;
  /** Halo na cor da patente (usos de destaque: pódio, perfil). */
  brilho?: boolean;
  className?: string;
}) {
  const buscado = useNivelDoJogador(nivelDado == null ? userId : null);
  const nivel = nivelDado ?? buscado?.nivel ?? null;
  const xpAtual = xpDado ?? buscado?.xpAtual ?? 0;

  const espessura = tamanho >= 96 ? 4 : tamanho >= 44 ? 3 : tamanho >= 28 ? 2.5 : 2;
  const folga = tamanho >= 44 ? 3 : 2;
  const foto = Math.round(tamanho - 2 * (espessura + folga));
  const cor = nivel == null ? null : levelColor(nivel);
  const pct = nivel == null ? 0 : progressoDoNivel(nivel, xpAtual);
  const numero = (mostrarNivel ?? tamanho >= 30) && nivel != null;
  const pequeno = tamanho < 48;
  const titulo =
    nivel == null
      ? undefined
      : `${levelMaterial(nivel)} ${levelSubTier(nivel)} · Nível ${nivel}${nivel >= MAX_LEVEL ? " (máximo)" : ` · ${Math.round(pct)}% do próximo`}`;

  const meio = tamanho / 2;
  const R = meio - espessura / 2;
  const lado = tamanho - espessura;
  const raio = Math.max(4, tamanho * 0.16);
  const trilho = "rgba(255,255,255,0.09)";
  const comum = { fill: "none", strokeWidth: espessura } as const;
  // O framer-motion anima `pathLength` (0-1) cuidando do tracejado
  // sozinho, no círculo e no quadrado.
  const preenche = {
    initial: animar ? { pathLength: 0 } : false,
    animate: { pathLength: pct / 100 },
    transition: { duration: 0.9, ease: EASE, delay: 0.15 },
  } as const;

  return (
    <span
      className={`relative grid shrink-0 place-items-center ${className}`}
      style={{ width: tamanho, height: tamanho }}
      title={titulo}
    >
      {brilho && cor && (
        <span
          aria-hidden
          className={`pointer-events-none absolute -inset-1 blur-md ${quadrado ? "rounded-3xl" : "rounded-full"}`}
          style={{ background: `radial-gradient(circle, ${cor}40, transparent 70%)` }}
        />
      )}
      <svg viewBox={`0 0 ${tamanho} ${tamanho}`} className={`absolute inset-0 ${quadrado ? "" : "-rotate-90"}`} aria-hidden>
        {quadrado ? (
          <>
            <rect x={espessura / 2} y={espessura / 2} width={lado} height={lado} rx={raio} {...comum} stroke={trilho} />
            {cor && (
              <motion.rect
                x={espessura / 2}
                y={espessura / 2}
                width={lado}
                height={lado}
                rx={raio}
                {...comum}
                stroke={cor}
                strokeLinecap={pct > 0 ? "round" : "butt"}
                {...preenche}
                style={{ filter: `drop-shadow(0 0 4px ${cor}88)` }}
              />
            )}
          </>
        ) : (
          <>
            <circle cx={meio} cy={meio} r={R} {...comum} stroke={trilho} />
            {cor && (
              <motion.circle
                cx={meio}
                cy={meio}
                r={R}
                {...comum}
                stroke={cor}
                strokeLinecap={pct > 0 ? "round" : "butt"}
                {...preenche}
                style={tamanho >= 44 ? { filter: `drop-shadow(0 0 3px ${cor}99)` } : undefined}
              />
            )}
          </>
        )}
      </svg>
      <Avatar id={avatarId} url={avatarUrl} size={foto} shape={quadrado ? "square" : "circle"} />
      {numero && cor && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 rounded-full border-2 border-[#111111] font-black tabular-nums text-black ${
            pequeno ? "-bottom-1.5 px-1 text-[8.5px] leading-3" : tamanho >= 96 ? "-bottom-1.5 px-2 text-[12px] leading-5" : "-bottom-1 px-1.5 text-[10px] leading-4"
          }`}
          style={{ background: cor }}
        >
          {nivel}
        </span>
      )}
    </span>
  );
}
