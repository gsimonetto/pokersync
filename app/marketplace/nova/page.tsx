"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MarketplaceTabs } from "@/components/marketplace/marketplace-tabs";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import { createListing, type ListingFormat } from "@/lib/services/marketplace-service";

const FORMATS: ListingFormat[] = ["MTT", "Cash", "SNG", "Spin"];

// Criacao de vaga -- so' quem administra ou coach de um time chega
// aqui (link so' aparece pra eles em /marketplace, e o RPC/policy
// rejeita no banco mesmo se alguem forcar a URL).
export default function NovaVagaPage() {
  const router = useRouter();
  const [team, setTeam] = useState<MyTeam | null | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<ListingFormat>("MTT");
  const [buyInMin, setBuyInMin] = useState("");
  const [buyInMax, setBuyInMax] = useState("");
  const [stakingPct, setStakingPct] = useState("");
  const [minRoiPct, setMinRoiPct] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [minScore, setMinScore] = useState("");
  const [validadeDias, setValidadeDias] = useState("");

  useEffect(() => {
    fetchMyTeam()
      .then(setTeam)
      .catch(() => setTeam(null));
  }, []);

  const podeCriar = team && (team.role === "admin" || team.role === "coach");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    setSalvando(true);
    setErro(null);
    try {
      const num = (v: string) => (v.trim() === "" ? null : Number(v));
      const dias = num(validadeDias);
      const expiresAt = dias ? new Date(Date.now() + dias * 86_400_000).toISOString() : null;
      const id = await createListing(team.team.id, {
        title,
        description: description || undefined,
        format,
        buyInMin: num(buyInMin),
        buyInMax: num(buyInMax),
        stakingPct: num(stakingPct),
        minRoiPct: num(minRoiPct),
        minVolumeSessionsMonth: num(minVolume),
        minScoreGeral: num(minScore),
        expiresAt,
      });
      router.push(`/marketplace/${id}`);
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível publicar a vaga.");
      setSalvando(false);
    }
  }

  if (team === undefined) {
    return (
      <AppShell>
        <main className="flex flex-1 items-center justify-center p-10">
          <Loader2 size={20} className="animate-spin text-muted" />
        </main>
      </AppShell>
    );
  }

  if (!podeCriar) {
    return (
      <AppShell>
        <main className="w-full px-6 py-10">
          <div className="mx-auto max-w-lg rounded-2xl border border-hairline bg-surface p-6 text-center">
            <p className="text-sm text-muted">
              Só administradores ou coaches de um time podem publicar vagas no Marketplace.
            </p>
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="w-full px-6 py-10 text-ink">
        <div className="mx-auto max-w-6xl rounded-2xl border border-hairline bg-surface p-5 sm:p-6">
          <MarketplaceTabs active="nova" podeGerenciar />

          <div className="mx-auto mt-5 max-w-lg">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/70">
            Publicada em nome de {team.team.name}
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Título">
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Jogador de MTT 100-200 buy-in"
                className="input"
              />
            </Field>

            <Field label="Descrição">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Como funciona o staking, expectativas, horários..."
                className="input resize-none"
              />
            </Field>

            <Field label="Formato">
              <select value={format} onChange={(e) => setFormat(e.target.value as ListingFormat)} className="input">
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Buy-in mínimo (R$)">
                <input type="number" min="0" value={buyInMin} onChange={(e) => setBuyInMin(e.target.value)} className="input" />
              </Field>
              <Field label="Buy-in máximo (R$)">
                <input type="number" min="0" value={buyInMax} onChange={(e) => setBuyInMax(e.target.value)} className="input" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="% de Staking oferecido">
                <input type="number" min="0" max="100" value={stakingPct} onChange={(e) => setStakingPct(e.target.value)} className="input" />
              </Field>
              <Field label="Vaga expira em (dias, opcional)">
                <input
                  type="number"
                  min="1"
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(e.target.value)}
                  placeholder="Sem prazo"
                  className="input"
                />
              </Field>
            </div>

            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted/70">
              Requisitos mínimos (usados no match score do jogador)
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field label="ROI mínimo (%)">
                <input type="number" value={minRoiPct} onChange={(e) => setMinRoiPct(e.target.value)} className="input" />
              </Field>
              <Field label="Sessões/mês mínimas">
                <input type="number" min="0" value={minVolume} onChange={(e) => setMinVolume(e.target.value)} className="input" />
              </Field>
            </div>

            <Field label="Score de evolução mínimo (0-100)">
              <input type="number" min="0" max="100" value={minScore} onChange={(e) => setMinScore(e.target.value)} className="input" />
            </Field>

            {erro && <p className="text-sm text-negative">{erro}</p>}

            <button
              type="submit"
              disabled={salvando}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-void transition-colors hover:bg-white/90 disabled:opacity-50"
            >
              {salvando && <Loader2 size={14} className="animate-spin" />}
              Publicar vaga
            </button>
          </form>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--color-hairline);
          background: var(--color-elevated);
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          color: var(--color-ink);
        }
        .input:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
