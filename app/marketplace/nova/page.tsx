"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CascaVagas } from "@/components/marketplace/casca-vagas";
import { Rotulo, Segmentos } from "@/components/ranges/pecas";
import { BOTAO_OURO, BOTAO_VIDRO, CAMPO, numero } from "@/components/banca/util";
import { getUsdBrlRate } from "@/lib/services/fx-service";
import { fetchMyTeam, type MyTeam } from "@/lib/services/team-service";
import { createListing, FORMAT_LABEL, type ListingFormat, type Moeda } from "@/lib/services/marketplace-service";

const FORMATOS: ListingFormat[] = ["MTT", "Cash", "SNG", "Spin"];

// Criacao de vaga -- so' quem administra ou coach de um time chega
// aqui (link so' aparece pra eles em /marketplace, e a policy rejeita no
// banco mesmo se alguem forcar a URL). O time escolhe a moeda da vaga;
// em dólar, a cotação do dia fica guardada nela pra comparar com o
// buy-in médio dos jogadores (que a Gestão de Banca guarda em reais).
export default function NovaVagaPage() {
  const router = useRouter();
  const [time, setTime] = useState<MyTeam | null | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [formato, setFormato] = useState<ListingFormat>("MTT");
  const [moeda, setMoeda] = useState<Moeda>("BRL");
  const [cotacao, setCotacao] = useState<number | null | undefined>(undefined);
  const [buyInMin, setBuyInMin] = useState("");
  const [buyInMax, setBuyInMax] = useState("");
  const [staking, setStaking] = useState("");
  const [validadeDias, setValidadeDias] = useState("");
  const [minRoi, setMinRoi] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [minScore, setMinScore] = useState("");

  useEffect(() => {
    fetchMyTeam()
      .then(setTime)
      .catch(() => setTime(null));
  }, []);

  // Dólar escolhido: busca a cotação do dia (fica guardada na vaga).
  useEffect(() => {
    if (moeda !== "USD" || cotacao !== undefined) return;
    getUsdBrlRate().then((r) => setCotacao(r));
  }, [moeda, cotacao]);

  const podeCriar = time && (time.role === "admin" || time.role === "coach");
  const simbolo = moeda === "USD" ? "US$" : "R$";

  function validar(): string | null {
    const campos: [string, string, number, number][] = [
      [buyInMin, "O buy-in mínimo", 0, Infinity],
      [buyInMax, "O buy-in máximo", 0, Infinity],
      [staking, "O staking", 0, 100],
      [minRoi, "O ROI mínimo", -100, 10000],
      [minVolume, "O número de sessões por mês", 1, 1000],
      [minScore, "O score de evolução", 0, 100],
      [validadeDias, "O prazo", 1, 365],
    ];
    for (const [v, nome, min, max] of campos) {
      if (v.trim() === "") continue;
      const n = numero(v);
      if (!Number.isFinite(n)) return `${nome} precisa ser um número.`;
      if (n < min || n > max) return max === Infinity ? `${nome} não pode ser negativo.` : `${nome} vai de ${min} a ${max}.`;
    }
    if (buyInMin.trim() && buyInMax.trim() && numero(buyInMin) > numero(buyInMax)) return "O buy-in mínimo está maior que o máximo.";
    if (moeda === "USD" && !cotacao) return "Não deu pra buscar a cotação do dólar agora. Tente de novo em instantes ou publique em reais.";
    return null;
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (!time) return;
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    setSalvando(true);
    setErro(null);
    const n = (v: string) => (v.trim() === "" ? null : numero(v));
    const dias = n(validadeDias);
    try {
      const id = await createListing(time.team.id, {
        title: titulo.trim(),
        description: descricao.trim() || undefined,
        format: formato,
        moeda,
        cotacaoUsdBrl: moeda === "USD" ? cotacao : null,
        buyInMin: n(buyInMin),
        buyInMax: n(buyInMax),
        stakingPct: n(staking),
        minRoiPct: n(minRoi),
        minVolumeSessionsMonth: n(minVolume) === null ? null : Math.round(n(minVolume)!),
        minScoreGeral: n(minScore),
        expiresAt: dias ? new Date(Date.now() + Math.round(dias) * 86_400_000).toISOString() : null,
      });
      router.push(`/marketplace/${id}`);
    } catch (e) {
      setErro((e as Error)?.message ?? "Não foi possível publicar a vaga.");
      setSalvando(false);
    }
  }

  const voltar = (
    <Link href="/marketplace" className={`${BOTAO_VIDRO} whitespace-nowrap`}>
      <ArrowLeft size={15} /> Voltar pras vagas
    </Link>
  );

  if (time === undefined) {
    return (
      <CascaVagas titulo="Nova vaga" acoes={voltar}>
        <div className="grid place-items-center p-10">
          <Loader2 size={20} className="animate-spin text-muted" />
        </div>
      </CascaVagas>
    );
  }

  if (!podeCriar) {
    return (
      <CascaVagas titulo="Nova vaga" acoes={voltar}>
        <section className="painel-vidro mx-auto max-w-lg rounded-2xl border border-white/10 p-6 text-center text-sm text-muted">
          Só quem é admin ou coach de um time pode publicar vagas.
        </section>
      </CascaVagas>
    );
  }

  return (
    <CascaVagas titulo="Nova vaga" subtitulo={`Publicada em nome do ${time.team.name}.`} acoes={voltar}>
      <form onSubmit={publicar} className="painel-vidro mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-white/10 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Título" className="sm:col-span-2">
            <input required value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Ex.: Reforço pro elenco de MTT — 20 a 100" className={CAMPO} />
          </Campo>
          <Campo rotulo="Formato">
            <select value={formato} onChange={(e) => setFormato(e.target.value as ListingFormat)} className={`${CAMPO} !py-2`}>
              {FORMATOS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABEL[f]}
                </option>
              ))}
            </select>
          </Campo>
          {/* div (não label): o rótulo não pode "clicar" no 1º botão. */}
          <div className="flex flex-col gap-1.5 text-[12.5px] text-muted">
            Moeda da vaga
            <Segmentos
              valor={moeda}
              onChange={setMoeda}
              rotulo="Moeda da vaga"
              cheio
              opcoes={[
                { v: "BRL", t: "Reais (R$)" },
                { v: "USD", t: "Dólar (US$)" },
              ]}
            />
          </div>
          <Campo rotulo={`Buy-in mínimo (${simbolo})`}>
            <input inputMode="decimal" value={buyInMin} onChange={(e) => setBuyInMin(e.target.value)} placeholder="Ex.: 20" className={CAMPO} />
          </Campo>
          <Campo rotulo={`Buy-in máximo (${simbolo})`}>
            <input inputMode="decimal" value={buyInMax} onChange={(e) => setBuyInMax(e.target.value)} placeholder="Ex.: 100" className={CAMPO} />
          </Campo>
          {moeda === "USD" && (
            <p className="m-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-snug text-muted sm:col-span-2">
              {cotacao === undefined ? (
                "Buscando a cotação do dólar…"
              ) : cotacao ? (
                <>
                  Dólar hoje: <b className="text-ink/90">R$ {cotacao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>. Essa cotação
                  fica guardada na vaga pra comparar com o buy-in médio dos jogadores, que fica em reais.
                </>
              ) : (
                <>
                  Não deu pra buscar a cotação do dólar agora.{" "}
                  <button type="button" onClick={() => setCotacao(undefined)} className="font-semibold text-[#e8cb6a] hover:underline">
                    Tentar de novo
                  </button>
                </>
              )}
            </p>
          )}
          <Campo rotulo="Staking que o time oferece (%)">
            <input inputMode="decimal" value={staking} onChange={(e) => setStaking(e.target.value)} placeholder="Ex.: 50" className={CAMPO} />
          </Campo>
          <Campo rotulo="A vaga fica aberta por (dias)">
            <input inputMode="numeric" value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} placeholder="Sem prazo" className={CAMPO} />
          </Campo>
        </div>

        <div>
          <Rotulo>Requisitos</Rotulo>
          <p className="m-0 mt-1 text-[12px] text-muted">Deixe em branco o que não quiser exigir. Cada jogador vê na hora se bate cada um.</p>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
            <Campo rotulo="ROI mínimo (%)">
              <input inputMode="decimal" value={minRoi} onChange={(e) => setMinRoi(e.target.value)} placeholder="Ex.: 5" className={CAMPO} />
            </Campo>
            <Campo rotulo="Sessões por mês">
              <input inputMode="numeric" value={minVolume} onChange={(e) => setMinVolume(e.target.value)} placeholder="Ex.: 20" className={CAMPO} />
            </Campo>
            <Campo rotulo="Score de evolução (0–100)">
              <input inputMode="numeric" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="Ex.: 60" className={CAMPO} />
            </Campo>
          </div>
          <p className="m-0 mt-2 text-[11px] leading-snug text-muted/80">
            Com buy-in mínimo e máximo preenchidos, a faixa também entra no match: bate quem tem buy-in médio dentro dela.
          </p>
        </div>

        <Campo rotulo="Descrição">
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Como funciona o staking, grade de torneios, horários, coaching…"
            className={`${CAMPO} resize-none`}
          />
        </Campo>

        {erro && <p className="m-0 text-[13px] text-negative">{erro}</p>}

        <button type="submit" disabled={salvando} className={`${BOTAO_OURO} py-2.5`}>
          {salvando && <Loader2 size={14} className="animate-spin" />}
          Publicar vaga
        </button>
      </form>
    </CascaVagas>
  );
}

function Campo({ rotulo, className = "", children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 text-[12.5px] text-muted ${className}`}>
      {rotulo}
      {children}
    </label>
  );
}
