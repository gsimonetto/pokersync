"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Globe, RefreshCw, Shield, Sparkles, Trophy, UsersRound, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { EASE, Esqueleto } from "@/components/painel/painel-card";
import { checkSeasonNotifications, settleExpiredSeasons, type Season } from "@/lib/services/xp-service";
import { fetchRankingTemporada, type EscopoRanking, type JogadorRanking, type RankingTemporada } from "@/lib/services/ranking-service";
import { corrida as calcCorrida, lembrarPosicao, posicaoVistaAntes } from "@/lib/hub/ranking-regras";
import { Podio } from "@/components/hub/ranking/podio";
import { LinhaRanking } from "@/components/hub/ranking/linha";
import { CartaoTemporada, ComoSubir, SuaCorrida } from "@/components/hub/ranking/lateral";
import { FichaJogador } from "@/components/hub/ranking/ficha";

const OURO = "#E0B24C";
const CHAVE_ESCOPO = "pokersync:hub-ranking-escopo";

const ESCOPOS: { valor: EscopoRanking; rotulo: string; icone: LucideIcon }[] = [
  { valor: "global", rotulo: "Geral", icone: Globe },
  { valor: "amigos", rotulo: "Amigos", icone: UsersRound },
  { valor: "time", rotulo: "Time", icone: Shield },
];

function escopoSalvo(): EscopoRanking {
  try {
    const v = window.localStorage.getItem(CHAVE_ESCOPO);
    return v === "amigos" || v === "time" ? v : "global";
  } catch {
    return "global";
  }
}

// Vista de Ranking do Hub. Estrutura:
//   celular  -- temporada, recorte, sua corrida, pódio, lista, como subir
//   desktop  -- lista à esquerda; temporada + sua corrida + como subir
//               numa coluna fixa à direita (ficam à vista enquanto a
//               lista rola)
export function Ranking({ season, onIrParaMissoes }: { season: Season | null; onIrParaMissoes: () => void }) {
  const [escopo, setEscopo] = useState<EscopoRanking>("global");
  const [cache, setCache] = useState<Partial<Record<EscopoRanking, RankingTemporada>>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [aberto, setAberto] = useState<JogadorRanking | null>(null);
  const [aviso, setAviso] = useState<{ antes: number; agora: number } | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const linhas = useRef(new Map<string, HTMLElement>());
  const podioRef = useRef<HTMLDivElement>(null);

  // Recorte lembrado entre visitas (conveniência local).
  useEffect(() => setEscopo(escopoSalvo()), []);

  // Apura temporadas vencidas (idempotente, sem cron) e dispara os avisos
  // globais de temporada ao abrir o ranking -- mesmo comportamento de antes.
  useEffect(() => {
    settleExpiredSeasons().catch(() => {});
    checkSeasonNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    if (!season) {
      setCarregando(false);
      return;
    }
    let vivo = true;
    if (!cache[escopo] || tentativa > 0) setCarregando(true);
    setErro(null);
    fetchRankingTemporada(escopo)
      .then((r) => {
        if (!vivo) return;
        setCache((c) => ({ ...c, [escopo]: r }));
      })
      .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível carregar o ranking."))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // cache fica de fora de propósito: é o que a busca preenche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopo, season, tentativa]);

  const dados = cache[escopo];
  const jogadores = useMemo(() => dados?.jogadores ?? [], [dados]);
  const ranqueados = useMemo(
    () => jogadores.filter((j) => j.posicao != null).sort((a, b) => a.posicao! - b.posicao!),
    [jogadores]
  );
  const semPontos = useMemo(() => jogadores.filter((j) => j.posicao == null), [jogadores]);
  const resto = ranqueados.filter((j) => j.posicao! > 3);
  const liderXp = ranqueados[0]?.xp ?? 0;
  const corrida = useMemo(() => calcCorrida(jogadores), [jogadores]);
  const eu = corrida.eu;

  // "Você subiu 2 posições desde a última visita" -- compara com a
  // posição que esta pessoa viu da última vez neste recorte.
  useEffect(() => {
    if (!season || !dados) return;
    const minha = dados.jogadores.find((j) => j.souEu)?.posicao;
    if (minha == null) return;
    const antes = posicaoVistaAntes(season.id, escopo);
    setAviso(antes != null && antes !== minha ? { antes, agora: minha } : null);
    lembrarPosicao(season.id, escopo, minha);
  }, [dados, season, escopo]);

  const trocarEscopo = (v: EscopoRanking) => {
    setEscopo(v);
    setAviso(null);
    try {
      window.localStorage.setItem(CHAVE_ESCOPO, v);
    } catch {
      // sem storage: só não lembra
    }
  };

  const irParaMim = useCallback(() => {
    if (!eu) return;
    const alvo = eu.posicao != null && eu.posicao <= 3 ? podioRef.current : linhas.current.get(eu.userId);
    alvo?.scrollIntoView({ behavior: "smooth", block: "center" });
    setDestaque(eu.userId);
    window.setTimeout(() => setDestaque(null), 1600);
  }, [eu]);

  if (!season) {
    return (
      <Vazio icone={Trophy} titulo="Nenhuma temporada ativa no momento">
        Assim que uma nova temporada abrir, o ranking e o pódio aparecem aqui.
      </Vazio>
    );
  }

  const completo = dados?.completo ?? true;
  const corridaProps = {
    corrida,
    escopo,
    total: dados?.total ?? 0,
    diasRestantes: season.daysRemaining,
    completo,
    onIrParaMim: resto.length > 4 && eu?.posicao != null ? irParaMim : undefined,
  };
  const mostraCorrida = !carregando && !erro && ranqueados.length > 0;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:order-2 lg:self-start">
        <CartaoTemporada season={season} />
        {mostraCorrida && (
          <div className="hidden lg:block">
            <SuaCorrida {...corridaProps} />
          </div>
        )}
        <div className="hidden lg:block">
          <ComoSubir onMissoes={onIrParaMissoes} />
        </div>
      </aside>

      <div className="min-w-0 lg:order-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">Ranking da temporada</h2>
            <p className="text-[12px] text-muted">
              {dados && ranqueados.length > 0
                ? `${dados.total} ${dados.total === 1 ? "jogador pontuou" : "jogadores pontuaram"} · XP ganho desde ${new Date(season.startsAt + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}`
                : "Quem ganhar mais XP até o fim leva o prêmio"}
            </p>
          </div>
          <div role="tablist" aria-label="Recorte do ranking" className="flex gap-1 rounded-xl border border-hairline bg-elevated p-1">
            {ESCOPOS.map((e) => {
              const Icone = e.icone;
              const ativo = e.valor === escopo;
              const bloqueado = !completo && e.valor !== "global";
              return (
                <button
                  key={e.valor}
                  role="tab"
                  aria-selected={ativo}
                  disabled={bloqueado}
                  title={bloqueado ? "Disponível após a atualização do ranking" : undefined}
                  onClick={() => trocarEscopo(e.valor)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none ${
                    ativo ? "text-void" : "text-muted hover:text-ink"
                  }`}
                >
                  {ativo && <motion.span layoutId="hub-escopo" className="absolute inset-0 rounded-lg bg-ink" transition={{ duration: 0.3, ease: EASE }} />}
                  <span className="relative flex items-center gap-1.5">
                    <Icone size={13} /> {e.rotulo}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {aviso && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="overflow-hidden"
            >
              <AvisoMovimento {...aviso} onFechar={() => setAviso(null)} />
            </motion.div>
          )}
        </AnimatePresence>

        {mostraCorrida && (
          <div className="mt-3 lg:hidden">
            <SuaCorrida {...corridaProps} compacto />
          </div>
        )}

        <div className="mt-4">
          {carregando && !dados ? (
            <div className="space-y-4">
              <div className="mx-auto grid max-w-[560px] grid-cols-3 items-end gap-3">
                {[72, 104, 56].map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="painel-esqueleto h-12 w-12 rounded-full" />
                    <div className="painel-esqueleto w-full rounded-t-xl" style={{ height: h }} />
                  </div>
                ))}
              </div>
              <Esqueleto linhas={5} altura={52} />
            </div>
          ) : erro ? (
            <Vazio icone={RefreshCw} titulo="Não conseguimos carregar o ranking">
              <button
                type="button"
                onClick={() => setTentativa((t) => t + 1)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-elevated"
              >
                <RefreshCw size={13} /> Tentar de novo
              </button>
            </Vazio>
          ) : escopo === "time" && jogadores.length === 0 ? (
            <Vazio icone={Shield} titulo="Você ainda não está em um time">
              No ranking do time você disputa só com seus colegas.{" "}
              <Link href="/marketplace" className="font-semibold text-ink underline decoration-white/30 underline-offset-2 hover:decoration-white">
                Ver vagas abertas
              </Link>
            </Vazio>
          ) : escopo === "amigos" && jogadores.length <= 1 ? (
            <Vazio icone={UsersRound} titulo="Chame seus amigos pra disputa">
              Adicione amigos pelas Conversas (ícone de chat no canto da tela) usando o código de amizade. Eles aparecem aqui assim que aceitarem.
            </Vazio>
          ) : ranqueados.length === 0 ? (
            <Vazio icone={Sparkles} titulo="A temporada acabou de começar">
              Treine, revise mãos e cumpra missões pra ganhar XP — o pódio aparece com os primeiros pontos.
            </Vazio>
          ) : (
            <motion.div animate={{ opacity: carregando ? 0.55 : 1 }} transition={{ duration: 0.2 }}>
              <div ref={podioRef} className={`rounded-2xl transition-shadow duration-500 ${destaque && eu && eu.posicao != null && eu.posicao <= 3 ? "shadow-[0_0_0_2px_rgba(224,178,76,0.5)]" : ""}`}>
                <Podio jogadores={ranqueados.slice(0, 3)} onAbrir={setAberto} chave={escopo} />
              </div>

              {resto.length > 0 && (
                <ol className="mt-4 flex flex-col gap-1.5" aria-label="Demais posições">
                    {resto.map((j, i) => {
                      const anterior = i === 0 ? 3 : resto[i - 1].posicao!;
                      const pulo = j.posicao! - anterior > 1;
                      return (
                        <li key={j.userId} className="list-none">
                          {pulo && (
                            <div className="my-1 flex items-center gap-2 text-[11px] text-muted" aria-hidden>
                              <span className="h-px flex-1 bg-hairline" />
                              {j.posicao! - anterior - 1} {j.posicao! - anterior - 1 === 1 ? "jogador" : "jogadores"}
                              <span className="h-px flex-1 bg-hairline" />
                            </div>
                          )}
                          <div className={`rounded-xl transition-shadow duration-500 ${destaque === j.userId ? "shadow-[0_0_0_2px_rgba(224,178,76,0.6)]" : ""}`}>
                            <LinhaRanking
                              ref={(el) => {
                                if (el) linhas.current.set(j.userId, el);
                                else linhas.current.delete(j.userId);
                              }}
                              j={j}
                              liderXp={liderXp}
                              indice={i}
                              onAbrir={() => setAberto(j)}
                            />
                          </div>
                        </li>
                      );
                    })}
                </ol>
              )}

              {semPontos.length > 0 && (
                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Ainda sem pontos nesta temporada</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {semPontos.map((j) => (
                      <button
                        key={j.userId}
                        type="button"
                        onClick={() => setAberto(j)}
                        className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] py-1 pl-1 pr-2.5 text-[12px] text-muted transition-colors hover:border-white/20 hover:text-ink"
                      >
                        <Avatar id={j.avatarId} url={j.avatarUrl} size={20} />
                        <span className="max-w-[140px] truncate">{j.souEu ? "Você" : j.nome}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!completo && (
                <p className="mt-4 text-[11.5px] text-muted">Fotos, movimento da semana e recortes por amigos e time chegam com a próxima atualização do ranking.</p>
              )}
            </motion.div>
          )}
        </div>

        <div className="mt-4 lg:hidden">
          <ComoSubir onMissoes={onIrParaMissoes} />
        </div>
      </div>

      {aberto && <FichaJogador j={aberto} eu={eu} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function AvisoMovimento({ antes, agora, onFechar }: { antes: number; agora: number; onFechar: () => void }) {
  const subiu = agora < antes;
  const casas = Math.abs(antes - agora);
  const cor = subiu ? OURO : "#9aa3ad";
  return (
    <div
      role="status"
      className="relative mt-3 flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5"
      style={{ borderColor: `${cor}44`, background: `linear-gradient(90deg, ${cor}17, transparent 80%)` }}
    >
      {subiu && (
        <span
          aria-hidden
          className="hub-brilho pointer-events-none absolute inset-y-0 left-0 w-1/3"
          style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,.12), transparent)" }}
        />
      )}
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${cor}22`, color: cor }}>
        {subiu ? <ArrowUp size={16} strokeWidth={2.4} /> : <ArrowDown size={16} strokeWidth={2.4} />}
      </span>
      <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
        {subiu ? "Você subiu" : "Você caiu"}{" "}
        <span className="font-bold" style={{ color: subiu ? OURO : undefined }}>
          {casas} {casas === 1 ? "posição" : "posições"}
        </span>{" "}
        desde a última visita{" "}
        <span className="text-muted">
          ({antes}º → {agora}º)
        </span>
        {!subiu && <span className="text-muted"> — ainda dá tempo de recuperar.</span>}
      </p>
      <button type="button" onClick={onFechar} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-white/[0.06] hover:text-ink" aria-label="Dispensar aviso">
        <X size={14} />
      </button>
    </div>
  );
}

function Vazio({ icone: Icone, titulo, children }: { icone: LucideIcon; titulo: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline px-6 py-10 text-center"
      style={{ background: `radial-gradient(circle at 50% 0%, ${OURO}0f, transparent 70%)` }}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: `${OURO}14`, color: OURO, boxShadow: `inset 0 0 0 1px ${OURO}33` }}>
        <Icone size={20} strokeWidth={1.6} />
      </span>
      <p className="mt-1 text-sm font-semibold text-ink">{titulo}</p>
      <div className="max-w-sm text-[12.5px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}
