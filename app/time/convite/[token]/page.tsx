"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, CircleAlert, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  acceptInvite,
  getInviteInfo,
  traduzErroTime,
  type InviteInfo,
  type TeamRole,
} from "@/lib/services/team-service";

// Tela publica do link de convite (/time/convite/<token>).
// O token nao carrega nenhum dado do time — quem resolve e' a funcao
// get_team_invite_info no banco, que so devolve nome/cor/papel e o
// motivo de invalidez. Assim o link pode circular por WhatsApp sem
// vazar nada da organizacao.

const PAPEL: Record<TeamRole, string> = {
  admin: "administrador",
  coach: "coach",
  player: "jogador",
};

const MOTIVO: Record<string, string> = {
  CONVITE_INEXISTENTE: "Este convite não existe.",
  CONVITE_CANCELADO: "Este convite foi cancelado pelo time.",
  CONVITE_EXPIRADO: "Este convite expirou.",
  CONVITE_ESGOTADO: "Este convite já atingiu o limite de usos.",
};

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [logado, setLogado] = useState(false);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const [{ data: auth }, i] = await Promise.all([supabase.auth.getUser(), getInviteInfo(token)]);
        setLogado(Boolean(auth.user));
        setInfo(i);
      } catch (e) {
        setErro(traduzErroTime(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function entrar() {
    setEntrando(true);
    setErro(null);
    try {
      await acceptInvite(token);
      router.push("/time");
    } catch (e) {
      setErro(traduzErroTime(e));
      setEntrando(false);
    }
  }

  const accent = info?.teamAccent || "#5AA6E0";

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-10 text-ink">
      <div className="mx-auto max-w-md rounded-xl border border-hairline bg-surface p-6">
        {loading ? (
          <p className="text-sm text-muted">Carregando convite…</p>
        ) : !info || !info.valid ? (
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
              <CircleAlert size={18} />
            </span>
            <div>
              <h1 className="text-base font-semibold">Convite indisponível</h1>
              <p className="mt-1 text-sm text-muted">
                {MOTIVO[info?.reason ?? ""] ?? "Não foi possível validar este convite."} Peça um novo link ao time.
              </p>
              <Link href="/modulos" className="mt-4 inline-block text-sm text-muted underline hover:text-ink">
                Voltar para o início
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <span
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl"
              style={{ backgroundColor: `${accent}22`, color: accent }}
            >
              <Users size={24} />
            </span>
            <h1 className="mt-4 text-lg font-semibold">{info.teamName}</h1>
            <p className="mt-1 text-sm text-muted">
              Você foi convidado para entrar como <strong className="text-ink">{PAPEL[info.role ?? "player"]}</strong>.
            </p>

            {erro && (
              <p className="mt-4 rounded-lg border border-negative/35 bg-negative/10 px-3 py-2 text-sm text-negative">
                {erro}
              </p>
            )}

            {logado ? (
              <button
                onClick={entrar}
                disabled={entrando}
                className="mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02] disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {entrando ? "Entrando…" : "Entrar no time"}
              </button>
            ) : (
              <>
                <p className="mt-5 text-sm text-muted">Entre na sua conta para aceitar o convite.</p>
                <Link
                  href="/login"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-void transition-transform hover:scale-[1.02]"
                >
                  <LogIn size={16} strokeWidth={2.5} />
                  Fazer login
                </Link>
                <p className="mt-2 text-xs text-muted">Depois de entrar, abra este link novamente.</p>
              </>
            )}

            <p className="mt-4 text-xs text-muted">
              Ao entrar, o time passa a ver sua frequência de estudo e sua evolução. Suas mãos só ficam visíveis quando
              você compartilhar.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
