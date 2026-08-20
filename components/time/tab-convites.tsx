"use client";

import { useState } from "react";
import { Link2, Copy, Check, Trash2, UserCheck, UserX, Clock } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Campo } from "@/components/time/campo";
import {
  approveMember,
  createInvite,
  inviteAtivo,
  inviteUrl,
  rejectMember,
  revokeInvite,
  traduzErroTime,
  type PendingMember,
  type TeamInvite,
  type TeamRole,
} from "@/lib/services/team-service";

// Convites e aprovacoes na mesma aba, nesta ordem: pedidos pendentes
// primeiro (exigem acao humana agora), gerar link depois (acao
// opcional). Pendencia sempre acima de configuracao.

const PAPEL: Record<TeamRole, string> = { admin: "Administrador", coach: "Coach", player: "Jogador" };

const VALIDADES = [
  { label: "24 horas", hours: 24 },
  { label: "7 dias", hours: 168 },
  { label: "30 dias", hours: 720 },
];

export function TabConvites({
  pendentes,
  invites,
  isAdmin,
  meuPapel,
  onChange,
  onErro,
}: {
  pendentes: PendingMember[];
  invites: TeamInvite[];
  isAdmin: boolean;
  meuPapel: TeamRole;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [papel, setPapel] = useState<TeamRole>("player");
  const [horas, setHoras] = useState(168);
  const [usos, setUsos] = useState(1);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const ativos = invites.filter(inviteAtivo);

  async function decidir(userId: string, aprovar: boolean, nome: string) {
    if (!aprovar && !confirm(`Recusar o pedido de ${nome}?`)) return;
    setProcessando(userId);
    try {
      if (aprovar) await approveMember(userId);
      else await rejectMember(userId);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setProcessando(null);
    }
  }

  async function gerar() {
    setGerando(true);
    try {
      await createInvite({ role: papel, expiresHours: horas, maxUses: usos });
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setGerando(false);
    }
  }

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiado(token);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      onErro("Não foi possível copiar. Copie o link manualmente.");
    }
  }

  return (
    <div className="space-y-5">
      <section
        className={`rounded-xl border bg-surface p-5 ${
          pendentes.length > 0 ? "border-evolution/40" : "border-hairline"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold">
            Aguardando aprovação
            {pendentes.length > 0 && (
              <span className="ml-2 rounded-full bg-evolution px-2 py-0.5 text-[11px] font-bold text-void">
                {pendentes.length}
              </span>
            )}
          </h2>
          <span className="text-xs text-muted">quem abriu o link e pediu para entrar</span>
        </div>

        {pendentes.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum pedido pendente.</p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline">
            {pendentes.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar id={p.avatarId} url={p.avatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <Clock size={11} />
                    Pediu em {new Date(p.requestedAt).toLocaleDateString("pt-BR")} · entraria como{" "}
                    {PAPEL[p.role].toLowerCase()}
                  </p>
                </div>

                {isAdmin ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => decidir(p.userId, true, p.nome)}
                      disabled={processando === p.userId}
                      className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-semibold text-void transition-transform hover:scale-[1.03] disabled:opacity-50"
                    >
                      <UserCheck size={14} />
                      Aprovar
                    </button>
                    <button
                      onClick={() => decidir(p.userId, false, p.nome)}
                      disabled={processando === p.userId}
                      aria-label={`Recusar ${p.nome}`}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-negative/50 hover:text-negative disabled:opacity-50"
                    >
                      <UserX size={15} />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-muted">só administrador aprova</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-hairline bg-surface p-5">
        <h2 className="text-[15px] font-semibold">Gerar convite</h2>
        <p className="mt-1 text-sm text-muted">
          Envie o link por WhatsApp, Discord ou onde preferir. Quem abrir entra na fila de aprovação acima.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Campo label="Entra como">
            <select value={papel} onChange={(e) => setPapel(e.target.value as TeamRole)}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none">
              <option value="player">Jogador</option>
              <option value="coach">Coach</option>
              {meuPapel === "admin" && <option value="admin">Administrador</option>}
            </select>
          </Campo>

          <Campo label="Validade">
            <select value={horas} onChange={(e) => setHoras(Number(e.target.value))}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none">
              {VALIDADES.map((v) => <option key={v.hours} value={v.hours}>{v.label}</option>)}
            </select>
          </Campo>

          <Campo label="Usos">
            <select value={usos} onChange={(e) => setUsos(Number(e.target.value))}
              className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none">
              <option value={1}>1 pessoa</option>
              <option value={5}>Até 5</option>
              <option value={25}>Até 25</option>
            </select>
          </Campo>

          <button onClick={gerar} disabled={gerando}
            className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50">
            <Link2 size={16} strokeWidth={2.5} />
            {gerando ? "Gerando…" : "Gerar link"}
          </button>
        </div>

        {ativos.length === 0 ? (
          <p className="mt-5 text-sm text-muted">Nenhum convite ativo.</p>
        ) : (
          <ul className="mt-5 space-y-2">
            {ativos.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2.5">
                <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {PAPEL[i.role]}
                </span>
                <code className="min-w-0 flex-1 truncate text-xs text-muted">{inviteUrl(i.token)}</code>
                <span className="text-xs text-muted tnum">
                  {i.uses}/{i.maxUses} · expira {new Date(i.expiresAt).toLocaleDateString("pt-BR")}
                </span>
                <button onClick={() => copiar(i.token)} aria-label="Copiar link"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink">
                  {copiado === i.token ? <Check size={15} className="text-positive" /> : <Copy size={15} />}
                </button>
                <button onClick={async () => { try { await revokeInvite(i.id); onChange(); } catch (e) { onErro(traduzErroTime(e)); } }}
                  aria-label="Cancelar convite"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-negative/50 hover:text-negative">
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

