"use client";

import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Coins, Landmark, PiggyBank, Plus, Receipt, Trash2 } from "lucide-react";
import type { Transaction } from "@/lib/bankroll/types";
import { fmtMoneyIn, fmtSignedMoneyIn } from "@/lib/bankroll/format";
import { consolidarEmReais } from "@/lib/bankroll/consolidado";
import { EASE, Linha, Numero, PainelCard, TileIcone } from "@/components/painel/painel-card";
import { InfoHover } from "@/components/painel/info-hover";
import type { Banca } from "./use-banca";
import { BOTAO_VIDRO, COR_NEGATIVO, COR_POSITIVO, COR_UNICA, TIPO_TX, dataBR } from "./util";

// Aba "Dinheiro": onde está o dinheiro (por plataforma e por moeda) e o
// que entrou/saiu. Nada daqui é resultado de jogo -- é o caixa.
//
//   ┌──────── Saldo por plataforma (4) ────────┐┌ Entradas e saídas (2) ┐
//   ┌──────── Movimentações (4) ───────────────┐┌ Suas moedas (2) ──────┐

export function AbaDinheiro({ b, onNovaTransacao, onExcluir }: { b: Banca; onNovaTransacao: () => void; onExcluir: (t: Transaction) => void }) {
  const fmt = (v: number) => fmtMoneyIn(v, b.moeda);
  const totalPositivo = b.plataformas.reduce((t, p) => t + Math.max(0, p.balance), 0);
  const movs = [...b.transacoesFiltradas].sort((x, y) => y.date.localeCompare(x.date));
  const c = consolidarEmReais(b.saldosMoedas, b.cambio.taxaParaBRL);

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 tela-cheia:h-full xl:grid-cols-6 tela-cheia:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ---------------- Saldo por plataforma ---------------- */}
      <PainelCard title="Saldo por plataforma" icon={<Landmark size={15} />} ordem={0} className="md:col-span-2 xl:col-span-4 tela-cheia:min-h-0">
        {b.plataformas.length === 0 ? (
          <p className="text-sm text-muted">Registre sessões ou depósitos com a plataforma pra ver quanto tem em cada uma.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {b.plataformas.map((p, i) => {
              const parte = totalPositivo > 0 ? (Math.max(0, p.balance) / totalPositivo) * 100 : 0;
              return (
                <motion.li key={p.platform} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.2 + i * 0.05 }}>
                  <InfoHover
                    className="h-full"
                    explicacao={{
                      titulo: p.platform,
                      oQueE: "Quanto você tem nessa plataforma: resultado das sessões jogadas nela + depósitos − saques.",
                      origem: "Gestão de Banca · sessões e movimentações com essa plataforma",
                      itens: [
                        { rotulo: `Resultado (${p.sessionsN} sessões)`, valor: fmtSignedMoneyIn(p.sessionsNet, b.moeda) },
                        { rotulo: "Depósitos", valor: fmt(p.deposits) },
                        { rotulo: "Saques e caixinha", valor: fmt(p.withdrawn) },
                      ],
                    }}
                  >
                    <Linha className="flex h-full flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink/90">{p.platform}</span>
                        <span className="text-[11px] tabular-nums text-muted">{Math.round(parte)}%</span>
                      </div>
                      <p className="tnum text-[22px] font-bold leading-none" style={{ color: p.balance < 0 ? COR_NEGATIVO : "#fff" }}>
                        <Numero valor={p.balance} formatar={fmt} />
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: COR_UNICA }}
                          initial={{ width: 0 }}
                          animate={{ width: `${parte}%` }}
                          transition={{ duration: 0.8, ease: EASE, delay: 0.35 + i * 0.05 }}
                        />
                      </div>
                      <p className="text-[11px] text-muted">
                        Jogo <span style={{ color: p.sessionsNet >= 0 ? COR_POSITIVO : COR_NEGATIVO }}>{fmtSignedMoneyIn(p.sessionsNet, b.moeda)}</span> · {p.sessionsN}{" "}
                        {p.sessionsN === 1 ? "sessão" : "sessões"}
                      </p>
                    </Linha>
                  </InfoHover>
                </motion.li>
              );
            })}
          </ul>
        )}
      </PainelCard>

      {/* ---------------- Entradas e saídas ---------------- */}
      <PainelCard title="Entradas e saídas" icon={<Receipt size={15} />} ordem={1} className="md:col-span-2 xl:col-span-2 tela-cheia:min-h-0">
        <div className="flex flex-col gap-2">
          <Movimento icone={<ArrowDownLeft size={16} />} cor={COR_POSITIVO} rotulo="Depositado" valor={fmt(b.patrimonio.deposits)} />
          <Movimento icone={<ArrowUpRight size={16} />} cor={COR_NEGATIVO} rotulo="Sacado" valor={fmt(b.patrimonio.withdrawn)} />
          <Movimento icone={<PiggyBank size={16} />} cor="#f59e0b" rotulo="Na caixinha" valor={fmt(b.patrimonio.caixinha)} />
          <InfoHover
            explicacao={{
              titulo: "Patrimônio no poker",
              oQueE: "Tudo que o poker já te deu, inclusive o que você sacou ou guardou. Saque e caixinha não são perda: só saem da banca de jogo.",
              origem: "Gestão de Banca",
              comoCalcula: "Banca inicial + resultado das sessões + depósitos.",
            }}
          >
            <Linha className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] text-muted">Patrimônio no poker</span>
              <span className="tnum text-[16px] font-bold text-ink">{fmt(b.patrimonio.netWorth)}</span>
            </Linha>
          </InfoHover>
        </div>
      </PainelCard>

      {/* ---------------- Movimentações ---------------- */}
      <PainelCard
        title={`Movimentações (${movs.length})`}
        icon={<Receipt size={15} />}
        ordem={2}
        className="md:col-span-2 xl:col-span-4 tela-cheia:min-h-0"
        action={
          <button type="button" onClick={onNovaTransacao} className={`${BOTAO_VIDRO} !px-2.5 !py-1.5 text-[12px]`}>
            <Plus size={14} /> Nova
          </button>
        }
      >
        {movs.length === 0 ? (
          <p className="text-sm text-muted">Nenhum depósito, saque ou caixinha registrado.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {movs.map((t) => (
              <li key={t.id}>
                <Linha className="group/linha flex items-center gap-3 !py-2.5">
                  <TileIcone cor={t.type === "deposito" ? COR_POSITIVO : t.type === "saque" ? COR_NEGATIVO : "#f59e0b"}>
                    {t.type === "deposito" ? <ArrowDownLeft size={15} /> : t.type === "saque" ? <ArrowUpRight size={15} /> : <PiggyBank size={15} />}
                  </TileIcone>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">
                      {TIPO_TX[t.type]} <span className="font-normal text-muted">· {dataBR(t.date)}</span>
                    </p>
                    <p className="truncate text-[11.5px] text-muted">{[t.venue || "Sem plataforma", t.note].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums" style={{ color: t.type === "deposito" ? COR_POSITIVO : COR_NEGATIVO }}>
                    {t.type === "deposito" ? "+" : "−"}
                    {fmtMoneyIn(t.amount, t.currency || b.moeda)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onExcluir(t)}
                    aria-label="Excluir movimentação"
                    title="Excluir movimentação"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-negative md:opacity-0 md:group-hover/linha:opacity-100 md:focus:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </Linha>
              </li>
            ))}
          </ul>
        )}
      </PainelCard>

      {/* ---------------- Moedas ---------------- */}
      <PainelCard title="Suas moedas" icon={<Coins size={15} />} ordem={3} className="md:col-span-2 xl:col-span-2 tela-cheia:min-h-0">
        <div className="flex flex-col gap-2">
          {b.saldosMoedas.length === 0 && <p className="text-sm text-muted">Sem saldo registrado ainda.</p>}
          {b.saldosMoedas.map((m) => {
            const taxa = b.cambio.taxaParaBRL(m.moeda);
            return (
              <Linha key={m.moeda} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{m.moeda}</span>
                  <span className="tnum text-[16px] font-bold text-ink">{fmtMoneyIn(m.saldo, m.moeda)}</span>
                </div>
                {m.moeda !== "BRL" && (
                  <label className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
                    <span>
                      1 {m.moeda} =
                      <input
                        inputMode="decimal"
                        value={b.cambio.manuais[m.moeda] ?? ""}
                        onChange={(e) => b.cambio.definirTaxa(m.moeda, e.target.value)}
                        placeholder={m.moeda === "USD" && b.cambio.usdDoDia ? b.cambio.usdDoDia.toFixed(2) : "0,00"}
                        className="mx-1.5 w-16 rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-center tabular-nums text-ink outline-none focus:border-[#d4af37]/60"
                      />
                      BRL
                    </span>
                    <span className="tabular-nums text-ink/80">{taxa != null ? `≈ ${fmtMoneyIn(m.saldo * taxa, "BRL")}` : "sem cotação"}</span>
                  </label>
                )}
              </Linha>
            );
          })}
          {b.saldosMoedas.some((m) => m.moeda !== "BRL") && (
            <InfoHover
              explicacao={{
                titulo: "Total em reais",
                oQueE: "Todas as moedas somadas em reais. É esse número que aparece como “Banca total” na tela inicial.",
                origem: "Gestão de Banca",
                comoCalcula: "Dólar pela cotação do dia (ou pela taxa que você digitar). Outras moedas usam a taxa digitada.",
              }}
            >
              <div className="rounded-2xl border border-[#d4af37]/25 p-3" style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.12), transparent)" }}>
                <p className="text-[11px] uppercase tracking-[0.1em] text-muted">Total em reais (estimado)</p>
                <p className="tnum mt-1 text-[22px] font-bold text-ink">{c.total != null ? fmtMoneyIn(c.total, "BRL") : "—"}</p>
                {c.semCotacao.length > 0 && <p className="mt-1 text-[11px] text-muted">Sem cotação: {c.semCotacao.join(", ")} (digite a taxa acima).</p>}
              </div>
            </InfoHover>
          )}
        </div>
      </PainelCard>
    </div>
  );
}

function Movimento({ icone, cor, rotulo, valor }: { icone: React.ReactNode; cor: string; rotulo: string; valor: string }) {
  return (
    <Linha className="flex items-center gap-3 !py-2.5">
      <TileIcone cor={cor}>{icone}</TileIcone>
      <span className="flex-1 text-[12.5px] text-muted">{rotulo}</span>
      <span className="tnum text-[15px] font-semibold text-ink">{valor}</span>
    </Linha>
  );
}
