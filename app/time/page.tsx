"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Lock, Plus, Clock, Flame, Target, BookOpen } from "lucide-react";
import { ACCENT } from "@/lib/modules-data";
import {
  createTeam,
  fetchMyMembership,
  fetchMyPlan,
  fetchMyTeam,
  planoPermiteCriarTime,
  traduzErroTime,
  type MyMembership,
  type MyTeam,
} from "@/lib/services/team-service";

// Porta de entrada do modulo. Nao e' uma tela de conteudo: decide para
// onde o usuario vai e sai da frente.
//   admin/coach ativo -> vai direto pro painel (sem clique extra);
//   jogador ativo     -> visao simples do proprio vinculo;
//   pendente          -> aguardando aprovacao;
//   sem time          -> criar (se tiver plano) ou explicacao.

export default function TimePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [plan, setPlan] = useState("free");
  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [data, setData] = useState<MyTeam | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const m = await fetchMyMembership();
      setMembership(m);

      // Quem gerencia entra direto no painel — o modulo "Meu Time" e' o
      // painel, nao uma tela intermediaria de membros.
      if (m?.status === "ativo" && (m.role === "admin" || m.role === "coach")) {
        router.replace("/time/painel");
        return;
      }

      if (m?.status === "ativo") {
        setData(await fetchMyTeam());
      } else if (!m) {
        setPlan(await fetchMyPlan());
      }
    } catch (e) {
      setErro(traduzErroTime(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-ink">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/modulos"
          className="grid h-9 w-9 place-items-center rounded-lg border border-hairline bg-elevated text-muted transition-colors hover:border-ink/40 hover:text-ink"
          aria-label="Voltar">
          <ArrowLeft size={18} />
        </Link>
        <Users size={20} style={{ color: data?.team.accent ?? ACCENT.blue }} />
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight">{data ? data.team.name : "Meu Time"}</h1>
          <p className="mt-0.5 text-sm text-muted">Times, papéis e convites</p>
        </div>
      </header>

      {erro && (
        <p className="mb-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">{erro}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : membership?.status === "pendente" ? (
        <AguardandoAprovacao membership={membership} />
      ) : data ? (
        <VisaoJogador data={data} />
      ) : planoPermiteCriarTime(plan) ? (
        <CriarTimeCard onCriado={carregar} onErro={setErro} />
      ) : (
        <SemPlanoCard />
      )}
    </main>
  );
}

// ------------------------------------------------------------
function AguardandoAprovacao({ membership }: { membership: MyMembership }) {
  return (
    <section className="max-w-xl rounded-xl border border-evolution/40 bg-surface p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-evolution/15 text-evolution">
          <Clock size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold">Pedido enviado para {membership.teamName}</h2>
          <p className="mt-1 text-sm text-muted">
            Um administrador do time precisa aprovar sua entrada. Você recebe uma notificação assim que isso acontecer —
            até lá, nenhum dado seu é compartilhado com o time.
          </p>
        </div>
      </div>
    </section>
  );
}

// Jogador nao gerencia nada: ve o vinculo, o coach e onde estudar.
function VisaoJogador({ data }: { data: MyTeam }) {
  const eu = data.members.find((m) => m.isMe);
  const meuCoach = data.members.find((m) => m.userId === eu?.coachId);

  return (
    <div className="max-w-2xl space-y-5">
      <section className="rounded-xl border border-hairline bg-surface p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-hairline"
            style={{ backgroundColor: `${data.team.accent}18` }}>
            {data.team.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.team.logoUrl} alt={data.team.name} className="h-full w-full object-cover" />
            ) : (
              <Users size={22} style={{ color: data.team.accent }} />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{data.team.name}</h2>
            {data.team.description && (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{data.team.description}</p>
            )}
            <p className="mt-2 text-xs text-muted">
              Você entrou em {eu ? new Date(eu.joinedAt).toLocaleDateString("pt-BR") : "—"}
              {meuCoach ? ` · seu coach é ${meuCoach.name}` : " · ainda sem coach atribuído"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-surface p-6">
        <h2 className="text-base font-semibold">O que o time acompanha</h2>
        <ul className="mt-3 space-y-2.5 text-[13px] text-muted">
          <li className="flex gap-2.5"><Target size={15} className="mt-0.5 shrink-0 text-training" />
            Sua frequência de estudo, treinos e evolução de nível.</li>
          <li className="flex gap-2.5"><BookOpen size={15} className="mt-0.5 shrink-0 text-review" />
            As mãos que <strong className="text-ink/85">você escolher</strong> compartilhar com seu coach — nenhuma outra.</li>
          <li className="flex gap-2.5"><Flame size={15} className="mt-0.5 shrink-0 text-evolution" />
            Volume de jogos e resultado, contados a partir da sua entrada no time.</li>
        </ul>
      </section>
    </div>
  );
}

function SemPlanoCard() {
  return (
    <section className="max-w-xl rounded-xl border border-hairline bg-surface p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
          <Lock size={18} />
        </span>
        <div>
          <h2 className="text-base font-semibold">Criar um time exige o plano Team</h2>
          <p className="mt-1 text-sm text-muted">
            A Licença Team é um produto próprio, para organizações que querem gerenciar jogadores e coaches dentro do
            PokerSync. Se você foi convidado para um time, não precisa dela: basta abrir o link de convite que recebeu.
          </p>
        </div>
      </div>
    </section>
  );
}

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
    <section className="max-w-xl rounded-xl border border-hairline bg-surface p-6">
      <h2 className="text-base font-semibold">Criar seu time</h2>
      <p className="mt-1 text-sm text-muted">Depois você convida coaches e jogadores por link.</p>

      <div className="mt-5 space-y-5">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Nome do time</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40}
            placeholder="Ex.: Curitiba Poker Team"
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-ink/40" />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Sua função no time</label>
          <div className="flex gap-1 rounded-lg border border-hairline bg-elevated p-1">
            {(["admin", "coach"] as const).map((r) => (
              <button key={r} onClick={() => setPapel(r)}
                className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                  papel === r ? "bg-ink text-void" : "text-muted hover:text-ink"
                }`}>
                {r === "admin" ? "Administrador" : "Coach"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Administrador gerencia membros, convites e aprovações, mas não recebe mãos para revisar. Coach acompanha os
            jogadores e revisa as mãos compartilhadas. Depois de criar, o administrador pode acumular as duas funções.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Cor do time</label>
          <div className="flex gap-2">
            {Object.values(ACCENT).map((c) => (
              <button key={c} onClick={() => setCor(c)} aria-label={`Cor ${c}`}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                  cor === c ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""
                }`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <button onClick={salvar} disabled={salvando}
          className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50">
          <Plus size={16} strokeWidth={2.5} />
          {salvando ? "Criando…" : "Criar time"}
        </button>
      </div>
    </section>
  );
}
