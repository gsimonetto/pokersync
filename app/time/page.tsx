"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Link2,
  Copy,
  Check,
  Trash2,
  LogOut,
  Lock,
  Plus,
  ShieldCheck,
  LayoutDashboard,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ACCENT } from "@/lib/modules-data";
import {
  assignCoach,
  createInvite,
  createTeam,
  fetchInvites,
  fetchMyPlan,
  fetchMyTeam,
  inviteAtivo,
  inviteUrl,
  leaveTeam,
  planoPermiteCriarTime,
  removeMember,
  revokeInvite,
  traduzErroTime,
  updateMemberIsCoach,
  updateMemberRole,
  type MyTeam,
  type TeamInvite,
  type TeamRole,
} from "@/lib/services/team-service";

// Modo Team — base. Uma unica tela cobre os tres estados possiveis:
//   1. sem time + sem plano Team  -> bloqueio explicativo;
//   2. sem time + com plano Team  -> formulario de criacao;
//   3. com time                   -> membros + convites.
// Espacamento de borda seguindo Banca/Revisor: max-w-6xl px-6 py-10.

const PAPEL: Record<TeamRole, string> = {
  admin: "Administrador",
  coach: "Coach",
  player: "Jogador",
};

const VALIDADES = [
  { label: "24 horas", hours: 24 },
  { label: "7 dias", hours: 168 },
  { label: "30 dias", hours: 720 },
];

export default function TimePage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [data, setData] = useState<MyTeam | null>(null);
  const [invites, setInvites] = useState<TeamInvite[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [p, t] = await Promise.all([fetchMyPlan(), fetchMyTeam()]);
      setPlan(p);
      setData(t);
      if (t && (t.role === "admin" || t.role === "coach")) {
        setInvites(await fetchInvites(t.team.id));
      } else {
        setInvites([]);
      }
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/modulos"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <Users size={20} style={{ color: data?.team.accent ?? ACCENT.blue }} />
        <div className="flex-1">
          <h1 className="m-0 text-xl font-semibold tracking-tight">{data ? data.team.name : "Meu Time"}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {data ? `${data.members.length} membro(s) · você é ${PAPEL[data.role].toLowerCase()}` : "Times, papéis e convites"}
          </p>
        </div>

        {data && (data.role === "admin" || data.role === "coach") && (
          <Link
            href="/time/painel"
            className="flex items-center gap-2 rounded-lg border border-hairline bg-elevated px-3 py-2 text-[13px] text-ink transition-colors hover:border-ink/40"
          >
            <LayoutDashboard size={15} />
            Painel
          </Link>
        )}
      </header>

      {erro && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : data ? (
        <div className="space-y-6">
          <MembrosCard data={data} onChange={carregar} onErro={setErro} />
          {(data.role === "admin" || data.role === "coach") && (
            <ConvitesCard data={data} invites={invites} onChange={carregar} onErro={setErro} />
          )}
          <SairCard data={data} onChange={carregar} onErro={setErro} />
        </div>
      ) : planoPermiteCriarTime(plan) ? (
        <CriarTimeCard onCriado={carregar} onErro={setErro} />
      ) : (
        <SemPlanoCard />
      )}
    </main>
  );
}

// ------------------------------------------------------------
// Estado 1 — sem plano Team
// ------------------------------------------------------------
function SemPlanoCard() {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
          <Lock size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold">Criar um time exige o plano Team</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            A Licença Team é um produto próprio, para organizações que querem gerenciar jogadores e coaches dentro do
            PokerSync. Se você foi convidado para um time, não precisa dela: basta abrir o link de convite que recebeu.
          </p>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// Estado 2 — criar time
// ------------------------------------------------------------
function CriarTimeCard({ onCriado, onErro }: { onCriado: () => void; onErro: (s: string) => void }) {
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<"admin" | "coach">("admin");
  const [cor, setCor] = useState(ACCENT.blue);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return onErro("Dê um nome ao time.");
    setSalvando(true);
    try {
      await createTeam(nome.trim(), papel, cor);
      onCriado();
    } catch (e) {
      onErro(traduzErroTime(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-6">
      <h2 className="text-base font-semibold">Criar seu time</h2>
      <p className="mt-1 text-sm text-muted">Depois você convida coaches e jogadores por link.</p>

      <div className="mt-5 space-y-5">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Nome do time
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            maxLength={40}
            placeholder="Ex.: Curitiba Poker Team"
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-ink/40"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Sua função no time
          </label>
          <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
            {(["admin", "coach"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setPapel(r)}
                className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                  papel === r ? "bg-ink text-void" : "text-muted hover:text-ink"
                }`}
              >
                {PAPEL[r]}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Administrador gerencia membros e convites, mas não recebe mãos para revisar. Coach acompanha os jogadores e
            revisa as mãos compartilhadas. Depois de criar, o administrador pode acumular as duas funções.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Cor do time
          </label>
          <div className="flex gap-2">
            {Object.values(ACCENT).map((c) => (
              <button
                key={c}
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                  cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          <Plus size={16} strokeWidth={2.5} />
          {salvando ? "Criando…" : "Criar time"}
        </button>
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// Estado 3a — membros
// ------------------------------------------------------------
function MembrosCard({
  data,
  onChange,
  onErro,
}: {
  data: MyTeam;
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const isAdmin = data.role === "admin";

  async function trocarPapel(userId: string, role: TeamRole) {
    try {
      await updateMemberRole(userId, role);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    }
  }

  const coaches = data.members.filter((m) => m.isCoach);

  async function atribuirCoach(userId: string, coachId: string) {
    try {
      await assignCoach(userId, coachId || null);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    }
  }

  async function alternarCoach(userId: string, isCoach: boolean) {
    try {
      await updateMemberIsCoach(userId, isCoach);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    }
  }

  async function remover(userId: string, nome: string) {
    if (!confirm(`Remover ${nome} do time?`)) return;
    try {
      await removeMember(userId);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    }
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-6">
      <h2 className="text-base font-semibold">Membros</h2>

      <ul className="mt-4 divide-y divide-hairline">
        {data.members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-3">
            <Avatar id={m.avatarId} url={m.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.name}
                {m.isMe && <span className="ml-1.5 text-xs text-muted">(você)</span>}
              </p>
              <p className="text-xs text-muted">
                {m.isOwner ? "Dono do time" : `Entrou em ${new Date(m.joinedAt).toLocaleDateString("pt-BR")}`}
                {m.role === "admin" && m.isCoach && " · também revisa mãos"}
                {m.role === "player" && m.coachId
                  ? ` · coach: ${data.members.find((c) => c.userId === m.coachId)?.name ?? "—"}`
                  : ""}
              </p>
            </div>

            {isAdmin && !m.isOwner ? (
              <select
                value={m.role}
                onChange={(e) => trocarPapel(m.userId, e.target.value as TeamRole)}
                className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs text-ink outline-none"
              >
                <option value="admin">Administrador</option>
                <option value="coach">Coach</option>
                <option value="player">Jogador</option>
              </select>
            ) : (
              <span className="flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                {m.isOwner && <ShieldCheck size={11} />}
                {PAPEL[m.role]}
              </span>
            )}

            {isAdmin && m.role === "player" && coaches.length > 0 && (
              <select
                value={m.coachId ?? ""}
                onChange={(e) => atribuirCoach(m.userId, e.target.value)}
                title="Coach responsável"
                className="rounded-lg border border-hairline bg-elevated px-2 py-1.5 text-xs text-ink outline-none"
              >
                <option value="">Sem coach</option>
                {coaches.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {isAdmin && m.role === "admin" && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={m.isCoach}
                  onChange={(e) => alternarCoach(m.userId, e.target.checked)}
                  className="h-3.5 w-3.5 accent-training"
                />
                Recebe mãos
              </label>
            )}

            {isAdmin && !m.isOwner && !m.isMe && (
              <button
                onClick={() => remover(m.userId, m.name)}
                aria-label={`Remover ${m.name}`}
                className="grid h-8 w-8 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-negative/50 hover:text-negative"
              >
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------
// Estado 3b — convites por link
// ------------------------------------------------------------
function ConvitesCard({
  data,
  invites,
  onChange,
  onErro,
}: {
  data: MyTeam;
  invites: TeamInvite[];
  onChange: () => void;
  onErro: (s: string) => void;
}) {
  const [papel, setPapel] = useState<TeamRole>("player");
  const [horas, setHoras] = useState(168);
  const [usos, setUsos] = useState(1);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const ativos = invites.filter(inviteAtivo);

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

  async function cancelar(id: string) {
    try {
      await revokeInvite(id);
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    }
  }

  return (
    <section className="rounded-xl border border-hairline bg-surface p-6">
      <h2 className="text-base font-semibold">Convites</h2>
      <p className="mt-1 text-sm text-muted">
        Gere um link e envie por WhatsApp, Discord ou onde preferir. O link expira sozinho.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Entra como</label>
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as TeamRole)}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none"
          >
            <option value="player">Jogador</option>
            <option value="coach">Coach</option>
            {data.role === "admin" && <option value="admin">Administrador</option>}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Validade</label>
          <select
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value))}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none"
          >
            {VALIDADES.map((v) => (
              <option key={v.hours} value={v.hours}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Usos</label>
          <select
            value={usos}
            onChange={(e) => setUsos(Number(e.target.value))}
            className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink outline-none"
          >
            <option value={1}>1 pessoa</option>
            <option value={5}>Até 5</option>
            <option value={25}>Até 25</option>
          </select>
        </div>

        <button
          onClick={gerar}
          disabled={gerando}
          className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          <Link2 size={16} strokeWidth={2.5} />
          {gerando ? "Gerando…" : "Gerar link"}
        </button>
      </div>

      {ativos.length === 0 ? (
        <p className="mt-5 text-sm text-muted">Nenhum convite ativo.</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {ativos.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2.5"
            >
              <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                {PAPEL[i.role]}
              </span>
              <code className="min-w-0 flex-1 truncate text-xs text-muted">{inviteUrl(i.token)}</code>
              <span className="text-xs text-muted">
                {i.uses}/{i.maxUses} · expira {new Date(i.expiresAt).toLocaleDateString("pt-BR")}
              </span>
              <button
                onClick={() => copiar(i.token)}
                aria-label="Copiar link"
                className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-ink/40 hover:text-ink"
              >
                {copiado === i.token ? <Check size={15} className="text-positive" /> : <Copy size={15} />}
              </button>
              <button
                onClick={() => cancelar(i.id)}
                aria-label="Cancelar convite"
                className="grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted transition-colors hover:border-negative/50 hover:text-negative"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// Estado 3c — sair do time
// ------------------------------------------------------------
function SairCard({ data, onChange, onErro }: { data: MyTeam; onChange: () => void; onErro: (s: string) => void }) {
  const dono = data.members.some((m) => m.isMe && m.isOwner);

  async function sair() {
    if (!confirm("Sair do time? Você perderá o acesso patrocinado pela organização.")) return;
    try {
      await leaveTeam();
      onChange();
    } catch (e) {
      onErro(traduzErroTime(e));
    }
  }

  if (dono) {
    return (
      <p className="text-xs text-muted">
        Você é o dono deste time — para sair, transfira a administração ou exclua o time.
      </p>
    );
  }

  return (
    <button
      onClick={sair}
      className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-negative"
    >
      <LogOut size={15} />
      Sair do time
    </button>
  );
}
