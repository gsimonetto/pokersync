"use client";

import Link from "next/link";
import { AvatarNivel } from "@/components/avatar-nivel";
import { EmblemaEstilos, EmblemaPatente } from "@/components/hub/patentes/emblema";
import type { Profile } from "@/lib/services/profile-service";
import { MAX_LEVEL, levelColor, levelMaterial, levelSubTier, xpForNextLevel, type Progress } from "@/lib/services/xp-service";

// "Quem sou eu aqui": foto com o anel de nível, o emblema da patente e
// quanto falta pro próximo nível. Vivia no topo do Hub; foi pra tela
// inicial, ao lado da Banca (pedido explícito: "ao lado adicione esse
// card com o nível e retire do Hub pra não duplicar"). Tocar leva pro Hub.
export function ResumoNivel({ progress, perfil, href = "/hub" }: { progress: Progress; perfil: Profile | null; href?: string }) {
  const max = progress.level >= MAX_LEVEL;
  const cor = levelColor(progress.level);
  return (
    <Link
      href={href}
      className="painel-vidro group flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 py-2 pl-2 pr-4 text-left transition-colors hover:border-white/20"
      title="Abrir o Hub de Evolução"
      style={{ boxShadow: `inset 0 1px 0 ${cor}33` }}
    >
      <EmblemaEstilos />
      <span className="relative shrink-0">
        <AvatarNivel
          avatarId={perfil?.avatar_id ?? 1}
          avatarUrl={perfil?.avatar_url}
          nivel={progress.level}
          xpAtual={progress.xp_current}
          tamanho={46}
          mostrarNivel={false}
          animar
        />
        <span className="absolute -bottom-2 -right-2 transition-transform duration-300 group-hover:scale-110">
          <EmblemaPatente nivel={progress.level} tamanho={30} mostrarNumero={false} />
        </span>
      </span>
      <span className="min-w-0 pl-1">
        <span className="block truncate text-[13px] font-semibold" style={{ color: cor }}>
          {levelMaterial(progress.level)} {levelSubTier(progress.level)} · Nível {progress.level}
        </span>
        <span className="block truncate text-[11.5px] tabular-nums text-muted">
          {max ? "Nível máximo" : `faltam ${(xpForNextLevel(progress.level) - progress.xp_current).toLocaleString("pt-BR")} XP pro ${progress.level + 1}`}
        </span>
      </span>
    </Link>
  );
}
