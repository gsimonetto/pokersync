"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Eye, EyeOff, FileText, KeyRound, Loader2, Radar as RadarIcon, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useConfirm } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import { fetchMyPlanState } from "@/lib/services/plan-service";
import { fetchMyMembership } from "@/lib/services/team-service";
import { ADDON_PRICES, PLANS, type PlanId } from "@/lib/plans/plans-data";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amountPaidCents: number;
  currency: string;
  createdAt: number;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
}

const INVOICE_STATUS_LABEL: Record<string, string> = {
  paid: "Paga",
  open: "Em aberto",
  void: "Cancelada",
  uncollectible: "Não cobrada",
  draft: "Rascunho",
};

export default function MinhaContaPage() {
  const confirm = useConfirm();
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [radarAddon, setRadarAddon] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [hasTeamAccess, setHasTeamAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [cancelingTarget, setCancelingTarget] = useState<"plan" | "radar" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Login com Google nao cria senha nenhuma pro usuario -- sem isso, quem
  // se cadastrou so' pelo Google fica preso a esse metodo pra sempre,
  // mesmo a tela de login sempre ter mostrado e-mail/senha e Google juntos
  // (pedido explicito: nunca travar "ou um ou outro"). `identities` do
  // Supabase Auth diz quais provedores essa conta ja tem -- "email" so'
  // aparece depois que alguem chama updateUser({ password }) ou se
  // cadastrou por e-mail/senha desde o inicio.
  const [temSenha, setTemSenha] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchMyPlanState(), fetchMyMembership().catch(() => null)])
      .then(([planState, membership]) => {
        if (!alive) return;
        setPlan(planState.plan);
        setRadarAddon(planState.radarAddon);
        setHasTeamAccess(membership?.status === "ativo");
        setTeamName(membership?.status === "ativo" ? membership.teamName : null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return;
        setTemSenha((data.user?.identities ?? []).some((i) => i.provider === "email"));
      })
      .catch(() => alive && setTemSenha(null));
    return () => {
      alive = false;
    };
  }, []);

  async function loadInvoices() {
    if (invoices !== null || loadingInvoices) return;
    setLoadingInvoices(true);
    try {
      const res = await fetch("/api/billing/invoices");
      const data = await res.json().catch(() => ({}));
      setInvoices(res.ok ? data.invoices ?? [] : []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }

  async function handleCancel(target: "plan" | "radar", label: string) {
    const ok = await confirm({
      title: "Cancelar assinatura",
      message: `Tem certeza que quer cancelar ${label}? Você mantém acesso até o fim do período já pago, mas não será cobrado de novo.`,
      confirmLabel: "Cancelar assinatura",
      tone: "danger",
    });
    if (!ok) return;

    setMsg(null);
    setCancelingTarget(target);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(
        res.ok
          ? "Cancelamento agendado — você mantém acesso até o fim do período já pago."
          : data.message || "Não foi possível cancelar agora."
      );
    } catch {
      setMsg("Não foi possível cancelar agora. Tente novamente.");
    } finally {
      setCancelingTarget(null);
    }
  }

  if (loading || plan === null) {
    return (
      <AppShell>
        <main className="flex w-full items-center justify-center px-4 py-20">
          <Loader2 size={20} className="animate-spin text-muted" />
        </main>
      </AppShell>
    );
  }

  const planDef = PLANS[plan];
  // Se o acesso vem do time, ninguem paga nada por conta propria aqui
  // (o plano pessoal foi bloqueado no momento em que entrou, ver trigger
  // team_membership_activated_blocks_individual no banco) -- so' o dono
  // do time tem assinatura de plano pra cancelar.
  const ownPlanIsPaid = !hasTeamAccess && planDef.priceCents !== null && planDef.priceCents > 0;
  const radarIsOwnPurchase = !hasTeamAccess && radarAddon && !planDef.addons.radar;

  return (
    <AppShell>
      <main className="w-full px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">Minha Conta</h1>
            <p className="mt-1 text-sm text-muted">Seu plano, complementos e histórico de pagamento.</p>
          </div>

          {msg && <p className="rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink">{msg}</p>}

          {/* Plano atual */}
          <div className="rounded-xl border border-hairline bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted/60">Plano atual</p>
                <p className="mt-1 text-xl font-bold text-ink">{hasTeamAccess ? "Acesso via Time" : planDef.name}</p>
                {hasTeamAccess ? (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <Users size={13} /> Acesso via o time <strong className="text-ink">{teamName}</strong>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    {planDef.priceCents ? `${BRL.format(planDef.priceCents / 100)}/mês` : "Grátis"}
                  </p>
                )}
              </div>
              <CreditCard size={20} className="shrink-0 text-muted/50" />
            </div>

            {!hasTeamAccess && (
              <Link
                href="/planos"
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-elevated"
              >
                Ver planos
              </Link>
            )}

            {ownPlanIsPaid && (
              <button
                onClick={() => handleCancel("plan", `o plano ${planDef.name}`)}
                disabled={cancelingTarget !== null}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-negative transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {cancelingTarget === "plan" && <Loader2 size={13} className="animate-spin" />}
                Cancelar assinatura do plano
              </button>
            )}
          </div>

          {/* Senha de acesso -- quem entra so' pelo Google pode criar uma
              senha aqui pra tambem poder entrar digitando e-mail/senha;
              quem ja tem senha pode trocar. */}
          {temSenha !== null && <SenhaCard temSenha={temSenha} onDefinida={() => setTemSenha(true)} />}

          {/* Radar */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#E8B93C]/30 bg-[#E8B93C]/10 text-[#E8B93C]">
                <RadarIcon size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Radar PokerSync</p>
                <p className="text-xs text-muted">
                  {hasTeamAccess
                    ? "Incluso via o time"
                    : planDef.addons.radar
                      ? "Incluso no seu plano"
                      : radarAddon
                        ? `Complemento ativo — ${BRL.format(ADDON_PRICES.radar / 100)}/mês`
                        : "Você não tem esse complemento"}
                </p>
              </div>
            </div>
            {radarIsOwnPurchase && (
              <button
                onClick={() => handleCancel("radar", "o complemento Radar")}
                disabled={cancelingTarget !== null}
                className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-negative transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {cancelingTarget === "radar" && <Loader2 size={13} className="animate-spin" />}
                Cancelar
              </button>
            )}
          </div>

          {/* Faturas */}
          <div className="rounded-xl border border-hairline bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Minhas faturas</p>
              <button
                onClick={loadInvoices}
                disabled={loadingInvoices}
                className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-elevated disabled:opacity-50"
              >
                {loadingInvoices ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                {invoices === null ? "Ver faturas" : "Atualizar"}
              </button>
            </div>

            {invoices !== null && (
              <ul className="mt-4 flex flex-col gap-2">
                {invoices.length === 0 && <li className="text-sm text-muted">Nenhuma fatura ainda.</li>}
                {invoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="text-ink">{DATE.format(new Date(inv.createdAt * 1000))}</p>
                      <p className="text-xs text-muted">{INVOICE_STATUS_LABEL[inv.status ?? ""] ?? inv.status}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-ink">{BRL.format(inv.amountPaidCents / 100)}</span>
                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-training hover:underline"
                        >
                          PDF
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function SenhaCard({ temSenha, onDefinida }: { temSenha: boolean; onDefinida: () => void }) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro("A senha precisa ter ao menos 6 caracteres.");
    if (senha !== confirmar) return setErro("As senhas não conferem.");
    setSalvando(true);
    try {
      const { error } = await createClient().auth.updateUser({ password: senha });
      if (error) throw error;
      setSenha("");
      setConfirmar("");
      setOk(true);
      onDefinida();
    } catch (e) {
      setErro((e as Error)?.message || "Não foi possível salvar a senha.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-hairline bg-elevated text-muted">
          <KeyRound size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Senha de acesso</p>
          <p className="text-xs text-muted">
            {temSenha
              ? "Você já pode entrar com e-mail e senha, além do Google. Troque sua senha quando quiser."
              : "Hoje você só entra com o Google. Crie uma senha pra também poder entrar digitando e-mail e senha — os dois continuam funcionando juntos."}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-2">
        <div className="relative flex-1">
          <input
            type={mostrar ? "text" : "password"}
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={temSenha ? "Nova senha" : "Criar senha"}
            className="w-full rounded-lg border border-hairline bg-elevated px-3 py-2 pr-9 text-sm text-ink placeholder-muted/50 outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={() => setMostrar((s) => !s)}
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-ink"
          >
            {mostrar ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <input
          type={mostrar ? "text" : "password"}
          required
          minLength={6}
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          placeholder="Confirmar senha"
          className="flex-1 rounded-lg border border-hairline bg-elevated px-3 py-2 text-sm text-ink placeholder-muted/50 outline-none focus:border-white/30"
        />
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-void transition-colors hover:bg-white/90 disabled:opacity-50"
        >
          {salvando && <Loader2 size={14} className="animate-spin" />}
          {temSenha ? "Trocar senha" : "Criar senha"}
        </button>
      </form>

      {erro && <p className="mt-2 text-sm text-negative">{erro}</p>}
      {ok && !erro && <p className="mt-2 text-sm text-positive">Senha salva! Já pode entrar com e-mail e senha também.</p>}
    </div>
  );
}
