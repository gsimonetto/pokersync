"use client";

import { Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { TeamBanner } from "@/components/time/team-banner";
import type { TeamInfo, TeamStaff } from "@/lib/services/team-service";

const PAPEL_CURTO: Record<string, string> = { admin: "Administrador", coach: "Coach" };

// Cara publica do time -- primeira coisa que quem abre o painel ve.
// Antes essa aba ("Visao geral") ja abria direto nos numeros (KPIs,
// graficos); agora os numeros moraram pra aba Estatisticas e aqui fica
// so' identidade: banner, quem somos e quem cuida do time.
export function TabPerfil({
  info,
  staff,
  editable,
  uploading,
  onUploadClick,
  onRemoveClick,
}: {
  info: TeamInfo;
  staff: TeamStaff[];
  editable: boolean;
  uploading: boolean;
  onUploadClick: () => void;
  onRemoveClick: () => void;
}) {
  const equipe = staff.filter((s) => s.isCoach || s.role === "admin");

  return (
    <div className="space-y-5">
      <TeamBanner
        name={info.name}
        description={info.description}
        accent={info.accent}
        logoUrl={info.logoUrl}
        bannerUrl={info.bannerUrl}
        editable={editable}
        uploading={uploading}
        onUploadClick={onUploadClick}
        onRemoveClick={onRemoveClick}
      />

      <section className="rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Quem somos</h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          {info.description || "Sem descrição ainda. Edite na aba Time pra contar a história do time."}
        </p>
      </section>

      {equipe.length > 0 && (
        <section className="rounded-xl border border-hairline bg-surface p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Users size={16} className="text-muted" />
            Coaches e administração
          </h2>
          <ul className="mt-4 flex flex-wrap gap-5">
            {equipe.map((s) => (
              <li key={s.userId} className="flex items-center gap-3">
                <Avatar id={s.avatarId} url={s.avatarUrl} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.nome}</p>
                  <p className="text-xs text-muted">
                    {s.role === "admin" ? PAPEL_CURTO.admin : PAPEL_CURTO.coach}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
